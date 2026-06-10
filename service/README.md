# Service 后端

宽带业务 CRM API 服务，Python + FastAPI，预留 AI 智能体。

## 目录说明

```
app/
├── main.py              # FastAPI 入口
├── api/                 # 路由
│   ├── auth.py          # 登录
│   ├── dashboard.py     # 工作台统计
│   ├── work_orders.py   # 工单
│   └── agent.py         # AI 智能体
├── services/            # 业务逻辑
├── data/
│   ├── store.py         # 内存数据（练手阶段）
├── agents/
│   └── assistant.py     # 智能体实现（可接 LangChain）
├── core/
│   ├── config.py        # 环境配置
│   ├── response.py      # { code, message, data }
│   └── exceptions.py    # BizError
└── schemas/             # Pydantic 模型
```

## 启动

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- Swagger：http://127.0.0.1:8000/docs  
- 健康检查：http://127.0.0.1:8000/health  

## 环境变量

复制 `.env.example` 为 `.env`：

```env
DEBUG=true
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
AGENT_MODEL=gpt-4o-mini
```

## API 响应格式

与前端约定一致：

```json
{ "code": 200, "message": "ok", "data": {} }
```

业务异常抛出 `BizError`，自动转为 `{ "code": 400, "message": "..." }`。

## 练手路线建议

1. **熟悉 FastAPI 路由** — 对照 `web/src/api/index.js` 的 Mock 路径逐个实现  
2. **接入 PostgreSQL** — 用 SQLAlchemy 替换 `data/store.py` 内存层  
3. **JWT 鉴权** — 登录发 token，路由依赖 `Depends(get_current_user)`  
4. **AI 智能体** — 在 `agents/assistant.py` 接 LangChain，扩展 `/api/agent/chat`  

## 测试登录

```bash
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'
```

更多说明见 [项目 README](../README.md)。
