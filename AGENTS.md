# AGENTS.md — yq-crm 项目 AI 协作指南

宽带 / 物联网设备 CRM：销售、安装、运维、财务一体化。Monorepo：`web/`（React）+ `service/`（FastAPI）。

## 项目现状

| 模块 | 状态 |
|------|------|
| 前端 20+ 页面 | 完整 Demo，默认 Mock 模式 |
| RBAC | 菜单 / 操作 / 数据权限，前后端配置需对齐 |
| 后端 API | 部分已实现（auth、dashboard、work-orders、agent） |
| 数据层 | 内存 Store，规划 PostgreSQL |
| AI 智能体 | `service/app/agents/`，当前 Demo 规则回复 |

## 目录结构

```
yq-crm/
├── web/src/
│   ├── api/           # request 封装 + Mock 注册（index.js / workOrder.js / rbac.js）
│   ├── pages/         # 业务页面
│   ├── components/    # 公共组件（Permission、RequireAuth 等）
│   ├── layouts/       # MainLayout 侧边栏
│   ├── store/         # Redux authSlice
│   ├── rbac/          # config.js 菜单与操作权限
│   ├── mock/data.js   # Mock 种子数据
│   └── hooks/         # useAuth
├── service/app/
│   ├── main.py        # FastAPI 入口
│   ├── api/           # 路由
│   ├── services/      # 业务逻辑
│   ├── data/          # store.py 内存数据、rbac.py
│   ├── agents/        # AI 智能体
│   ├── core/          # config、response、exceptions
│   └── schemas/       # Pydantic 模型
├── docs/              # 需求文档
└── .cursor/rules/     # Cursor 规则（crmProject.mdc：中文回复）
```

## 启动命令

```bash
# 仅前端 Mock（默认，无需后端）
cd web && npm install && npm run dev   # http://localhost:5173

# 后端
cd service && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000   # /docs  Swagger

# 联调：web/.env.development 设 VITE_USE_MOCK=false
```

测试账号：`admin/123456`（管理员）、`zhangsan/123456`（销售）、`zhaoyun/123456`（安装）、`finance/123456`（财务）。

## 核心业务流

公海领取 → 我的客户跟进 → 销售建工单 → 管理员派工 → 安装登记（MAC/IMEI/SIM）→ 设备出库 → 财务回款 → 合同/追溯

## 编码约定

### 前端（web/）

- React 18 + Vite 5 + Ant Design 6 + Redux Toolkit + React Router 7
- 接口统一走 `web/src/api/request.js`：`request(url, options)` 返回 `data` 字段
- Mock：`registerMock(method, path, handler)` 在 `api/index.js` 等文件注册；`VITE_USE_MOCK !== 'false'` 时走 Mock
- 新增页面：`pages/` 建组件 → `App.jsx` 注册路由 + `RequireMenu` 守卫 → `rbac/config.js` 的 `MENU_TREE` 加菜单 key
- 按钮权限：`<Permission code="workorder:create">` 包裹按钮
- 数据权限：`ALL` / `SELF` / `ASSIGNED` / `DEPT`，登录时写入 Redux `permissions`
- 样式与现有页面保持一致，避免引入新 UI 框架

### 后端（service/）

- Python 3.11+，FastAPI + Pydantic + Uvicorn
- 统一响应：`{ "code": 200, "message": "ok", "data": {} }`，用 `core/response.py` 的 `ok()` / `fail()`
- 业务异常抛 `BizError`，由全局 handler 转 JSON
- 路由前缀 `/api`，在 `main.py` 通过 `settings.api_prefix` 挂载
- 新增接口：`services/` 写逻辑 → `api/` 写路由 → 必要时在 `main.py` 注册 router
- 前端 Mock 保留至接口稳定，再切 `VITE_USE_MOCK=false` 验证

### API 路径对齐

前端 `request('/work-orders')` 对应后端 `@router` 在 `/work-orders` 下。已实现后端接口见根目录 `README.md` 第 7 节；其余仍在 `web/src/api/index.js` Mock 层。

## 常见任务指引

### 新增前端页面

1. `web/src/pages/XxxList.jsx`
2. `App.jsx` 加 `<Route>` + `<Guard path="...">`
3. `rbac/config.js` → `MENU_TREE` 增加 key
4. `api/index.js` 注册 Mock；若后端已有接口，页面直接 `request()` 调用

### 迁移 Mock 到后端

1. 对照 `api/index.js` 中 Mock 的路径与返回结构
2. 在 `service/app/services/` 实现同等逻辑
3. `service/app/data/store.py` 或未来 DB 层读写数据
4. 前端 `VITE_USE_MOCK=false` 联调

### 扩展 AI 智能体

- 入口：`service/app/api/agent.py` → `agents/assistant.py`
- 环境变量：`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`AGENT_MODEL`（见 `service/.env.example`）
- 依赖解锁：`requirements.txt` 中 langchain 相关注释

## 禁止事项

- 不要修改 `git config`，不要 force push
- 不要提交 `.env`、密钥文件
- 不要大规模重构无关模块；保持最小 diff
- 不要删除 Mock 层直到对应后端接口可用
- 前后端 RBAC 配置（`web/src/rbac/config.js` 与 `service/app/db/seed.py`）修改时需同步

## 参考文档

- 根目录 `README.md` — 完整说明与 API 清单
- `docs/需求文档.md` — 业务需求
- `web/README.md`、`service/README.md` — 子项目说明
