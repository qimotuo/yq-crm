#!/usr/bin/env bash
set -euo pipefail
# 前端 + 后端：日常发版执行这个
# 用法:
#   ./app.sh deploy          # 发版全部（默认）
#   ./app.sh deploy web      # 只发前端
#   ./app.sh deploy api      # 只发后端
#   ./app.sh deploy all      # 发版全部

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/_lib.sh"

COMPOSE=(docker compose -f "$DEPLOY_DIR/docker-compose.app.yml")

normalize_target() {
  case "${1:-all}" in
    all|both|"") echo "all" ;;
    api|backend|be) echo "api" ;;
    web|frontend|fe) echo "web" ;;
    *)
      err "未知目标: $1（可选: all / api / web）"
      exit 1
      ;;
  esac
}

require_api_running() {
  if ! docker ps --format '{{.Names}}' | grep -qx yq-crm-api; then
    err "API 未运行，请先执行: ./app.sh up api"
    exit 1
  fi
}

print_access() {
  local api_port="${API_PORT:-5172}"
  api_port="${api_port##*:}"
  local web_port="${WEB_HTTP_PORT:-5173}"
  web_port="${web_port##*:}"
  echo ""
  info "应用已就绪"
  echo "  CRM:  https://qimotuo.cn/crm/"
  echo "  H5:   https://qimotuo.cn/h5/"
  echo "  本地: http://127.0.0.1:${web_port}/crm/"
  echo "  API:  http://127.0.0.1:${api_port}/docs"
  echo "  账号: admin / 123456"
  echo ""
}

build_services() {
  local target="$1"
  ensure_network
  case "$target" in
    all)
      info "构建并启动 API + Web..."
      "${COMPOSE[@]}" up --build -d
      ;;
    api)
      info "构建并启动 API..."
      "${COMPOSE[@]}" up --build -d --no-deps api
      ;;
    web)
      require_api_running
      info "构建并启动 Web..."
      "${COMPOSE[@]}" up --build -d --no-deps web
      ;;
  esac
}

deploy_services() {
  local target="$1"
  ensure_network
  case "$target" in
    all)
      info "发版：重建 API + Web..."
      "${COMPOSE[@]}" up -d --build --no-deps api
      "${COMPOSE[@]}" up -d --build --no-deps web
      ;;
    api)
      info "发版：仅重建 API..."
      "${COMPOSE[@]}" up -d --build --no-deps api
      ;;
    web)
      require_api_running
      info "发版：仅重建 Web（较快）..."
      "${COMPOSE[@]}" up -d --build --no-deps web
      require_web_running
      ;;
  esac
}

stop_services() {
  local target="$1"
  case "$target" in
    all) "${COMPOSE[@]}" stop ;;
    api) "${COMPOSE[@]}" stop api ;;
    web) "${COMPOSE[@]}" stop web ;;
  esac
  info "已停止: $target"
}

restart_services() {
  local target="$1"
  case "$target" in
    all) "${COMPOSE[@]}" restart ;;
    api) "${COMPOSE[@]}" restart api ;;
    web) "${COMPOSE[@]}" restart web ;;
  esac
}

cmd_up() {
  local target
  target="$(normalize_target "${1:-all}")"
  require_docker
  load_env
  require_db_running
  build_services "$target"
  if [[ "$target" == "all" || "$target" == "api" ]]; then
    wait_api 90 || warn "API 未就绪，请执行 ./app.sh logs api"
  fi
  print_access
}

cmd_deploy() {
  local target
  target="$(normalize_target "${1:-all}")"
  require_docker
  load_env
  require_db_running
  deploy_services "$target"
  if [[ "$target" == "all" || "$target" == "api" ]]; then
    wait_api 90 || warn "API 未就绪"
  fi
  print_access
}

cmd_down() {
  local target
  target="$(normalize_target "${1:-all}")"
  require_docker
  load_env
  stop_services "$target"
}

cmd_restart() {
  local target
  target="$(normalize_target "${1:-all}")"
  require_docker
  load_env
  require_db_running
  restart_services "$target"
  if [[ "$target" == "all" || "$target" == "api" ]]; then
    wait_api 90 || true
  fi
  print_access
}

cmd_status() {
  require_docker
  "${COMPOSE[@]}" ps
}

cmd_logs() {
  require_docker
  if [[ -n "${1:-}" ]]; then
    "${COMPOSE[@]}" logs -f "$1"
  else
    "${COMPOSE[@]}" logs -f
  fi
}

usage() {
  cat <<'EOF'
应用脚本（前端 + 后端）

发版（日常用这个）:
  deploy           重建全部（默认）
  deploy all       重建全部
  deploy web       只重建前端（快）
  deploy api       只重建后端

其他:
  up [all|api|web]       首次构建启动
  down [all|api|web]     停止
  restart [all|api|web]  重启（不重新构建）
  status                 查看状态
  logs [api|web]         查看日志

示例:
  ./app.sh deploy web    # 只改了前端
  ./app.sh deploy api    # 只改了后端
  ./app.sh deploy        # 前后端都改了
EOF
}

MAIN_CMD="${1:-deploy}"
MAIN_ARG="${2:-all}"

case "$MAIN_CMD" in
  up|start)   cmd_up "$MAIN_ARG" ;;
  deploy)     cmd_deploy "$MAIN_ARG" ;;
  down|stop)  cmd_down "$MAIN_ARG" ;;
  restart)    cmd_restart "$MAIN_ARG" ;;
  status)     cmd_status ;;
  logs)       cmd_logs "${2:-}" ;;
  help|-h)    usage ;;
  *)
    # 支持简写: ./app.sh web  => deploy web
    case "$MAIN_CMD" in
      all|api|web|frontend|fe|backend|be|both)
        cmd_deploy "$(normalize_target "$MAIN_CMD")"
        ;;
      *)
        err "未知命令: $MAIN_CMD"
        usage
        exit 1
        ;;
    esac
    ;;
esac
