package citation

import (
	"fmt"
	"strings"

	"go.uber.org/zap"

	"github.com/juliushill42/titan-search/internal/retrieval"
	"github.com/juliushill42/titan-search/internal/synthesis"
)

type Service struct {
	log *zap.Logger
}

func NewService(log *zap.Logger) *Service {
	return &Service{log: log}
}

// Map aligns [N] markers in answer text to actual documents.
func (s *Service) Map(answerText string, docs []retrieval.Doc) []synthesis.Citation {
	var citations []synthesis.Citation
	seen := map[int]bool{}

	for i, d := range docs {
		marker := fmt.Sprintf("[%d]", i+1)
		if strings.Contains(answerText, marker) && !seen[i] {
			citations = append(citations, synthesis.Citation{
				DocID:   d.ID,
				URL:     d.URL,
				Title:   d.Title,
				Snippet: d.Snippet,
				Index:   i + 1,
			})
			seen[i] = true
		}
	}
	return citations
}
