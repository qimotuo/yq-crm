#!/usr/bin/env bash
# 公共函数，供 db.sh / app.sh / nginx.sh 引用

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[yq-crm]${NC} $*"; }
warn() { echo -e "${YELLOW}[yq-crm]${NC} $*"; }
err()  { echo -e "${RED}[yq-crm]${NC} $*" >&2; }

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    err "未找到 docker"
    exit 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    err "未找到 docker compose"
    exit 1
  fi
}

load_env() {
  cd "$DEPLOY_DIR"
  if [[ ! -f .env ]]; then
    cp .env.example .env
    warn "已生成 deploy/.env，请修改后重新执行"
    exit 1
  fi
  # shellcheck disable=SC1091
  set -a && source .env && set +a
  validate_app_ports
  mkdir -p "${HOST_UPLOAD_DIR:-/data/yq-crm/uploads}"
}

validate_app_ports() {
  local web_port="${WEB_HTTP_PORT:-127.0.0.1:5173}"
  local api_port="${API_PORT:-127.0.0.1:5172}"
  case "$web_port" in
    80|443|0.0.0.0:80|0.0.0.0:443|[[]::]:80|[[]::]:443)
      err "WEB_HTTP_PORT=$web_port 会与外部 nginx 冲突，请改为 127.0.0.1:5173"
      exit 1
      ;;
  esac
  if [[ "$web_port" != *:* ]]; then
    warn "WEB_HTTP_PORT 建议写成 127.0.0.1:5173（当前: $web_port）"
  fi
  if [[ "$api_port" != *:* ]]; then
    warn "API_PORT 建议写成 127.0.0.1:5172（当前: $api_port）"
  fi
}

wait_db() {
  local max="${1:-60}" i=0
  while (( i < max )); do
    if docker exec yq-crm-db pg_isready -U "${POSTGRES_USER:-yqcrm}" -d "${POSTGRES_DB:-yq_crm}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    (( i += 2 )) || true
  done
  return 1
}

wait_api() {
  local max="${1:-90}" i=0
  while (( i < max )); do
    if curl -sf "http://127.0.0.1:${API_PORT##*:}/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    (( i += 2 )) || true
  done
  return 1
}

require_db_running() {
  if ! docker ps --format '{{.Names}}' | grep -qx yq-crm-db; then
    err "数据库未运行，请先执行: ./db.sh up"
    exit 1
  fi
}

ensure_network() {
  if ! docker network inspect yq-crm_net >/dev/null 2>&1; then
    warn "Docker 网络 yq-crm_net 不存在，正在创建..."
    docker network create yq-crm_net
  fi
  for c in yq-crm-db yq-crm-api yq-crm-web; do
    if ! docker ps --format '{{.Names}}' | grep -qx "$c"; then
      continue
    fi
    if ! docker inspect "$c" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' | grep -qw yq-crm_net; then
      info "将 $c 接入 yq-crm_net..."
      docker network connect yq-crm_net "$c" 2>/dev/null || true
    fi
  done
}

require_web_running() {
  if docker ps --format '{{.Names}}' | grep -qx yq-crm-web; then
    return 0
  fi
  err "Web 未运行"
  if docker ps -a --format '{{.Names}}\t{{.Status}}' | grep yq-crm-web; then
    warn "容器状态见上；日志: ./app.sh logs web"
    docker logs yq-crm-web 2>&1 | tail -30 || true
  else
    warn "未找到 yq-crm-web 容器，构建可能失败，请执行:"
    echo "  docker compose -f deploy/docker-compose.app.yml build web"
  fi
  exit 1
}
