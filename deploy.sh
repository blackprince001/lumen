#!/usr/bin/env bash
# Pull the latest code and rebuild the production stack.
#
#   ./deploy.sh                      run on the server, from the repo checkout
#   ./deploy.sh <ssh-host> [dir]     run from your machine; dir defaults to ~/lumen
#
# Uses docker-compose.tunnel.yml when CLOUDFLARE_TUNNEL_TOKEN is set in .env,
# otherwise the plain Traefik + Let's Encrypt setup.
set -euo pipefail

if [ $# -ge 1 ]; then
  exec ssh "$1" "cd ${2:-lumen} && ./deploy.sh"
fi

# Everything runs inside main so `git pull` can safely rewrite this file.
main() {
  cd "$(dirname "$0")"

  if [ ! -f .env ]; then
    echo "deploy: no .env here. Copy .env.example to .env and fill it in." >&2
    exit 1
  fi

  local files=(-f docker-compose.prod.yml)
  if grep -q '^CLOUDFLARE_TUNNEL_TOKEN=.' .env; then
    files+=(-f docker-compose.tunnel.yml)
  fi

  git pull --ff-only
  mkdir -p backend/storage letsencrypt
  docker compose "${files[@]}" up -d --build --remove-orphans
  docker image prune -f >/dev/null

  echo "deploy: waiting for the backend health check..."
  for _ in $(seq 1 30); do
    if docker compose "${files[@]}" exec -T backend python -c \
      "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" 2>/dev/null; then
      echo "deploy: $(git rev-parse --short HEAD) is live"
      exit 0
    fi
    sleep 5
  done

  echo "deploy: backend never became healthy. Check: docker compose ${files[*]} logs backend" >&2
  exit 1
}

main "$@"
