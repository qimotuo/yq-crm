#!/usr/bin/env bash
set -euo pipefail
# 外部 Nginx（SSL 反代）：首次部署执行一次
# 用法: ./nginx.sh up | down | restart | status | logs | reload

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/_lib.sh"

NGINX_NAME="${NGINX_CONTAINER:-nginx}"
CONF_DIR="${NGINX_CONF_DIR:-/data/apps/nginx/conf}"
HTML_DIR="${NGINX_HTML_DIR:-/data/apps/nginx/html}"
LOG_DIR="${NGINX_LOG_DIR:-/data/apps/nginx/logs}"
CERT_DIR="${NGINX_CERT_DIR:-/data/apps/nginx/certs}"

ensure_dirs() {
  mkdir -p "$CONF_DIR" "$HTML_DIR/official" "$LOG_DIR" "$CERT_DIR"
  if [[ ! -f "$CONF_DIR/qimotuo.conf" && -f "$DEPLOY_DIR/nginx.proxy.conf" ]]; then
    cp "$DEPLOY_DIR/nginx.proxy.conf" "$CONF_DIR/qimotuo.conf"
    info "已生成 $CONF_DIR/qimotuo.conf"
  fi
  if [[ ! -f "$HTML_DIR/official/index.html" && -f "$DEPLOY_DIR/www/index.html" ]]; then
    cp "$DEPLOY_DIR/www/index.html" "$HTML_DIR/official/"
    info "已复制官网首页"
  fi
}

nginx_run() {
  docker rm -f "$NGINX_NAME" 2>/dev/null || true
  docker run -d \
    --name "$NGINX_NAME" \
    --restart=always \
    --network host \
    -v "$CONF_DIR:/etc/nginx/conf.d" \
    -v "$HTML_DIR:/usr/share/nginx/html" \
    -v "$LOG_DIR:/var/log/nginx" \
    -v "$CERT_DIR:/etc/nginx/certs:ro" \
    nginx:latest
}

cmd_up() {
  require_docker
  load_env
  ensure_dirs
  if docker ps --format '{{.Names}}' | grep -qx "$NGINX_NAME"; then
    info "nginx 已在运行"
    return 0
  fi
  info "启动外部 nginx..."
  nginx_run
  docker exec "$NGINX_NAME" nginx -t
  info "nginx 已就绪（https://qimotuo.cn/crm/）"
}

cmd_down() {
  require_docker
  docker stop "$NGINX_NAME" 2>/dev/null || true
  info "nginx 已停止"
}

cmd_restart() {
  require_docker
  load_env
  if docker ps -a --format '{{.Names}}' | grep -qx "$NGINX_NAME"; then
    docker restart "$NGINX_NAME"
    docker exec "$NGINX_NAME" nginx -t
  else
    cmd_up
  fi
  info "nginx 已重启"
}

cmd_reload() {
  require_docker
  docker exec "$NGINX_NAME" nginx -t
  docker exec "$NGINX_NAME" nginx -s reload
  info "nginx 配置已重载"
}

cmd_status() {
  require_docker
  if docker ps --format '{{.Names}}\t{{.Status}}' | grep "$NGINX_NAME"; then
    return 0
  fi
  warn "nginx 未运行，执行: ./nginx.sh up"
}

cmd_logs() {
  require_docker
  docker logs -f "$NGINX_NAME"
}

usage() {
  cat <<'EOF'
外部 Nginx 脚本（SSL 反代，通常只需首次 ./nginx.sh up）

  up        启动 nginx
  down      停止 nginx
  restart   重启 nginx
  reload    重载配置（改完 qimotuo.conf 后执行）
  status    查看状态
  logs      查看日志
EOF
}

case "${1:-up}" in
  up|start)   cmd_up ;;
  down|stop)  cmd_down ;;
  restart)    cmd_restart ;;
  reload)     cmd_reload ;;
  status)     cmd_status ;;
  logs)       cmd_logs ;;
  help|-h)    usage ;;
  *) err "未知命令: $1"; usage; exit 1 ;;
esac
