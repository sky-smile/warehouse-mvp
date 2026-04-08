# 仓库出入库管理系统 (warehouse-mvp)

## 项目概述

一个简洁的仓库出入库管理 MVP（Minimum Viable Product）应用，基于 **Node.js + Express + SQLite** 构建。提供完整的货物管理、仓库管理、入库/出库登记、库存流水追踪以及多角色用户权限管理功能。

### 核心功能

- **登录认证** - 基于 JWT 的身份认证，支持 24 小时 token 有效期
- **多角色权限** - admin（管理员）、manager（经理）、worker（操作员）三级角色
- **货物管理** - 货物的增删改查
- **仓库管理** - 仓库的增删改查
- **库存管理** - 入库/出库操作自动更新库存数量
- **出入库流水** - 记录每次库存变动，支持多条件过滤查询
- **账户管理** - 仅管理员可管理用户账户、重置密码

### 技术栈

| 类别 | 技术 |
|------|------|
| 后端框架 | Express.js (v5) |
| 数据库 | SQLite (better-sqlite3) |
| 认证 | JSON Web Token (jsonwebtoken) |
| 密码加密 | bcrypt |
| 前端 | 原生 HTML/CSS/JavaScript (SPA) |
| 测试 | Node.js 内置 `node:test` |
| 开发工具 | nodemon |

## 项目结构

```
warehouse-mvp/
├── data/
│   └── warehouse.db          # SQLite 数据库文件
├── public/
│   ├── index.html            # 前端主页面
│   ├── app.js                # 前端 SPA 逻辑
│   └── styles.css            # 样式文件（支持深色模式）
├── src/
│   ├── server.js             # Express 服务器 & API 路由
│   └── db.js                 # 数据库初始化 & 数据访问层
├── test/
│   └── api.test.js           # API 集成测试
├── package.json              # 项目依赖 & 脚本
└── README.md                 # 项目文档
```

## 安装与运行

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev        # 使用 nodemon 热加载
```

### 启动生产服务器

```bash
npm start          # 直接运行 node src/server.js
```

默认监听端口为 **3000**（可通过 `PORT` 环境变量修改）。

### 运行测试

```bash
npm test
```

## 默认账户

系统首次启动时会自动创建默认管理员账户：

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | 123456 | admin |

默认管理员首次登录后必须先修改密码，修改前会被前端强制提示。

## API 端点

### 认证相关

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/login` | 用户登录 | 公开 |
| GET | `/api/me` | 获取当前用户信息 | 已认证 |
| GET | `/api/health` | 健康检查 | 公开 |
| GET | `/api/version` | 获取应用版本信息 | 公开 |

### 货物管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/goods` | 获取所有货物 | 已认证 |
| POST | `/api/goods` | 创建货物 | admin, manager |
| PUT | `/api/goods/:id` | 更新货物 | admin, manager |
| DELETE | `/api/goods/:id` | 删除货物 | admin, manager |

### 仓库管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/warehouses` | 获取所有仓库 | 已认证 |
| POST | `/api/warehouses` | 创建仓库 | admin, manager |
| PUT | `/api/warehouses/:id` | 更新仓库 | admin, manager |
| DELETE | `/api/warehouses/:id` | 删除仓库 | admin, manager |

### 库存管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/inventory` | 获取当前库存 | 已认证 |
| GET | `/api/logs` | 获取出入库流水 | 已认证 |
| POST | `/api/stock-in` | 入库操作 | admin, manager, worker |
| POST | `/api/stock-out` | 出库操作 | admin, manager, worker |

### 账户管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/users` | 获取所有用户 | admin |
| POST | `/api/users` | 创建用户 | admin |
| PUT | `/api/users/:id` | 更新用户信息 | admin |
| DELETE | `/api/users/:id` | 删除用户 | admin |
| POST | `/api/users/:id/reset-password` | 重置用户密码 | admin |
| POST | `/api/users/me/password` | 修改自己的密码 | 已认证 |

## 权限说明

| 功能 | admin | manager | worker |
|------|-------|---------|--------|
| 查看数据 | ✅ | ✅ | ✅ |
| 货物/仓库管理 | ✅ | ✅ | ❌ |
| 入库/出库操作 | ✅ | ✅ | ✅ |
| 账户管理 | ✅ | ❌ | ❌ |

## 开发约定

### 代码风格

- **CommonJS** 模块系统 (`require/module.exports`)
- 错误处理统一通过 Express 全局错误中间件
- 数据库操作使用 `better-sqlite3` 预编译语句
- 事务操作使用 `db.transaction()` 保证一致性

### 数据库

- 使用 SQLite，数据库文件位于 `data/warehouse.db`
- 表结构：`goods`, `warehouses`, `inventory`, `inventory_logs`, `users`, `app_config`
- 启动时自动创建表和默认管理员
- 出入库接口要求 `bizDate` 使用 `YYYY-MM-DD` 格式，且必须是有效日期

### 前端

- 原生 SPA，无框架依赖
- 认证 token 存储在 `localStorage` 中
- 通过 `Authorization: Bearer <token>` 头进行 API 认证
- 支持深色/浅色主题切换
- 导出流水时生成 UTF-8 BOM 的 CSV 文件，并对引号、换行和公式前缀做安全转义

### 测试

- 使用 Node.js 内置 `node:test` 模块
- 测试前自动清空数据表
- 动态端口启动测试服务器
- 测试使用内存 SQLite（`TEST_DB_PATH=:memory:`），不会写入 `data/warehouse.db`

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务器端口 | `3000` |
| `JWT_SECRET` | JWT 密钥 | 开发环境默认 `dev-only-change-me`；生产环境必须显式设置 |

## 版本记录

### v1.1.4

- 前端主要动态渲染点增加 HTML 转义，修复列表、日志、用户管理等页面的 XSS 风险。
- 优化首页和主流程刷新逻辑，合并重复数据请求，减少不必要的接口调用。
- CSV 导出增加引号、换行和公式前缀转义，降低表格注入和格式损坏风险。
- 只读接口统一要求认证访问，README 与实际接口权限保持一致。
- 后端新增 `bizDate` 严格校验，要求 `YYYY-MM-DD` 且必须是有效日期。
- 默认管理员首次登录后必须修改密码，前端会强制提示，后端通过 `/api/me/security` 提供状态。
- 删除被引用仓库和删除默认管理员账户统一返回 `409 Conflict` 风格语义。
- 清理历史遗留的 `login_hint_shown` 逻辑，避免与新的首次改密策略并存。

### v1.1.3

- 添加 GitHub 链接与版本信息展示。
- 优化版本同步机制。
- 添加重置仓库功能。
- 更新 README 文档。
