.PHONY: dev api web db migrate docker-up docker-down lint

# Start API dev server
api:
	go run ./cmd/api

# Start frontend dev server
web:
	cd frontend && npm run dev

# Start both (requires tmux or run in two terminals)
dev:
	@echo "Run 'make api' in one terminal, 'make web' in another"

# Apply DB schema
migrate:
	psql $$PG_DSN -f infra/schema.sql

# Docker full stack
docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

# Lint
lint:
	golangci-lint run ./...
	cd frontend && npm run lint

# Tidy Go deps
tidy:
	go mod tidy

# Build API binary
build:
	CGO_ENABLED=0 go build -ldflags="-w -s" -o bin/titan-search-api ./cmd/api

.DEFAULT_GOAL := dev
