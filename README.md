# 宽带业务 CRM（yq-crm）

宽带 / 物联网设备销售、安装、运维、财务一体化管理系统。  
Monorepo 结构：**Web 前端** + **Service 后端（Python）**，预留 AI 智能体扩展。

---

## 1. 项目概述

| 属性 | 说明 |
|------|------|
| 业务场景 | B2B/B2G 宽带业务：公海获客 → 销售接单 → 派单安装 → 设备出库 → 财务回款 → 合同管理 |
| 用户角色 | 管理员、销售、安装人员、财务、仓储管理员 |
| 终端 | Web 管理端（已实现）+ 微信小程序（规划中） |
| 当前阶段 | 前端功能 Demo 完整；后端 Python 骨架 + 部分 API；Mock / 真实 API 可切换 |

---

## 2. 目录结构

```
yq-crm/
├── web/                          # 前端（React + Vite + Ant Design）
│   ├── src/
│   │   ├── api/                  # 接口层（Mock 注册 + request 封装）
│   │   ├── pages/                # 业务页面（20+）
│   │   ├── components/           # 公共组件
│   │   ├── layouts/              # 主布局、侧边栏
│   │   ├── store/                # Redux（登录态、权限）
│   │   ├── rbac/                 # RBAC 菜单/操作/数据权限配置
│   │   ├── mock/                 # Mock 种子数据
│   │   └── hooks/                # useAuth 等
│   ├── .env.development          # VITE_USE_MOCK=true/false
│   └── vite.config.js            # 开发代理 /api → :8000
│
├── service/                      # 后端（FastAPI + Python）
│   ├── app/
│   │   ├── main.py               # 应用入口
│   │   ├── api/                  # 路由：auth、dashboard、work_orders、agent
│   │   ├── services/             # 业务逻辑
│   │   ├── data/                 # 内存数据层（练手，后续换 DB）
│   │   ├── agents/               # AI 智能体（预留 LangChain）
│   │   ├── core/                 # 配置、统一响应、异常
│   │   └── schemas/              # Pydantic 模型
│   ├── requirements.txt
│   └── .env.example
│
└── docs/                         # 需求与设计文档
    ├── README.md                 # 文档索引
    └── 需求文档.md
```

---

## 3. 技术栈

### 前端（web）

| 技术 | 版本/说明 |
|------|-----------|
| Vite | 5.x 构建 |
| React | 18.x |
| Ant Design | 6.x UI |
| React Router | 7.x 路由 |
| Redux Toolkit | 登录态、权限 |
| 状态持久化 | localStorage + Redux subscribe |

### 后端（service）

| 技术 | 说明 |
|------|------|
| Python | 3.11+（推荐） |
| FastAPI | REST API、OpenAPI 文档 |
| Uvicorn | ASGI 服务器 |
| Pydantic | 请求/响应校验 |
| 数据库 | 当前内存 Store，规划 PostgreSQL + SQLAlchemy |
| AI | `app/agents/` 预留，规划 LangChain + OpenAI 兼容接口 |

---

## 4. 快速启动

### 4.1 仅前端（Mock 模式，默认）

```bash
cd web
npm install
npm run dev
```

浏览器打开 http://localhost:5173

### 4.2 前端 + Python 后端

**终端 1 — 后端**

```bash
cd service
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # 可选，配置 AI Key
uvicorn app.main:app --reload --port 8000
```

API 文档：http://127.0.0.1:8000/docs  
健康检查：http://127.0.0.1:8000/health

**终端 2 — 前端**

```bash
cd web
# 修改 .env.development：VITE_USE_MOCK=false
npm run dev
```

Vite 已将 `/api` 代理到 `http://127.0.0.1:8000`。

### 4.3 测试账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | 123456 | 系统管理员（全部权限） |
| zhangsan | 123456 | 销售 |
| zhaoyun | 123456 | 安装人员 |
| finance | 123456 | 财务 |

---

## 5. 核心业务流

```
公海池领取 → 我的客户跟进 → 销售创建工单 → 管理员派工
    → 安装人员登记（MAC/IMEI/SIM）→ 设备出库 → 财务录入回款 → 合同/追溯
```

**推荐演示顺序（约 10 分钟）：**

1. `zhangsan` 登录 → 公海领取 → 新建工单  
2. `admin` 登录 → 派工给赵云  
3. `zhaoyun` 登录 → 安装登记  
4. `finance` 登录 → 财务录入 → 全链路追溯

---

## 6. RBAC 权限体系

三层权限，前后端对齐：

| 层级 | 说明 | 前端配置 |
|------|------|----------|
| 菜单权限 | 控制侧边栏可见页面 | `web/src/rbac/config.js` → `MENU_TREE` |
| 操作权限 | 控制按钮（新建/删除/派工/导出等） | `OPERATION_GROUPS` |
| 数据权限 | ALL / SELF / ASSIGNED / DEPT | 登录时写入 Redux `permissions` |

- 路由守卫：`RequireMenu`（403 页面）  
- 按钮守卫：`<Permission code="workorder:create">`  
- 角色配置页：管理员 → 系统管理 → 角色权限  

---

## 7. API 约定

### 统一响应格式

```json
{
  "code": 200,
  "message": "ok",
  "data": { }
}
```

错误时 `code !== 200`，前端 `request.js` 会抛出 `message`。

### 路径前缀

所有业务接口前缀 **`/api`**，与前端 `VITE_API_BASE=/api` 一致。

### 已实现后端接口（service）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 + RBAC permissions |
| GET | `/api/dashboard/stats` | 工作台统计 |
| GET/POST | `/api/work-orders` | 工单列表/创建 |
| PUT | `/api/work-orders/dispatch` | 派工 |
| PUT | `/api/work-orders/status` | 状态变更 |
| PUT | `/api/work-orders/update` | 编辑工单 |
| PUT | `/api/work-orders/install` | 安装登记 |
| DELETE | `/api/work-orders` | 删除工单 |
| GET | `/api/work-orders/my` | 我的工单 |
| GET | `/api/installers` | 安装人员列表 |
| POST | `/api/agent/chat` | AI 智能体（Demo 规则回复） |

其余接口仍在 **Web Mock 层**（`web/src/api/index.js`），按模块逐步迁移到 `service/`。

### Mock ↔ 真实 API 切换

```bash
# web/.env.development
VITE_USE_MOCK=true    # 纯前端 Mock（无需后端）
VITE_USE_MOCK=false   # 请求走 /api → Python 服务
VITE_API_BASE=/api
```

---

## 8. 前端页面清单

| 分组 | 页面 | 路由 |
|------|------|------|
| 通用 | 工作台 | `/dashboard` |
| 销售 | 公海客户、公海池配置、我的客户、联系人、跟进、日程、销售派单、设备出入库 | `/public-pool` … |
| 运维 | 派工管理、安装登记 | `/dispatch`、`/install-register` |
| 财务 | 合作客户、财务板块、合同、关联查询、全链路追溯 | `/customers` … |
| 系统 | 用户管理、角色权限 | `/system/users`、`/system/roles` |
| 其他 | 登录、个人信息 | `/login`、`/profile` |

---

## 9. AI 智能体规划

目录：`service/app/agents/`

| 阶段 | 能力 |
|------|------|
| 当前 | `POST /api/agent/chat` Demo 回复，验证链路 |
| 近期 | 接入 OpenAI 兼容 API / LangChain |
| 中期 | 客户跟进建议、工单摘要、公海分配策略 |
| 远期 | RAG 知识库（产品套餐、安装规范）、Tool Calling 查 CRM 数据 |

环境变量（`service/.env`）：

```env
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
AGENT_MODEL=gpt-4o-mini
```

---

## 10. 开发指南

### 新增前端页面

1. 在 `web/src/pages/` 新建组件  
2. 在 `web/src/App.jsx` 注册路由 + `RequireMenu`  
3. 在 `web/src/rbac/config.js` 的 `MENU_TREE` 增加菜单 key  
4. 在 `web/src/api/` 注册 Mock 或对接后端  

### 新增后端接口

1. `service/app/services/` 写业务逻辑  
2. `service/app/api/` 写路由  
3. 在 `service/app/main.py` 注册 router（若新建模块）  
4. 前端 Mock 保留至接口稳定，再切 `VITE_USE_MOCK=false` 验证  

### 构建生产包

```bash
cd web && npm run build    # 输出 web/dist/
# 后续可由 Nginx 托管静态资源，/api 反代到 Uvicorn
```

---

## 11. 文档索引

| 文档 | 路径 |
|------|------|
| 文档目录 | [docs/README.md](./docs/README.md) |
| 完整需求 | [docs/需求文档.md](./docs/需求文档.md) |
| 前端说明 | [web/README.md](./web/README.md) |
| 后端说明 | [service/README.md](./service/README.md) |

---

## 12. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| V1.0 | 2026-06-09 | 初版需求与 Demo |
| V1.1 | 2026-06-09 | RBAC、Redux、20+ 页面 |
| V1.2 | 2026-06-10 | `demo` → `web`，新增 `service` Python 后端，项目 README |
