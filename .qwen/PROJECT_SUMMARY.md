用户要求生成项目总结，我需要基于之前分析的所有文件内容（package.json、server.js、db.js、前端文件、测试文件等）整理一份完整的项目概览，包括技术栈、架构、API、数据库结构和下一步计划。# Project Summary

## Overall Goal
A simple MVP warehouse management system (仓库出入库管理) providing in/out stock tracking, inventory overview, goods/warehouse management, user authentication with role-based access control, and a modern Chinese-language web UI.

## Key Knowledge

### Technology Stack
- **Backend:** Node.js + Express 5 (CommonJS modules)
- **Database:** SQLite via `better-sqlite3` (file-based at `data/warehouse.db`)
- **Authentication:** JWT (`jsonwebtoken`) with 24h expiry, bcrypt for password hashing
- **Frontend:** Vanilla HTML/CSS/JavaScript (no framework)
- **Testing:** Node.js native test runner (`node --test`)
- **Dev Tools:** `nodemon` for hot reload

### Architecture
- **Entry point:** `src/server.js` — Express app with REST API + serves static frontend from `public/`
- **Database layer:** `src/db.js` — All SQL operations, schema definitions, and business logic
- **Frontend:** `public/index.html`, `public/app.js`, `public/styles.css` — SPA-style tabbed UI with authentication

### Role-Based Access Control
| Role | Permissions |
|------|-------------|
| `admin` | Full access: data management + account management |
| `manager` | CRUD goods/warehouses, stock in/out, read-only inventory/logs |
| `worker` | Stock in/out operations, read-only access to everything else |

### Default Credentials
- Username: `admin`, Password: `123456` (created automatically on first start)

### Key API Endpoints
| Method | Path | Auth Required | Roles | Description |
|--------|------|---------------|-------|-------------|
| POST | `/api/login` | No | — | User login, returns JWT |
| GET | `/api/goods` | Optional | — | List goods |
| POST/PUT/DELETE | `/api/goods[/:id]` | Yes | admin, manager | CRUD goods |
| GET | `/api/warehouses` | Optional | — | List warehouses |
| POST/PUT/DELETE | `/api/warehouses[/:id]` | Yes | admin, manager | CRUD warehouses |
| GET | `/api/inventory` | Optional | — | Current inventory |
| GET | `/api/logs` | Optional | — | Stock logs (filterable) |
| POST | `/api/stock-in` | Yes | admin, manager, worker | Stock in |
| POST | `/api/stock-out` | Yes | admin, manager, worker | Stock out |
| GET/POST/PUT/DELETE | `/api/users[/:id]` | Yes | admin | User management |
| POST | `/api/users/me/password` | Yes | any logged-in | Change own password |

### Database Schema
- `goods` — Product master data (name, unit, is_active)
- `warehouses` — Warehouse master data (name, remark)
- `inventory` — Current stock levels (goods_id + warehouse_id unique)
- `inventory_logs` — All stock movement records (type: IN/OUT, with operator tracking)
- `users` — User accounts with password_hash, role, is_active
- `app_config` — Key-value config storage (e.g., login_hint_shown)

### Key Commands
```bash
npm start          # Start production server
npm run dev        # Start with nodemon (hot reload)
npm test           # Run API tests with native node:test
```

### Environment Variables
- `PORT` — Server port (default: 3000)
- `JWT_SECRET` — JWT signing secret (auto-generated random if not set)

## Recent Actions
- **Analysis completed:** Read and analyzed all core files (`package.json`, `src/server.js`, `src/db.js`, `public/index.html`, `public/app.js`, `test/api.test.js`)
- **Project structure mapped:** Identified backend Express API, SQLite database layer, vanilla JS frontend with tabbed SPA architecture
- **Authentication flow understood:** JWT-based with localStorage persistence, optional auth for read endpoints, required auth for mutations
- **Test coverage noted:** Two existing tests covering stock in/out with inventory updates and insufficient inventory rejection

## Current Plan
1. [DONE] Analyze project structure and understand architecture
2. [TODO] Generate `QWEN.md` file with comprehensive project context (this document)
3. [TODO] Future development tasks as requested by user (feature additions, bug fixes, etc.)

---

## Summary Metadata
**Update time**: 2026-04-04T11:10:03.002Z 
