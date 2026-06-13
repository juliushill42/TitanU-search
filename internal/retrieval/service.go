package retrieval

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

type Doc struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	URL         string    `json:"url"`
	Snippet     string    `json:"snippet"`
	Domain      string    `json:"domain"`
	PublishedAt time.Time `json:"published_at"`
	Score       float64   `json:"score"`
	ContentType string    `json:"content_type"`
	Favicon     string    `json:"favicon"`
}

type Service struct {
	log   *zap.Logger
	db    *pgxpool.Pool
	cache *redis.Client
}

func NewService(log *zap.Logger, pgDSN, redisURL string) *Service {
	svc := &Service{log: log}

	if pgDSN != "" {
		pool, err := pgxpool.New(context.Background(), pgDSN)
		if err != nil {
			log.Warn("postgres unavailable, using mock retrieval", zap.Error(err))
		} else {
			svc.db = pool
		}
	}

	if redisURL != "" {
		opt, err := redis.ParseURL(redisURL)
		if err == nil {
			svc.cache = redis.NewClient(opt)
		}
	}

	return svc
}

// Search returns ranked documents for a query string.
func (s *Service) Search(ctx context.Context, query string, page int, timeRange, contentType string) ([]Doc, error) {
	_ = page
	if s.db != nil {
		return s.pgSearch(ctx, query, timeRange, contentType)
	}
	return s.mockSearch(query), nil
}

func (s *Service) pgSearch(ctx context.Context, query string, timeRange, contentType string) ([]Doc, error) {
	q := query

	tsQuery := "plainto_tsquery('english', $1)"
	sql := fmt.Sprintf(`
		SELECT id, title, url, snippet, domain, published_at, content_type,
		       ts_rank(search_vector, %s) AS score
		FROM documents
		WHERE search_vector @@ %s
	`, tsQuery, tsQuery)

	args := []interface{}{q, q}

	if contentType != "" && contentType != "web" {
		sql += " AND content_type = $3"
		args = append(args, contentType)
	}

	switch timeRange {
	case "day":
		sql += " AND published_at > NOW() - INTERVAL '1 day'"
	case "week":
		sql += " AND published_at > NOW() - INTERVAL '7 days'"
	case "month":
		sql += " AND published_at > NOW() - INTERVAL '30 days'"
	case "year":
		sql += " AND published_at > NOW() - INTERVAL '365 days'"
	}

	sql += " ORDER BY score DESC LIMIT 20"

	rows, err := s.db.Query(ctx, sql, args[:2]...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var docs []Doc
	for rows.Next() {
		var d Doc
		if err := rows.Scan(&d.ID, &d.Title, &d.URL, &d.Snippet, &d.Domain, &d.PublishedAt, &d.ContentType, &d.Score); err != nil {
			continue
		}
		d.Favicon = "https://www.google.com/s2/favicons?domain=" + d.Domain
		docs = append(docs, d)
	}
	return docs, nil
}

func (s *Service) GetByID(ctx context.Context, id string) (*Doc, error) {
	if s.db == nil {
		return &Doc{ID: id, Title: "Mock Source", URL: "https://example.com", Snippet: "Mock source detail."}, nil
	}
	var d Doc
	err := s.db.QueryRow(ctx,
		`SELECT id, title, url, snippet, domain, published_at, content_type FROM documents WHERE id = $1`, id,
	).Scan(&d.ID, &d.Title, &d.URL, &d.Snippet, &d.Domain, &d.PublishedAt, &d.ContentType)
	if err != nil {
		return nil, err
	}
	d.Favicon = "https://www.google.com/s2/favicons?domain=" + d.Domain
	return &d, nil
}

func (s *Service) mockSearch(q string) []Doc {
	return []Doc{
		{
			ID: "1", Title: "Understanding " + q + " - Comprehensive Guide",
			URL: "https://guide.example.com/" + q, Snippet: "A thorough exploration of " + q + " covering all key concepts and practical applications.",
			Domain: "guide.example.com", Score: 0.95, ContentType: "web",
			PublishedAt: time.Now().Add(-48 * time.Hour),
			Favicon:     "https://www.google.com/s2/favicons?domain=guide.example.com",
		},
		{
			ID: "2", Title: q + " — Wikipedia",
			URL: "https://en.wikipedia.org/wiki/" + q, Snippet: q + " is a topic with broad significance across multiple domains...",
			Domain: "en.wikipedia.org", Score: 0.91, ContentType: "web",
			PublishedAt: time.Now().Add(-72 * time.Hour),
			Favicon:     "https://www.google.com/s2/favicons?domain=en.wikipedia.org",
		},
		{
			ID: "3", Title: "Latest Research on " + q,
			URL: "https://research.example.com/" + q, Snippet: "Recent studies show significant advancements in " + q + " with implications for...",
			Domain: "research.example.com", Score: 0.88, ContentType: "academic",
			PublishedAt: time.Now().Add(-24 * time.Hour),
			Favicon:     "https://www.google.com/s2/favicons?domain=research.example.com",
		},
		{
			ID: "4", Title: "Top 10 Resources for " + q,
			URL: "https://blog.example.com/resources-" + q, Snippet: "Curated list of the best resources to learn about " + q + "...",
			Domain: "blog.example.com", Score: 0.83, ContentType: "web",
			PublishedAt: time.Now().Add(-120 * time.Hour),
			Favicon:     "https://www.google.com/s2/favicons?domain=blog.example.com",
		},
		{
			ID: "5", Title: q + " News — Breaking Updates",
			URL: "https://news.example.com/" + q, Snippet: "The latest news and updates on " + q + " as reported by top journalists.",
			Domain: "news.example.com", Score: 0.79, ContentType: "news",
			PublishedAt: time.Now().Add(-2 * time.Hour),
			Favicon:     "https://www.google.com/s2/favicons?domain=news.example.com",
		},
	}
}
