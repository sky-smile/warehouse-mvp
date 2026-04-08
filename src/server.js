const path = require("path");
const jwt = require("jsonwebtoken");
const express = require("express");
const cors = require("cors");
const fs = require("fs");

// 动态读取 package.json 获取版本号
let appVersion = "1.0.0";
let appInfo = {
  name: "仓库管理系统",
  version: "1.0.0",
  author: "",
  repository: ""
};
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  appVersion = pkg.version || "1.0.0";
  appInfo = {
    name: pkg.name || "仓库管理系统",
    version: appVersion,
    author: pkg.author || "",
    repository: pkg.repository?.url?.replace("git+", "") || pkg.repository || ""
  };
} catch (e) {
  console.warn("无法读取 package.json:", e.message);
}
const {
  initDefaultAdmin,
  listGoods, createGoods, updateGoods, deleteGoods,
  listWarehouses, createWarehouse, updateWarehouse, deleteWarehouse,
  listInventory, listLogs, createStockIn, createStockOut,
  listUsers, createUser, updateUser, deleteUser,
  resetUserPassword, changeUserPassword, authenticateUser,
  isDefaultAdminPasswordChangeRequired,
  resetWarehouse,
} = require("./db");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// JWT config
const DEFAULT_JWT_SECRET = "dev-only-change-me";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required in production");
}

const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const JWT_EXPIRES_IN = "24h";

// ---- 认证中间件 ----
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "未登录或登录已过期" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "登录已过期，请重新登录" });
  }
}

// ---- 角色权限中间件 ----
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "权限不足" });
    }
    next();
  };
}

// ---- 登录路由（不需要认证）----
app.post("/api/login", async (req, res, next) => {
  try {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      return res.status(400).json({ message: "用户名和密码不能为空" });
    }

    const user = await authenticateUser(username, password);
    if (!user) {
      return res.status(401).json({ message: "用户名或密码错误" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, realName: user.realName },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({ token, user });
  } catch (error) {
    next(error);
  }
});

// 获取当前用户信息
app.get("/api/me", authMiddleware, (req, res) => {
  res.json(req.user);
});

app.get("/api/me/security", authMiddleware, async (req, res, next) => {
  try {
    const mustChangePassword = await isDefaultAdminPasswordChangeRequired(req.user.id);
    res.json({ mustChangePassword });
  } catch (error) {
    next(error);
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// 获取应用版本信息
app.get("/api/version", (_req, res) => {
  res.json({
    version: appVersion,
    name: appInfo.name,
    author: appInfo.author,
    repository: appInfo.repository
  });
});

// 获取登录提示状态（不需要认证）
app.get("/api/goods", authMiddleware, (_req, res) => {
  res.json(listGoods());
});

app.post("/api/goods", authMiddleware, requireRole("admin", "manager"), (req, res, next) => {
  try {
    const goods = createGoods(req.body ?? {});
    res.status(201).json(goods);
  } catch (error) {
    next(error);
  }
});

app.put("/api/goods/:id", authMiddleware, requireRole("admin", "manager"), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const goods = updateGoods(id, req.body ?? {});
    res.json(goods);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/goods/:id", authMiddleware, requireRole("admin", "manager"), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    deleteGoods(id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/warehouses", authMiddleware, (_req, res) => {
  res.json(listWarehouses());
});

app.post("/api/warehouses", authMiddleware, requireRole("admin", "manager"), (req, res, next) => {
  try {
    const warehouse = createWarehouse(req.body ?? {});
    res.status(201).json(warehouse);
  } catch (error) {
    next(error);
  }
});

app.put("/api/warehouses/:id", authMiddleware, requireRole("admin", "manager"), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const warehouse = updateWarehouse(id, req.body ?? {});
    res.json(warehouse);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/warehouses/:id", authMiddleware, requireRole("admin", "manager"), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    deleteWarehouse(id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/inventory", authMiddleware, (_req, res) => {
  res.json(listInventory());
});

app.get("/api/logs", authMiddleware, (req, res) => {
  res.json(listLogs({
    goodsId: req.query.goodsId ? Number(req.query.goodsId) : undefined,
    warehouseId: req.query.warehouseId ? Number(req.query.warehouseId) : undefined,
    type: req.query.type || undefined,
    startDate: req.query.startDate || undefined,
    endDate: req.query.endDate || undefined,
  }));
});

app.post("/api/stock-in", authMiddleware, requireRole("admin", "manager", "worker"), (req, res, next) => {
  try {
    const record = createStockIn({
      ...req.body,
      goodsId: Number(req.body.goodsId),
      warehouseId: Number(req.body.warehouseId),
      operatorId: req.user.id,
    });
    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
});

app.post("/api/stock-out", authMiddleware, requireRole("admin", "manager", "worker"), (req, res, next) => {
  try {
    const record = createStockOut({
      ...req.body,
      goodsId: Number(req.body.goodsId),
      warehouseId: Number(req.body.warehouseId),
      operatorId: req.user.id,
    });
    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// 账户管理 API（仅 admin 可访问）
// ============================================================

app.get("/api/users", authMiddleware, requireRole("admin"), (_req, res) => {
  res.json(listUsers());
});

app.post("/api/users", authMiddleware, requireRole("admin"), async (req, res, next) => {
  try {
    const user = await createUser(req.body ?? {});
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

app.put("/api/users/:id", authMiddleware, requireRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const user = await updateUser(id, req.body ?? {});
    res.json(user);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/users/:id", authMiddleware, requireRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    deleteUser(id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post("/api/users/:id/reset-password", authMiddleware, requireRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await resetUserPassword(id, req.body?.password);
    res.json({ message: "密码已重置" });
  } catch (error) {
    next(error);
  }
});

// 用户修改自己的密码
app.post("/api/users/me/password", authMiddleware, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body ?? {};
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "请提供旧密码和新密码" });
    }
    await changeUserPassword(req.user.id, oldPassword, newPassword);
    res.json({ message: "密码修改成功" });
  } catch (error) {
    next(error);
  }
});

// 重置仓库（仅默认管理员可执行）
app.post("/api/reset", authMiddleware, requireRole("admin"), (req, res, next) => {
  try {
    // 仅允许默认管理员执行重置
    if (req.user.username !== "admin") {
      return res.status(403).json({ message: "仅默认管理员可以重置仓库" });
    }
    const result = resetWarehouse();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({
    message: error.message || "Internal server error",
  });
});

const port = process.env.PORT || 3000;

if (require.main === module) {
  initDefaultAdmin().then(() => {
    const server = app.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.log(`Warehouse MVP running at ${url}`);
      // 自动打开浏览器（仅 exe 打包时生效）
      if (process.pkg) {
        const { spawn } = require("child_process");
        // 使用浏览器打开页面
        spawn("cmd", ["/c", "start", url], { detached: true, stdio: "ignore" });
      }
    });

    // Ctrl+C 或进程终止时优雅关闭
    process.on("SIGINT", () => {
      console.log("\nServer shutting down.");
      server.close(() => process.exit(0));
    });
    process.on("SIGTERM", () => {
      console.log("\nServer shutting down.");
      server.close(() => process.exit(0));
    });
  });
}

module.exports = { app };
