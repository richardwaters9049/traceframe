.PHONY: bootstrap build down logs status test test-integration test-web test-worker up

bootstrap:
	@command -v bun >/dev/null || (echo "Bun is required: https://bun.sh" && exit 1)
	@command -v python3 >/dev/null || (echo "Python 3 is required" && exit 1)
	@command -v docker >/dev/null || (echo "Docker is required" && exit 1)
	@test -f .env || cp .env.example .env
	cd apps/web && bun install --frozen-lockfile
	@test -x services/worker/.venv/bin/python || python3 -m venv services/worker/.venv
	services/worker/.venv/bin/python -m pip install -r services/worker/requirements.txt -r services/worker/requirements-dev.txt

build:
	docker compose build

up:
	docker compose up -d --build --wait

down:
	docker compose down

status:
	docker compose ps

logs:
	docker compose logs --follow

test: test-web test-worker

test-web:
	cd apps/web && bun run lint && bun test && bun run build

test-worker:
	@test -x services/worker/.venv/bin/python || (echo "Run 'make bootstrap' to create the worker environment" && exit 1)
	services/worker/.venv/bin/python -m ruff check services/worker/src services/worker/tests
	services/worker/.venv/bin/python -m pytest -q services/worker/tests
	services/worker/.venv/bin/python -m compileall -q services/worker/src

test-integration:
	docker compose up -d --build --wait
	docker compose ps
	curl -fsS http://127.0.0.1:3000/api/health
	cd apps/web && bun run test:e2e
