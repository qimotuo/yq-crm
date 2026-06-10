# Web 前端

宽带业务 CRM 管理端，基于 Vite + React + Ant Design。

## 目录说明

```
src/
├── api/           # 接口层
│   ├── request.js # 统一请求（Mock / 真实 API 切换）
│   ├── index.js   # 主业务 Mock 注册
│   ├── workOrder.js
│   └── rbac.js
├── pages/         # 页面组件
├── components/    # 公共组件
├── layouts/       # MainLayout 侧边栏
├── store/         # Redux authSlice
├── rbac/          # 权限配置与工具函数
├── mock/          # Mock 种子数据
└── hooks/         # useAuth
```

## 启动

```bash
npm install
npm run dev
```

http://localhost:5173

## 环境变量

文件：`.env.development`

| 变量 | 说明 |
|------|------|
| `VITE_USE_MOCK=true` | 使用前端 Mock，不依赖后端 |
| `VITE_USE_MOCK=false` | 请求 `/api`，由 Vite 代理到 Python 服务 |
| `VITE_API_BASE=/api` | API 前缀 |

## 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发服务器 |
| `npm run build` | 生产构建 → `dist/` |
| `npm run lint` | ESLint 检查 |
| `npm run preview` | 预览构建结果 |

## 权限开发

- 菜单：`rbac/config.js` → `MENU_TREE`
- 操作：`OPERATION_GROUPS`
- 组件：`<Permission code="xxx">` 包裹按钮
- 路由：`<RequireMenu path="/xxx">` 包裹页面

## 接后端

1. 启动 `../service`（端口 8000）  
2. `.env.development` 设 `VITE_USE_MOCK=false`  
3. 确保接口路径、响应格式与 [项目 README](../README.md#7-api-约定) 一致  

更多说明见 [项目 README](../README.md)。
