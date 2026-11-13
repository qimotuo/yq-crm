#!/usr/bin/env bash
set -euo pipefail
# 数据库：首次部署执行一次，发版不需要动
# 用法: ./db.sh up | down | restart | status | logs | reset

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/_lib.sh"

COMPOSE=(docker compose -f "$DEPLOY_DIR/docker-compose.db.yml")

cmd_up() {
  require_docker
  load_env
  info "启动 PostgreSQL..."
  "${COMPOSE[@]}" up -d
  wait_db 60 || warn "数据库健康检查超时"
  info "数据库已就绪（数据保存在 pgdata 卷，重启不会清空）"
}

cmd_down() {
  require_docker
  load_env
  "${COMPOSE[@]}" stop
  info "数据库已停止（数据卷保留）"
}

cmd_restart() {
  require_docker
  load_env
  "${COMPOSE[@]}" restart
  wait_db 60 || true
  info "数据库已重启"
}

cmd_status() {
  require_docker
  "${COMPOSE[@]}" ps
}

cmd_logs() {
  require_docker
  "${COMPOSE[@]}" logs -f "${1:-db}"
}

cmd_reset() {
  require_docker
  load_env
  warn "将删除全部数据库数据！"
  read -r -p "确认继续？[y/N] " ans
  if [[ "${ans:-}" != "y" && "${ans:-}" != "Y" ]]; then
    info "已取消"
    exit 0
  fi
  "${COMPOSE[@]}" down -v
  info "数据卷已删除，执行 ./db.sh up 重新初始化"
}

usage() {
  cat <<'EOF'
数据库脚本（通常只需首次执行 ./db.sh up）

  up        启动数据库
  down      停止数据库（数据保留）
  restart   重启数据库
  status    查看状态
  logs      查看日志
  reset     清空数据重建（慎用）
EOF
}

case "${1:-up}" in
  up|start)   cmd_up ;;
  down|stop)  cmd_down ;;
  restart)    cmd_restart ;;
  status)     cmd_status ;;
  logs)       cmd_logs "${2:-}" ;;
  reset)      cmd_reset ;;
  help|-h)    usage ;;
  *) err "未知命令: $1"; usage; exit 1 ;;
esac
