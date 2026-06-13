package synthesis

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"go.uber.org/zap"

	"github.com/juliushill42/titan-search/internal/retrieval"
)

type Answer struct {
	Text        string     `json:"text"`
	Citations   []Citation `json:"citations"`
	Confidence  float64    `json:"confidence"`
	Uncertain   bool       `json:"uncertain"`
	FollowUps   []string   `json:"follow_ups"`
}

type Citation struct {
	DocID   string `json:"doc_id"`
	URL     string `json:"url"`
	Title   string `json:"title"`
	Snippet string `json:"snippet"`
	Index   int    `json:"index"`
}

type Service struct {
	log    *zap.Logger
	apiKey string
	client *http.Client
}

func NewService(log *zap.Logger, apiKey string) *Service {
	return &Service{
		log:    log,
		apiKey: apiKey,
		client: &http.Client{},
	}
}

// Synthesize generates a grounded answer from retrieved docs.
func (s *Service) Synthesize(ctx context.Context, query string, docs []retrieval.Doc) (*Answer, error) {
	if s.apiKey == "" {
		return s.mockAnswer(query, docs), nil
	}

	// Build context from top-5 docs
	limit := 5
	if len(docs) < limit {
		limit = len(docs)
	}

	var contextBuilder strings.Builder
	for i, d := range docs[:limit] {
		fmt.Fprintf(&contextBuilder, "[%d] Title: %s\nURL: %s\nSnippet: %s\n\n", i+1, d.Title, d.URL, d.Snippet)
	}

	systemPrompt := `You are a precise, factual search assistant.
Rules:
- Answer using ONLY the provided sources.
- Cite sources using [N] inline.
- Separate facts from interpretation with clear language.
- If evidence is weak or contradictory, say so explicitly.
- Keep answers under 250 words.
- End with 2-3 short follow-up question suggestions.
- Format: Answer text, then on new line "Follow-ups:" with bullet list.`

	userMsg := fmt.Sprintf("Query: %s\n\nSources:\n%s", query, contextBuilder.String())

	body, _ := json.Marshal(map[string]interface{}{
		"model":      "gpt-4o-mini",
		"max_tokens": 500,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userMsg},
		},
	})

	req, _ := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &result); err != nil || len(result.Choices) == 0 {
		return nil, fmt.Errorf("synthesis parse error")
	}

	content := result.Choices[0].Message.Content
	return parseAnswer(content, docs[:limit]), nil
}

func parseAnswer(content string, docs []retrieval.Doc) *Answer {
	parts := strings.SplitN(content, "Follow-ups:", 2)
	text := strings.TrimSpace(parts[0])

	var followUps []string
	if len(parts) > 1 {
		for _, line := range strings.Split(parts[1], "\n") {
			line = strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(line, "- "), "• "))
			if line != "" {
				followUps = append(followUps, line)
			}
		}
	}

	uncertain := strings.Contains(strings.ToLower(text), "unclear") ||
		strings.Contains(strings.ToLower(text), "uncertain") ||
		strings.Contains(strings.ToLower(text), "conflicting")

	return &Answer{
		Text:       text,
		Confidence: 0.85,
		Uncertain:  uncertain,
		FollowUps:  followUps,
	}
}

func (s *Service) mockAnswer(query string, docs []retrieval.Doc) *Answer {
	text := fmt.Sprintf(
		"Based on the available sources, %s is a topic with multiple dimensions. "+
			"According to [1], there are comprehensive guides available covering key concepts. "+
			"[2] provides encyclopedic coverage of the subject matter. "+
			"Recent research [3] indicates ongoing developments in this area.",
		query,
	)
	return &Answer{
		Text:       text,
		Confidence: 0.75,
		Uncertain:  false,
		FollowUps: []string{
			"What are the practical applications of " + query + "?",
			"How has " + query + " evolved over the past decade?",
			"What are the main controversies around " + query + "?",
		},
	}
}
