# 文档目录

| 文档 | 说明 |
|------|------|
| [项目 README](../README.md) | **项目总览**（结构、启动、API、RBAC） |
| [需求文档](./需求文档.md) | 宽带业务 CRM 完整功能需求 |
| [Web 前端说明](../web/README.md) | 前端目录与开发指南 |
| [Service 后端说明](../service/README.md) | Python 后端与 AI 扩展 |

## 原始资料

| 文件 | 位置 |
|------|------|
| 客户管理 CRM 系统板块 | `../客户管理crm系统板块.xlsx` |
| 功能清单 & 人天分布 | `../功能清单&人天分布xlsx.xlsx` |

## 快速启动

```bash
# 前端
cd web && npm install && npm run dev

# 后端（可选，接真实 API 时）
cd service && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

访问 http://localhost:5173 ，测试账号密码均为 `123456`。
