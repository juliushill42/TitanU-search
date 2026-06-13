package ranking

import (
	"context"
	"math"
	"strings"
	"time"

	"go.uber.org/zap"

	"github.com/juliushill42/titan-search/internal/query"
	"github.com/juliushill42/titan-search/internal/retrieval"
)

type Service struct {
	log *zap.Logger
}

func NewService(log *zap.Logger) *Service {
	return &Service{log: log}
}

// Rerank applies multi-signal re-ranking over retrieved docs.
func (s *Service) Rerank(ctx context.Context, docs []retrieval.Doc, q string, intent query.Intent) []retrieval.Doc {
	keywords := intent.Keywords
	now := time.Now()

	for i := range docs {
		d := &docs[i]
		score := d.Score

		// Text relevance boost
		titleLower := strings.ToLower(d.Title)
		for _, kw := range keywords {
			if strings.Contains(titleLower, kw) {
				score += 0.05
			}
		}

		// Freshness decay (exponential, half-life ~7 days)
		age := now.Sub(d.PublishedAt).Hours() / 24 // days
		freshnessScore := math.Exp(-0.1 * age)
		score += freshnessScore * 0.1

		// Domain trust boost
		trustedDomains := map[string]float64{
			"en.wikipedia.org":  0.08,
			"arxiv.org":         0.09,
			"github.com":        0.07,
			"stackoverflow.com": 0.07,
			"nature.com":        0.09,
			"reuters.com":       0.06,
			"bbc.com":           0.06,
		}
		if boost, ok := trustedDomains[d.Domain]; ok {
			score += boost
		}

		// Intent-content type alignment
		switch intent.Type {
		case "research":
			if d.ContentType == "academic" {
				score += 0.1
			}
		case "navigational":
			// Prefer exact domain match to query
			if strings.Contains(d.URL, strings.ReplaceAll(q, " ", "")) {
				score += 0.15
			}
		case "transactional":
			// Penalize academic for transactional
			if d.ContentType == "academic" {
				score -= 0.05
			}
		}

		// Source diversity penalty (deduplicate domains)
		d.Score = math.Min(score, 1.0)
	}

	// Sort descending by score
	for i := 0; i < len(docs)-1; i++ {
		for j := i + 1; j < len(docs); j++ {
			if docs[j].Score > docs[i].Score {
				docs[i], docs[j] = docs[j], docs[i]
			}
		}
	}

	// Domain diversity: max 2 results per domain
	domainCount := map[string]int{}
	var filtered []retrieval.Doc
	for _, d := range docs {
		if domainCount[d.Domain] < 2 {
			filtered = append(filtered, d)
			domainCount[d.Domain]++
		}
	}

	return filtered
}
