package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"go.uber.org/zap"

	"github.com/juliushill42/titan-search/internal/citation"
	"github.com/juliushill42/titan-search/internal/feedback"
	"github.com/juliushill42/titan-search/internal/query"
	"github.com/juliushill42/titan-search/internal/ranking"
	"github.com/juliushill42/titan-search/internal/retrieval"
	"github.com/juliushill42/titan-search/internal/synthesis"
)

func main() {
	_ = godotenv.Load()

	logger, _ := zap.NewProduction()
	defer logger.Sync()

	// Init services
	qSvc := query.NewService(logger)
	retSvc := retrieval.NewService(logger, os.Getenv("PG_DSN"), os.Getenv("REDIS_URL"))
	rankSvc := ranking.NewService(logger)
	synSvc := synthesis.NewService(logger, os.Getenv("OPENAI_KEY"))
	citSvc := citation.NewService(logger)
	fbSvc := feedback.NewService(logger, os.Getenv("PG_DSN"))

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	// Health
	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	api := r.Group("/api/v1")
	{
		api.POST("/query", searchHandler(qSvc, retSvc, rankSvc, synSvc, citSvc, logger))
		api.POST("/feedback", feedbackHandler(fbSvc, logger))
		api.GET("/sources/:id", sourceHandler(retSvc, logger))
		api.GET("/history", historyHandler(fbSvc, logger))
		api.POST("/mode", modeHandler(logger))
	}

	srv := &http.Server{Addr: ":" + getPort(), Handler: r}

	go func() {
		logger.Info("titan-search api starting", zap.String("port", getPort()))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}

func getPort() string {
	if p := os.Getenv("PORT"); p != "" {
		return p
	}
	return "8080"
}

// ── handlers ────────────────────────────────────────────────────────────────

type SearchRequest struct {
	Query   string `json:"query" binding:"required"`
	Mode    string `json:"mode"`    // classic | ai | hybrid
	Page    int    `json:"page"`
	Filters Filter `json:"filters"`
}

type Filter struct {
	TimeRange   string   `json:"time_range"`   // day|week|month|year|all
	Domains     []string `json:"domains"`
	ContentType string   `json:"content_type"` // web|news|code|academic
}

type SearchResponse struct {
	Query    string           `json:"query"`
	Mode     string           `json:"mode"`
	Results  []retrieval.Doc  `json:"results"`
	Answer   *synthesis.Answer `json:"answer,omitempty"`
	Latency  int64            `json:"latency_ms"`
	Total    int              `json:"total"`
}

func searchHandler(
	qSvc *query.Service,
	retSvc *retrieval.Service,
	rankSvc *ranking.Service,
	synSvc *synthesis.Service,
	citSvc *citation.Service,
	log *zap.Logger,
) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		var req SearchRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if req.Mode == "" {
			req.Mode = "hybrid"
		}
		if req.Page < 1 {
			req.Page = 1
		}

		ctx := c.Request.Context()

		// 1. Normalize + classify intent
		nq, intent := qSvc.Process(ctx, req.Query)

		// 2. Retrieve
		docs, err := retSvc.Search(ctx, nq, req.Page, req.Filters.TimeRange, req.Filters.ContentType)
		if err != nil {
			log.Error("retrieval failed", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "retrieval failed"})
			return
		}

		// 3. Re-rank
		docs = rankSvc.Rerank(ctx, docs, nq, intent)

		resp := SearchResponse{
			Query:   req.Query,
			Mode:    req.Mode,
			Results: docs,
			Total:   len(docs),
		}

		// 4. AI synthesis (ai + hybrid modes)
		if req.Mode == "ai" || req.Mode == "hybrid" {
			answer, err := synSvc.Synthesize(ctx, nq, docs)
			if err != nil {
				log.Warn("synthesis failed, falling back", zap.Error(err))
			} else {
				answer.Citations = citSvc.Map(answer.Text, docs)
				resp.Answer = answer
			}
		}

		// Classic mode strips answer
		if req.Mode == "classic" {
			resp.Answer = nil
		}

		resp.Latency = time.Since(start).Milliseconds()
		c.JSON(http.StatusOK, resp)
	}
}

func feedbackHandler(fbSvc *feedback.Service, log *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req feedback.FeedbackRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if err := fbSvc.Record(c.Request.Context(), req); err != nil {
			log.Error("feedback record failed", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "recorded"})
	}
}

func sourceHandler(retSvc *retrieval.Service, log *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		doc, err := retSvc.GetByID(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "source not found"})
			return
		}
		c.JSON(http.StatusOK, doc)
	}
}

func historyHandler(fbSvc *feedback.Service, log *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionID := c.Query("session_id")
		history, err := fbSvc.GetHistory(c.Request.Context(), sessionID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"history": history})
	}
}

func modeHandler(log *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Mode      string `json:"mode" binding:"required"`
			SessionID string `json:"session_id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		valid := map[string]bool{"classic": true, "ai": true, "hybrid": true}
		if !valid[req.Mode] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid mode"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"mode": req.Mode, "session_id": req.SessionID})
	}
}
