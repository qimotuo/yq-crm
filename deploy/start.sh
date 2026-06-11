#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DEPLOY_DIR"

COMPOSE_FILE="docker-compose.yml"
MODE="app"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[yq-crm]${NC} $*"; }
warn() { echo -e "${YELLOW}[yq-crm]${NC} $*"; }
err() { echo -e "${RED}[yq-crm]${NC} $*" >&2; }

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    err "未找到 docker，请先安装 Docker Desktop"
    exit 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    err "未找到 docker compose，请升级 Docker"
    exit 1
  fi
}

load_env() {
  if [[ ! -f .env ]]; then
    cp .env.example .env
    warn "已生成 deploy/.env，请修改 DATABASE_URL 后重新执行"
  fi
  # shellcheck disable=SC1091
  set -a && source .env && set +a
  if [[ "$MODE" == "app" && -z "${DATABASE_URL:-}" ]]; then
    err "请在 deploy/.env 中配置 DATABASE_URL（指向已有 PostgreSQL）"
    exit 1
  fi
}

wait_healthy() {
  local service="$1"
  local max="${2:-60}"
  local i=0
  while (( i < max )); do
    if docker compose -f "$COMPOSE_FILE" ps --format json "$service" 2>/dev/null | grep -q '"Health":"healthy"'; then
      return 0
    fi
    if docker compose -f "$COMPOSE_FILE" ps --status running --format '{{.Service}}' | grep -qx "$service"; then
      if ! docker compose -f "$COMPOSE_FILE" ps --format json "$service" 2>/dev/null | grep -q '"Health"'; then
        return 0
      fi
    fi
    sleep 2
    (( i += 2 )) || true
  done
  return 1
}

pull_base_images() {
  local images
  if [[ "$MODE" == "full" ]]; then
    images=(postgres:16-alpine python:3.11-slim-bookworm node:20-alpine nginx:1.27-alpine)
  else
    images=(python:3.11-slim-bookworm node:20-alpine nginx:1.27-alpine)
  fi
  info "预拉取基础镜像..."
  for img in "${images[@]}"; do
    local attempt=1
    while (( attempt <= 3 )); do
      if docker pull "$img"; then
        info "  ✓ $img"
        break
      fi
      warn "  拉取 $img 失败 ($attempt/3)，3 秒后重试..."
      sleep 3
      (( attempt += 1 )) || true
    done
    if (( attempt > 3 )); then
      err "拉取 $img 失败，请检查网络或配置镜像加速"
      exit 1
    fi
  done
}

compose_up_build() {
  if docker compose -f "$COMPOSE_FILE" up --build -d; then
    return 0
  fi
  warn "构建失败，清理缓存后重试..."
  docker builder prune -f >/dev/null 2>&1 || true
  docker compose -f "$COMPOSE_FILE" build --pull
  docker compose -f "$COMPOSE_FILE" up -d
}

print_access() {
  local web_port="${WEB_PORT:-5173}"
  local api_port="${API_PORT:-5172}"
  echo ""
  info "部署完成（API + Web）"
  echo "  前端访问: http://localhost:${web_port}"
  echo "  后端 API:  http://localhost:${api_port}"
  echo "  API 文档:  http://localhost:${api_port}/docs"
  echo "  测试账号:  admin / 123456"
  echo ""
  if [[ "$MODE" == "app" ]]; then
    echo "  数据库:    使用外部 PostgreSQL"
    echo "             ${DATABASE_URL%%@*}@***"
  fi
  echo ""
}

cmd_up() {
  require_docker
  load_env
  pull_base_images
  if [[ "$MODE" == "full" ]]; then
    info "构建并启动（PostgreSQL + API + Web）..."
  else
    info "构建并启动（API + Web，连接外部数据库）..."
  fi
  compose_up_build

  info "等待服务就绪..."
  if [[ "$MODE" == "full" ]]; then
    wait_healthy db 60 || warn "数据库健康检查超时，请执行 ./start.sh logs db"
  fi
  wait_healthy api 90 || warn "API 未就绪，请执行 ./start.sh logs api"

  print_access
}

cmd_down() {
  require_docker
  load_env
  docker compose -f "$COMPOSE_FILE" down
  info "已停止容器"
}

cmd_restart() {
  require_docker
  load_env
  docker compose -f "$COMPOSE_FILE" down
  compose_up_build
  wait_healthy api 90 || true
  print_access
}

cmd_reset() {
  require_docker
  load_env
  if [[ "$MODE" == "full" ]]; then
    warn "将删除 PostgreSQL 数据卷并重新初始化"
    read -r -p "确认继续？[y/N] " ans
    if [[ "${ans:-}" != "y" && "${ans:-}" != "Y" ]]; then
      info "已取消"
      exit 0
    fi
    docker compose -f "$COMPOSE_FILE" down -v
  else
    warn "外部数据库不会被清空，仅重建 API/Web 容器"
    docker compose -f "$COMPOSE_FILE" down
  fi
  pull_base_images
  compose_up_build
  wait_healthy api 90 || true
  print_access
}

cmd_logs() {
  require_docker
  load_env
  if [[ -n "${1:-}" ]]; then
    docker compose -f "$COMPOSE_FILE" logs -f "$1"
  else
    docker compose -f "$COMPOSE_FILE" logs -f
  fi
}

cmd_status() {
  require_docker
  load_env
  docker compose -f "$COMPOSE_FILE" ps
}

usage() {
  cat <<'EOF'
用法: ./start.sh [命令]

默认只部署 API + Web，连接已有 PostgreSQL（在 .env 配 DATABASE_URL）

命令:
  up|start      构建并启动（默认）
  down|stop     停止容器
  restart       重启 API + Web
  reset         重建容器（外部库不清空）
  logs [svc]    查看日志（api / web）
  status        容器状态
  full [cmd]    本地全套含 PG，如: ./start.sh full up
  help          显示帮助

DATABASE_URL 示例:
  本机数据库:  postgresql://user:pass@host.docker.internal:5432/yq_crm
  云数据库:    postgresql://user:pass@rm-xxx.pg.rds.aliyuncs.com:5432/yq_crm
  同网容器:    postgresql://user:pass@pg容器名:5432/yq_crm
EOF
}

main() {
  local cmd="${1:-up}"

  if [[ "$cmd" == "full" ]]; then
    MODE="full"
    COMPOSE_FILE="docker-compose.full.yml"
    cmd="${2:-up}"
  fi

  case "$cmd" in
    up|start) cmd_up ;;
    down|stop) cmd_down ;;
    restart) cmd_restart ;;
    reset) cmd_reset ;;
    logs) cmd_logs "${2:-}" ;;
    status) cmd_status ;;
    help|-h|--help) usage ;;
    *)
      err "未知命令: $cmd"
      usage
      exit 1
      ;;
  esac
}

main "$@"
