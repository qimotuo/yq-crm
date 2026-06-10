-- PostgreSQL 首次启动脚本（仅在新数据卷时执行一次）
-- 业务表结构与种子数据由 API 启动时自动创建（app/db/init_db.py + seed.py）

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
