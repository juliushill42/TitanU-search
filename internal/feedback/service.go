package feedback

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

type FeedbackRequest struct {
	SessionID string `json:"session_id"`
	Query     string `json:"query"`
	DocID     string `json:"doc_id"`
	Mode      string `json:"mode"`
	Type      string `json:"type"` // helpful | not_helpful | report
	Comment   string `json:"comment"`
}

type HistoryEntry struct {
	Query     string    `json:"query"`
	Mode      string    `json:"mode"`
	CreatedAt time.Time `json:"created_at"`
}

type Service struct {
	log *zap.Logger
	db  *pgxpool.Pool
}

func NewService(log *zap.Logger, pgDSN string) *Service {
	svc := &Service{log: log}
	if pgDSN != "" {
		pool, err := pgxpool.New(context.Background(), pgDSN)
		if err != nil {
			log.Warn("postgres unavailable for feedback", zap.Error(err))
		} else {
			svc.db = pool
			svc.migrate(context.Background())
		}
	}
	return svc
}

func (s *Service) migrate(ctx context.Context) {
	if s.db == nil {
		return
	}
	s.db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS feedback (
			id SERIAL PRIMARY KEY,
			session_id TEXT,
			query TEXT,
			doc_id TEXT,
			mode TEXT,
			type TEXT,
			comment TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW()
		);
		CREATE TABLE IF NOT EXISTS search_history (
			id SERIAL PRIMARY KEY,
			session_id TEXT,
			query TEXT,
			mode TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW()
		);
	`)
}

func (s *Service) Record(ctx context.Context, req FeedbackRequest) error {
	if s.db == nil {
		s.log.Info("feedback (no-db)", zap.String("type", req.Type), zap.String("query", req.Query))
		return nil
	}
	_, err := s.db.Exec(ctx,
		`INSERT INTO feedback (session_id, query, doc_id, mode, type, comment) VALUES ($1,$2,$3,$4,$5,$6)`,
		req.SessionID, req.Query, req.DocID, req.Mode, req.Type, req.Comment,
	)
	return err
}

func (s *Service) GetHistory(ctx context.Context, sessionID string) ([]HistoryEntry, error) {
	if s.db == nil {
		return []HistoryEntry{}, nil
	}
	rows, err := s.db.Query(ctx,
		`SELECT query, mode, created_at FROM search_history WHERE session_id=$1 ORDER BY created_at DESC LIMIT 50`,
		sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []HistoryEntry
	for rows.Next() {
		var h HistoryEntry
		rows.Scan(&h.Query, &h.Mode, &h.CreatedAt)
		history = append(history, h)
	}
	return history, nil
}
