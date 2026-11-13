#!/usr/bin/env bash
# 入口提示，实际请用三个独立脚本

cat <<'EOF'
yq-crm 部署脚本（已拆分为 3 个）：

  首次部署（按顺序执行一次）:
    ./db.sh up        # 数据库
    ./app.sh up       # 前端 + 后端
    ./nginx.sh up     # 外部 nginx（SSL）

  日常发版（只执行这个）:
    ./app.sh deploy        # 前后端都发
    ./app.sh deploy web    # 只发前端（快）
    ./app.sh deploy api    # 只发后端

  其他:
    ./db.sh status | ./app.sh status | ./nginx.sh status
    ./nginx.sh reload  # 改了 nginx 配置后重载

详细帮助: ./db.sh help | ./app.sh help | ./nginx.sh help
EOF
