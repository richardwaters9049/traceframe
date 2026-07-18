.PHONY: build down logs status test up

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

test:
	cd apps/web && bun run lint && bun test && bun run build
	services/worker/.venv/bin/python -m compileall -q services/worker/src
