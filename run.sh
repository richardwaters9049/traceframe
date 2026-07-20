#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
COMPOSE_FILE="$PROJECT_DIR/compose.yaml"
HEALTH_URL="http://127.0.0.1:3000/api/health"
APP_URL="http://127.0.0.1:3000"
NO_BUILD=0

TERMINAL_WIDTH="${COLUMNS:-}"
if [[ ! "$TERMINAL_WIDTH" =~ ^[0-9]+$ ]] && command -v tput >/dev/null 2>&1; then
  TERMINAL_WIDTH=$(tput cols 2>/dev/null || true)
fi
if [[ ! "$TERMINAL_WIDTH" =~ ^[0-9]+$ ]]; then
  TERMINAL_WIDTH=88
fi
if (( TERMINAL_WIDTH < 40 )); then
  TERMINAL_WIDTH=40
elif (( TERMINAL_WIDTH > 100 )); then
  TERMINAL_WIDTH=100
fi
readonly TERMINAL_WIDTH

if [[ -t 1 && "${TERM:-dumb}" != "dumb" && -z "${NO_COLOR:-}" ]]; then
  readonly INTERACTIVE_UI=1
  readonly RESET=$'\033[0m'
  readonly BOLD=$'\033[1m'
  readonly CYAN=$'\033[38;5;45m'
  readonly BLUE=$'\033[38;5;39m'
  readonly GREEN=$'\033[38;5;42m'
  readonly YELLOW=$'\033[38;5;220m'
  readonly RED=$'\033[38;5;196m'
else
  readonly INTERACTIVE_UI=0
  readonly RESET=''
  readonly BOLD=''
  readonly CYAN=''
  readonly BLUE=''
  readonly GREEN=''
  readonly YELLOW=''
  readonly RED=''
fi

ui_wrapped() {
  local prefix="$1"
  local colour="$2"
  local message="$3"
  local available_width=$((TERMINAL_WIDTH - ${#prefix}))
  local continuation
  local first_line=1
  local line

  if (( available_width < 20 )); then
    available_width=20
  fi
  continuation=$(printf '%*s' "${#prefix}" '')

  while IFS= read -r line || [[ -n "$line" ]]; do
    if (( first_line == 1 )); then
      printf '%s%s%s%s\n' "$colour" "$prefix" "$line" "$RESET"
      first_line=0
    else
      printf '%s%s%s%s\n' "$colour" "$continuation" "$line" "$RESET"
    fi
  done < <(printf '%s\n' "$message" | fold -s -w "$available_width")
}

ui_info() {
  ui_wrapped 'ℹ  ' "$BLUE" "$*"
}

ui_success() {
  ui_wrapped '✓  ' "$GREEN" "$*"
}

ui_warning() {
  ui_wrapped '!  ' "$YELLOW" "$*"
}

ui_error() {
  ui_wrapped '✕  ' "$RED" "$*" >&2
}

terminal_link() {
  local label="$1"
  local destination="$2"
  if (( INTERACTIVE_UI == 1 )); then
    printf '\033]8;;%s\033\\\033[4;38;5;45m%s\033[0m\033]8;;\033\\' \
      "$destination" "$label"
  else
    printf '%s' "$destination"
  fi
}

run_with_spinner() {
  local label="$1"
  shift

  if (( INTERACTIVE_UI == 0 )); then
    "$@"
    return
  fi

  local log_file
  local process_id
  local frame_index=0
  local status
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  log_file=$(mktemp "${TMPDIR:-/tmp}/traceframe-start.XXXXXX")

  "$@" >"$log_file" 2>&1 &
  process_id=$!

  while kill -0 "$process_id" 2>/dev/null; do
    printf '\r%s%s %s…%s' "$CYAN" "${frames[$frame_index]}" "$label" "$RESET"
    frame_index=$(((frame_index + 1) % ${#frames[@]}))
    sleep 0.1
  done

  if wait "$process_id"; then
    status=0
  else
    status=$?
  fi

  printf '\r\033[2K'
  if (( status == 0 )); then
    ui_success "$label complete"
  else
    ui_error "$label failed"
    sed 's/^/   /' "$log_file" >&2
  fi
  rm -f -- "$log_file"
  return "$status"
}

compose() {
  docker compose --project-directory "$PROJECT_DIR" -f "$COMPOSE_FILE" "$@"
}

start_environment() {
  if (( NO_BUILD == 1 )); then
    compose up -d --wait
  else
    compose up -d --build --wait
  fi
}

check_health() {
  curl --fail --silent --show-error --max-time 10 "$HEALTH_URL" >/dev/null
}

usage() {
  cat <<'EOF'
Usage: ./run.sh [--no-build]

Start the complete local Traceframe environment and wait for it to become
healthy. By default, service images are rebuilt before startup.

Options:
  --no-build  Start existing service images without rebuilding them.
  -h, --help  Show this help.
EOF
}

while (( $# > 0 )); do
  case "$1" in
    --no-build)
      NO_BUILD=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      ui_error "Unknown argument: $1"
      usage >&2
      exit 2
      ;;
  esac
done

printf '\n%s%sTRACEFRAME%s\n' "$BOLD" "$CYAN" "$RESET"
ui_wrapped '   ' "$BLUE" \
  'Synthetic incident analysis • verifiable audit history • secure local workspace'
printf '\n'

if [[ ! -r "$COMPOSE_FILE" ]]; then
  ui_error "Compose configuration not found: $COMPOSE_FILE"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  ui_error 'Docker is required. Install Docker Desktop and try again.'
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  ui_error 'Docker is installed but its daemon is unavailable. Start Docker Desktop and try again.'
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  ui_error 'curl is required for the application health check.'
  exit 1
fi

if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  if [[ ! -r "$PROJECT_DIR/.env.example" ]]; then
    ui_error '.env is missing and .env.example is unavailable.'
    exit 1
  fi
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
  ui_info 'Created .env from the local development template.'
fi

if (( NO_BUILD == 1 )); then
  ui_info 'Starting the existing Traceframe service images.'
else
  ui_info 'Building and starting the complete Traceframe environment.'
fi

run_with_spinner 'Starting services and applying migrations' start_environment
run_with_spinner 'Confirming application health' check_health

printf '\n%s%sServices%s\n' "$BOLD" "$CYAN" "$RESET"
compose ps

printf '\n%s%sTraceframe is ready%s\n\n' "$BOLD" "$GREEN" "$RESET"
printf '   Application  '
terminal_link 'Open Traceframe' "$APP_URL"
printf '\n'
printf '   MinIO        '
terminal_link 'Open local object storage' 'http://127.0.0.1:9001'
printf '\n\n'
ui_info 'Sign in with the synthetic demo credentials documented in README.md or configured in .env.'
ui_warning 'When finished, stop the environment without deleting its data: make down'
printf '\n'
