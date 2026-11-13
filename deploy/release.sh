#!/usr/bin/env bash
# 无 git 发版：解压 /opt/yq-crm.tar.gz → 保留配置 → 构建启动
# 用法（服务器上只需这一条）:
#   /opt/yq-crm/deploy/release.sh

set -euo pipefail

PKG="/opt/yq-crm.tar.gz"
TARGET="/opt/yq-crm"
ENV_BACKUP="/tmp/yq-crm.env.bak"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}[release]${NC} $*"; }
warn() { echo -e "${YELLOW}[release]${NC} $*"; }
err()  { echo -e "${RED}[release]${NC} $*" >&2; }

[[ -f "$PKG" ]] || { err "找不到 $PKG，请先上传压缩包"; exit 1; }

TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

info "解压 $PKG ..."
tar xzf "$PKG" -C "$TMP"

SRC=""
if [[ -d "$TMP/yq-crm" ]]; then
  SRC="$TMP/yq-crm"
elif [[ -f "$TMP/deploy/app.sh" ]]; then
  SRC="$TMP"
else
  err "压缩包结构不对，根目录应为 yq-crm/"
  exit 1
fi

if [[ -f "$TARGET/deploy/.env" ]]; then
  cp "$TARGET/deploy/.env" "$ENV_BACKUP"
  info "已备份 deploy/.env"
fi

mkdir -p "$TARGET"
info "同步到 $TARGET ..."
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete \
    --exclude 'deploy/.env' \
    --exclude 'deploy/data/' \
    "$SRC/" "$TARGET/"
else
  shopt -s dotglob
  for item in "$SRC"/*; do
    name="$(basename "$item")"
    [[ "$name" == "deploy" ]] && continue
    rm -rf "$TARGET/$name"
    cp -a "$item" "$TARGET/"
  done
  mkdir -p "$TARGET/deploy"
  for item in "$SRC/deploy"/*; do
    name="$(basename "$item")"
    [[ "$name" == ".env" ]] && continue
    rm -rf "$TARGET/deploy/$name"
    cp -a "$item" "$TARGET/deploy/"
  done
  shopt -u dotglob
fi

if [[ -f "$ENV_BACKUP" ]]; then
  cp "$ENV_BACKUP" "$TARGET/deploy/.env"
  info "已恢复 deploy/.env"
elif [[ ! -f "$TARGET/deploy/.env" ]]; then
  cp "$TARGET/deploy/.env.example" "$TARGET/deploy/.env"
  warn "已生成 deploy/.env，请检查 JWT_SECRET_KEY"
fi

# 修正端口：web 容器不能占 80/443，由外部 nginx 反代
fix_env_ports() {
  local env_file="$TARGET/deploy/.env"
  [[ -f "$env_file" ]] || return 0
  local web_port api_port
  web_port="$(grep -E '^WEB_HTTP_PORT=' "$env_file" | cut -d= -f2- || true)"
  api_port="$(grep -E '^API_PORT=' "$env_file" | cut -d= -f2- || true)"
  case "$web_port" in
    80|443|0.0.0.0:80|0.0.0.0:443|"" )
      sed -i 's/^WEB_HTTP_PORT=.*/WEB_HTTP_PORT=127.0.0.1:5173/' "$env_file" 2>/dev/null \
        || sed -i '' 's/^WEB_HTTP_PORT=.*/WEB_HTTP_PORT=127.0.0.1:5173/' "$env_file"
      grep -q '^WEB_HTTP_PORT=' "$env_file" || echo 'WEB_HTTP_PORT=127.0.0.1:5173' >> "$env_file"
      warn "WEB_HTTP_PORT 已自动改为 127.0.0.1:5173"
      ;;
  esac
  case "$api_port" in
    80|443|0.0.0.0:80|"" )
      sed -i 's/^API_PORT=.*/API_PORT=127.0.0.1:5172/' "$env_file" 2>/dev/null \
        || sed -i '' 's/^API_PORT=.*/API_PORT=127.0.0.1:5172/' "$env_file"
      grep -q '^API_PORT=' "$env_file" || echo 'API_PORT=127.0.0.1:5172' >> "$env_file"
      warn "API_PORT 已自动改为 127.0.0.1:5172"
      ;;
    *:5172 ) ;;
    * )
      if [[ "$api_port" != *:* ]]; then
        sed -i "s/^API_PORT=.*/API_PORT=127.0.0.1:${api_port}/" "$env_file" 2>/dev/null \
          || sed -i '' "s/^API_PORT=.*/API_PORT=127.0.0.1:${api_port}/" "$env_file"
        warn "API_PORT 已自动改为 127.0.0.1:${api_port}"
      fi
      ;;
  esac
}
fix_env_ports

fix_upload_dir() {
  local env_file="$TARGET/deploy/.env"
  local current="" old="$TARGET/deploy/data/uploads" dest="/data/yq-crm/uploads"
  [[ -f "$env_file" ]] || return 0
  current="$(grep -E '^HOST_UPLOAD_DIR=' "$env_file" | tail -1 | cut -d= -f2- || true)"
  case "$current" in
    /*) dest="$current" ;;
    *)
      if grep -q '^HOST_UPLOAD_DIR=' "$env_file"; then
        sed -i 's|^HOST_UPLOAD_DIR=.*|HOST_UPLOAD_DIR=/data/yq-crm/uploads|' "$env_file" 2>/dev/null \
          || sed -i '' 's|^HOST_UPLOAD_DIR=.*|HOST_UPLOAD_DIR=/data/yq-crm/uploads|' "$env_file"
      else
        echo 'HOST_UPLOAD_DIR=/data/yq-crm/uploads' >> "$env_file"
      fi
      info "HOST_UPLOAD_DIR 已设为 /data/yq-crm/uploads"
      ;;
  esac
  mkdir -p "$dest"
  if [[ -d "$old" && -n "$(ls -A "$old" 2>/dev/null || true)" && -z "$(ls -A "$dest" 2>/dev/null || true)" ]]; then
    cp -a "$old/." "$dest/"
    info "已把原上传文件迁到 $dest"
  fi
}
fix_upload_dir

chmod +x "$TARGET"/deploy/*.sh
info "构建并启动 ..."
cd "$TARGET/deploy"
./app.sh deploy

if docker ps --format '{{.Names}}' | grep -qx nginx; then
  ./nginx.sh reload 2>/dev/null || true
fi

info "完成 → https://qimotuo.cn/crm/"
