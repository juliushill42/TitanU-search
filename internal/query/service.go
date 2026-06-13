package query

import (
	"context"
	"strings"
	"unicode"

	"go.uber.org/zap"
)

type Intent struct {
	Type       string  // navigational | informational | transactional | research
	Confidence float64
	Keywords   []string
	Entities   []string
}

type Service struct {
	log *zap.Logger
}

func NewService(log *zap.Logger) *Service {
	return &Service{log: log}
}

// Process normalizes and classifies the query, returning cleaned query + intent.
func (s *Service) Process(ctx context.Context, raw string) (string, Intent) {
	normalized := normalize(raw)
	intent := classify(normalized)
	s.log.Debug("query processed", zap.String("raw", raw), zap.String("intent", intent.Type))
	return normalized, intent
}

func normalize(q string) string {
	q = strings.TrimSpace(q)
	q = strings.Map(func(r rune) rune {
		if unicode.IsPrint(r) {
			return r
		}
		return -1
	}, q)
	// collapse multiple spaces
	words := strings.Fields(q)
	return strings.Join(words, " ")
}

func classify(q string) Intent {
	lower := strings.ToLower(q)
	words := strings.Fields(lower)

	intent := Intent{
		Type:       "informational",
		Confidence: 0.7,
		Keywords:   extractKeywords(words),
		Entities:   extractEntities(q),
	}

	// Navigational signals
	navSignals := []string{"site:", "www.", ".com", ".org", "login", "home page", "official"}
	for _, sig := range navSignals {
		if strings.Contains(lower, sig) {
			intent.Type = "navigational"
			intent.Confidence = 0.9
			return intent
		}
	}

	// Transactional signals
	txSignals := []string{"buy", "price", "cost", "cheap", "order", "download", "get", "install", "sign up"}
	for _, sig := range txSignals {
		if strings.Contains(lower, sig) {
			intent.Type = "transactional"
			intent.Confidence = 0.85
			return intent
		}
	}

	// Research signals
	resSignals := []string{"how does", "what is", "explain", "why does", "compare", "vs", "difference", "research", "study"}
	for _, sig := range resSignals {
		if strings.Contains(lower, sig) {
			intent.Type = "research"
			intent.Confidence = 0.85
			return intent
		}
	}

	return intent
}

func extractKeywords(words []string) []string {
	stopWords := map[string]bool{
		"the": true, "a": true, "an": true, "is": true, "are": true,
		"was": true, "were": true, "be": true, "been": true, "being": true,
		"have": true, "has": true, "had": true, "do": true, "does": true,
		"did": true, "will": true, "would": true, "could": true, "should": true,
		"may": true, "might": true, "must": true, "can": true, "to": true,
		"of": true, "in": true, "for": true, "on": true, "with": true,
		"at": true, "by": true, "from": true, "up": true, "about": true,
		"into": true, "through": true, "during": true, "before": true,
	}

	var kw []string
	for _, w := range words {
		if !stopWords[w] && len(w) > 2 {
			kw = append(kw, w)
		}
	}
	return kw
}

func extractEntities(q string) []string {
	// Basic capitalized-word entity detection
	var entities []string
	words := strings.Fields(q)
	for i, w := range words {
		if i == 0 {
			continue // skip first word (likely sentence-start cap)
		}
		clean := strings.Trim(w, ".,!?;:")
		if len(clean) > 1 && unicode.IsUpper(rune(clean[0])) {
			entities = append(entities, clean)
		}
	}
	return entities
}
