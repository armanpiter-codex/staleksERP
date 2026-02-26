.PHONY: up down logs migrate seed seed-configurator seed-test shell-backend shell-db test reset build \
       prod-build prod-up prod-down prod-logs prod-migrate prod-seed prod-seed-configurator prod-reset prod-ps prod-shell

# Start all services
up:
	docker compose up -d

# Stop all services
down:
	docker compose down

# Build images
build:
	docker compose build

# Show backend logs (follow)
logs:
	docker compose logs -f backend

# Run database migrations
migrate:
	docker compose exec backend alembic upgrade head

# Seed database with initial data (roles, permissions, owner user)
seed:
	docker compose exec backend python -m app.scripts.seed_db

# Seed configurator fields, visibility rules
seed-configurator:
	docker compose exec backend python -m app.scripts.seed_configurator

# Seed pricing rules, material norms, test configuration
seed-test:
	docker compose exec backend python -m app.scripts.seed_test_data

# Open backend shell
shell-backend:
	docker compose exec backend bash

# Open PostgreSQL shell
shell-db:
	docker compose exec postgres psql -U $$POSTGRES_USER -d $$POSTGRES_DB

# Run tests
test:
	docker compose exec backend pytest tests/ -v

# Full reset: destroy volumes, recreate, migrate, seed
reset:
	docker compose down -v
	docker compose up -d
	@echo "Waiting for services to be healthy..."
	@sleep 10
	docker compose exec backend alembic upgrade head
	docker compose exec backend python -m app.scripts.seed_db
	docker compose exec backend python -m app.scripts.seed_configurator
	@echo "Reset complete!"

# Show all running containers
ps:
	docker compose ps

# Show backend logs (last 100 lines)
logs-tail:
	docker compose logs --tail=100 backend

# ── Production commands ───────────────────────────────────────────────────────
PROD_COMPOSE = docker compose -f docker-compose.prod.yml

# Build production images
prod-build:
	$(PROD_COMPOSE) build

# Start production stack
prod-up:
	$(PROD_COMPOSE) up -d

# Stop production stack
prod-down:
	$(PROD_COMPOSE) down

# Show production logs (follow)
prod-logs:
	$(PROD_COMPOSE) logs -f backend

# Show all production logs
prod-logs-all:
	$(PROD_COMPOSE) logs -f

# Run migrations in production
prod-migrate:
	$(PROD_COMPOSE) exec backend alembic upgrade head

# Seed production database
prod-seed:
	$(PROD_COMPOSE) exec backend python -m app.scripts.seed_db

# Seed configurator in production
prod-seed-configurator:
	$(PROD_COMPOSE) exec backend python -m app.scripts.seed_configurator

# Full production reset (WARNING: destroys data!)
prod-reset:
	$(PROD_COMPOSE) down -v
	$(PROD_COMPOSE) up -d
	@echo "Waiting for services to be healthy..."
	@sleep 15
	$(PROD_COMPOSE) exec backend alembic upgrade head
	$(PROD_COMPOSE) exec backend python -m app.scripts.seed_db
	$(PROD_COMPOSE) exec backend python -m app.scripts.seed_configurator
	@echo "Production reset complete!"

# Show production containers
prod-ps:
	$(PROD_COMPOSE) ps

# Open backend shell in production
prod-shell:
	$(PROD_COMPOSE) exec backend bash
