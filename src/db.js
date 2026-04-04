const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "..", "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, "warehouse.db"));

const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = "123456";

db.pragma("foreign_keys = ON");

// 添加 operator_id 列（如果不存在）
try {
  db.prepare("ALTER TABLE inventory_logs ADD COLUMN operator_id INTEGER").run();
  console.log("[db] Added operator_id column to inventory_logs");
} catch (err) {
  // 列已存在，忽略错误
  if (!err.message.includes("duplicate column")) {
    console.log("[db] operator_id column already exists or error:", err.message);
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS goods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    unit TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    remark TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goods_id INTEGER NOT NULL,
    warehouse_id INTEGER NOT NULL,
    quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(goods_id, warehouse_id),
    FOREIGN KEY(goods_id) REFERENCES goods(id),
    FOREIGN KEY(warehouse_id) REFERENCES warehouses(id)
  );

  CREATE TABLE IF NOT EXISTS inventory_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
    goods_id INTEGER NOT NULL,
    warehouse_id INTEGER NOT NULL,
    quantity REAL NOT NULL CHECK (quantity > 0),
    biz_date TEXT NOT NULL,
    remark TEXT NOT NULL DEFAULT '',
    operator_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(goods_id) REFERENCES goods(id),
    FOREIGN KEY(warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY(operator_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    real_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'worker' CHECK (role IN ('admin', 'manager', 'worker')),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS app_config (
    key TEXT NOT NULL PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function initDefaultAdmin() {
  const exists = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  if (!exists) {
    const hash = await hashPassword(DEFAULT_PASSWORD);
    db.prepare("INSERT INTO users (username, password_hash, real_name, role) VALUES (?, ?, '默认管理员', 'admin')").run("admin", hash);
    console.log("[db] Default admin user created (username: admin, password: 123456)");
  }

  // 标记登录提示已显示过（服务器端记录，清除localStorage也不影响）
  const hintShown = db.prepare("SELECT key FROM app_config WHERE key = 'login_hint_shown'").get();
  if (!hintShown) {
    db.prepare("INSERT INTO app_config (key, value) VALUES (?, ?)").run("login_hint_shown", "true");
    console.log("[db] Login hint marked as shown (server-side)");
  }
}

// 获取配置
function getConfig(key) {
  const row = db.prepare("SELECT value FROM app_config WHERE key = ?").get(key);
  return row ? row.value : null;
}

// 设置配置
function setConfig(key, value) {
  db.prepare("INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)").run(key, value);
}

const findGoodsById = db.prepare(`
  SELECT id, name, unit, is_active, created_at
  FROM goods
  WHERE id = ?
`);

const findWarehouseById = db.prepare(`
  SELECT id, name, remark, created_at
  FROM warehouses
  WHERE id = ?
`);

const findInventoryRow = db.prepare(`
  SELECT id, goods_id, warehouse_id, quantity
  FROM inventory
  WHERE goods_id = ? AND warehouse_id = ?
`);

const insertInventoryRow = db.prepare(`
  INSERT INTO inventory (goods_id, warehouse_id, quantity, updated_at)
  VALUES (?, ?, 0, CURRENT_TIMESTAMP)
`);

const updateInventoryQuantity = db.prepare(`
  UPDATE inventory
  SET quantity = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

const insertInventoryLog = db.prepare(`
  INSERT INTO inventory_logs (type, goods_id, warehouse_id, quantity, biz_date, remark, operator_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function assertPositiveNumber(value, fieldName) {
  const quantity = Number(value);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    const error = new Error(`${fieldName} 必须大于 0`);
    error.status = 400;
    throw error;
  }

  return quantity;
}

function assertExistingGoods(goodsId) {
  const goods = findGoodsById.get(goodsId);

  if (!goods) {
    const error = new Error("货物不存在");
    error.status = 404;
    throw error;
  }

  return goods;
}

function assertExistingWarehouse(warehouseId) {
  const warehouse = findWarehouseById.get(warehouseId);

  if (!warehouse) {
    const error = new Error("仓库不存在");
    error.status = 404;
    throw error;
  }

  return warehouse;
}

function listGoods() {
  return db.prepare(`
    SELECT id, name, unit, is_active, created_at
    FROM goods
    ORDER BY id DESC
  `).all();
}

function createGoods({ name, unit }) {
  const normalizedName = normalizeText(name);
  const normalizedUnit = normalizeText(unit);

  if (!normalizedName) {
    const error = new Error("货物名称不能为空");
    error.status = 400;
    throw error;
  }

  if (!normalizedUnit) {
    const error = new Error("单位不能为空");
    error.status = 400;
    throw error;
  }

  try {
    const result = db.prepare(`
      INSERT INTO goods (name, unit)
      VALUES (?, ?)
    `).run(normalizedName, normalizedUnit);

    return findGoodsById.get(result.lastInsertRowid);
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      error.status = 409;
      error.message = "货物名称已存在";
    }

    throw error;
  }
}

function updateGoods(id, { name, unit }) {
  const normalizedName = normalizeText(name);
  const normalizedUnit = normalizeText(unit);

  if (!normalizedName) {
    const error = new Error("货物名称不能为空");
    error.status = 400;
    throw error;
  }

  if (!normalizedUnit) {
    const error = new Error("单位不能为空");
    error.status = 400;
    throw error;
  }

  const existing = findGoodsById.get(id);
  if (!existing) {
    const error = new Error("货物不存在");
    error.status = 404;
    throw error;
  }

  try {
    db.prepare(`
      UPDATE goods SET name = ?, unit = ? WHERE id = ?
    `).run(normalizedName, normalizedUnit, id);

    return findGoodsById.get(id);
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      error.status = 409;
      error.message = "货物名称已存在";
    }
    throw error;
  }
}

function deleteGoods(id) {
  const existing = findGoodsById.get(id);
  if (!existing) {
    const error = new Error("货物不存在");
    error.status = 404;
    throw error;
  }

  try {
    const result = db.prepare("DELETE FROM goods WHERE id = ?").run(id);
    if (result.changes === 0) {
      const error = new Error("Failed to delete goods");
      error.status = 500;
      throw error;
    }
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
      error.status = 409;
      error.message = "无法删除：该货物存在库存或出入库记录";
    }
    throw error;
  }
}

function listWarehouses() {
  return db.prepare(`
    SELECT id, name, remark, created_at
    FROM warehouses
    ORDER BY id DESC
  `).all();
}

function createWarehouse({ name, remark }) {
  const normalizedName = normalizeText(name);
  const normalizedRemark = normalizeText(remark);

  if (!normalizedName) {
    const error = new Error("仓库名称不能为空");
    error.status = 400;
    throw error;
  }

  try {
    const result = db.prepare(`
      INSERT INTO warehouses (name, remark)
      VALUES (?, ?)
    `).run(normalizedName, normalizedRemark);

    return findWarehouseById.get(result.lastInsertRowid);
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      error.status = 409;
      error.message = "仓库名称已存在";
    }

    throw error;
  }
}

function updateWarehouse(id, { name, remark }) {
  const normalizedName = normalizeText(name);
  const normalizedRemark = normalizeText(remark);

  if (!normalizedName) {
    const error = new Error("仓库名称不能为空");
    error.status = 400;
    throw error;
  }

  const existing = findWarehouseById.get(id);
  if (!existing) {
    const error = new Error("仓库不存在");
    error.status = 404;
    throw error;
  }

  try {
    db.prepare(`
      UPDATE warehouses SET name = ?, remark = ? WHERE id = ?
    `).run(normalizedName, normalizedRemark, id);

    return findWarehouseById.get(id);
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      error.status = 409;
      error.message = "仓库名称已存在";
    }
    throw error;
  }
}

function deleteWarehouse(id) {
  const existing = findWarehouseById.get(id);
  if (!existing) {
    const error = new Error("仓库不存在");
    error.status = 404;
    throw error;
  }

  try {
    const result = db.prepare("DELETE FROM warehouses WHERE id = ?").run(id);
    if (result.changes === 0) {
      const error = new Error("Failed to delete warehouse");
      error.status = 500;
      throw error;
    }
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
      error.status = 400;
      error.message = "无法删除：该仓库存在库存记录";
    }
    throw error;
  }
}

function listInventory() {
  return db.prepare(`
    SELECT
      inventory.id,
      inventory.goods_id AS goodsId,
      goods.name AS goodsName,
      goods.unit,
      inventory.warehouse_id AS warehouseId,
      warehouses.name AS warehouseName,
      inventory.quantity,
      inventory.updated_at AS updatedAt
    FROM inventory
    INNER JOIN goods ON goods.id = inventory.goods_id
    INNER JOIN warehouses ON warehouses.id = inventory.warehouse_id
    WHERE inventory.quantity > 0
    ORDER BY goods.name ASC, warehouses.name ASC
  `).all();
}

function listLogs(filters = {}) {
  const conditions = [];
  const values = [];

  if (filters.goodsId) {
    conditions.push("inventory_logs.goods_id = ?");
    values.push(filters.goodsId);
  }

  if (filters.warehouseId) {
    conditions.push("inventory_logs.warehouse_id = ?");
    values.push(filters.warehouseId);
  }

  if (filters.type) {
    conditions.push("inventory_logs.type = ?");
    values.push(filters.type);
  }

  if (filters.startDate) {
    conditions.push("inventory_logs.biz_date >= ?");
    values.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push("inventory_logs.biz_date <= ?");
    values.push(filters.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return db.prepare(`
    SELECT
      inventory_logs.id,
      inventory_logs.type,
      inventory_logs.goods_id AS goodsId,
      goods.name AS goodsName,
      goods.unit,
      inventory_logs.warehouse_id AS warehouseId,
      warehouses.name AS warehouseName,
      inventory_logs.quantity,
      inventory_logs.biz_date AS bizDate,
      inventory_logs.remark,
      inventory_logs.operator_id AS operatorId,
      users.username AS operatorUsername,
      users.real_name AS operatorName,
      inventory_logs.created_at AS createdAt
    FROM inventory_logs
    INNER JOIN goods ON goods.id = inventory_logs.goods_id
    INNER JOIN warehouses ON warehouses.id = inventory_logs.warehouse_id
    LEFT JOIN users ON users.id = inventory_logs.operator_id
    ${whereClause}
    ORDER BY inventory_logs.id DESC
  `).all(...values);
}

const createMovement = db.transaction(({ type, goodsId, warehouseId, quantity, bizDate, remark, operatorId }) => {
  assertExistingGoods(goodsId);
  assertExistingWarehouse(warehouseId);

  const normalizedBizDate = normalizeText(bizDate);

  if (!normalizedBizDate) {
    const error = new Error("业务日期不能为空");
    error.status = 400;
    throw error;
  }

  const normalizedRemark = normalizeText(remark);
  const normalizedQuantity = assertPositiveNumber(quantity, "数量");

  let inventoryRow = findInventoryRow.get(goodsId, warehouseId);

  if (!inventoryRow) {
    const result = insertInventoryRow.run(goodsId, warehouseId);
    inventoryRow = { id: result.lastInsertRowid, quantity: 0 };
  }

  const nextQuantity = type === "IN"
    ? inventoryRow.quantity + normalizedQuantity
    : inventoryRow.quantity - normalizedQuantity;

  if (nextQuantity < 0) {
    const error = new Error("库存不足，无法出库");
    error.status = 400;
    throw error;
  }

  updateInventoryQuantity.run(nextQuantity, inventoryRow.id);
  const logResult = insertInventoryLog.run(type, goodsId, warehouseId, normalizedQuantity, normalizedBizDate, normalizedRemark, operatorId || null);

  return db.prepare(`
    SELECT
      inventory_logs.id,
      inventory_logs.type,
      inventory_logs.goods_id AS goodsId,
      goods.name AS goodsName,
      goods.unit,
      inventory_logs.warehouse_id AS warehouseId,
      warehouses.name AS warehouseName,
      inventory_logs.quantity,
      inventory_logs.biz_date AS bizDate,
      inventory_logs.remark,
      inventory_logs.operator_id AS operatorId,
      users.username AS operatorUsername,
      users.real_name AS operatorName,
      inventory_logs.created_at AS createdAt
    FROM inventory_logs
    INNER JOIN goods ON goods.id = inventory_logs.goods_id
    INNER JOIN warehouses ON warehouses.id = inventory_logs.warehouse_id
    LEFT JOIN users ON users.id = inventory_logs.operator_id
    WHERE inventory_logs.id = ?
  `).get(logResult.lastInsertRowid);
});

function createStockIn(payload) {
  return createMovement({ ...payload, type: "IN" });
}

function createStockOut(payload) {
  return createMovement({ ...payload, type: "OUT" });
}

// ============================================================
// 用户管理
// ============================================================

const findUserByUsername = db.prepare(`
  SELECT id, username, password_hash, real_name AS realName, role, is_active AS isActive, created_at AS createdAt
  FROM users
  WHERE username = ?
`);

const findUserById = db.prepare(`
  SELECT id, username, password_hash, real_name AS realName, role, is_active AS isActive, created_at AS createdAt
  FROM users
  WHERE id = ?
`);

function listUsers() {
  return db.prepare(`
    SELECT id, username, real_name AS realName, role, is_active AS isActive, created_at AS createdAt
    FROM users
    ORDER BY 
      CASE role WHEN 'admin' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END ASC,
      created_at ASC
  `).all();
}

async function createUser({ username, realName, role }) {
  const normalizedUsername = normalizeText(username);
  const normalizedRealName = normalizeText(realName);
  const normalizedRole = role || "worker";

  if (!normalizedUsername) {
    const error = new Error("用户名不能为空");
    error.status = 400;
    throw error;
  }

  if (!["admin", "manager", "worker"].includes(normalizedRole)) {
    const error = new Error("无效的角色");
    error.status = 400;
    throw error;
  }

  const hash = await hashPassword(DEFAULT_PASSWORD);

  try {
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, real_name, role)
      VALUES (?, ?, ?, ?)
    `).run(normalizedUsername, hash, normalizedRealName || normalizedUsername, normalizedRole);

    const user = findUserById.get(result.lastInsertRowid);
    delete user.password_hash;
    return user;
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      error.status = 409;
      error.message = "用户名已存在";
    }
    throw error;
  }
}

async function updateUser(id, { realName, role, isActive }) {
  const existing = findUserById.get(id);
  if (!existing) {
    const error = new Error("用户不存在");
    error.status = 404;
    throw error;
  }

  // 默认管理员不能修改角色和状态
  const isDefaultAdmin = existing.username === "admin";
  const normalizedRealName = normalizeText(realName);
  const normalizedRole = isDefaultAdmin ? existing.role : (role && ["admin", "manager", "worker"].includes(role) ? role : existing.role);
  const normalizedIsActive = isDefaultAdmin ? existing.is_active : (isActive !== undefined ? (isActive === 1 || isActive === true || isActive === "1" ? 1 : 0) : existing.is_active);

  db.prepare(`
    UPDATE users SET real_name = ?, role = ?, is_active = ? WHERE id = ?
  `).run(normalizedRealName || existing.real_name, normalizedRole, normalizedIsActive, id);

  const user = findUserById.get(id);
  delete user.password_hash;
  return user;
}

async function resetUserPassword(id, newPassword) {
  const existing = findUserById.get(id);
  if (!existing) {
    const error = new Error("用户不存在");
    error.status = 404;
    throw error;
  }

  const plainPassword = newPassword || DEFAULT_PASSWORD;
  const hash = await hashPassword(plainPassword);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, id);
  return true;
}

async function changeUserPassword(id, oldPassword, newPassword) {
  const existing = findUserById.get(id);
  if (!existing) {
    const error = new Error("用户不存在");
    error.status = 404;
    throw error;
  }

  const valid = await bcrypt.compare(oldPassword, existing.password_hash);
  if (!valid) {
    const error = new Error("旧密码不正确");
    error.status = 400;
    throw error;
  }

  const hash = await hashPassword(newPassword);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, id);
  return true;
}

function deleteUser(id) {
  const existing = findUserById.get(id);
  if (!existing) {
    const error = new Error("用户不存在");
    error.status = 404;
    throw error;
  }

  if (existing.username === "admin") {
    const error = new Error("无法删除默认管理员账户");
    error.status = 400;
    throw error;
  }

  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  return true;
}

async function authenticateUser(username, password) {
  console.log('[auth] Attempting login for:', username, 'pwd:', password);
  const user = findUserByUsername.get(normalizeText(username));
  console.log('[auth] User found:', user ? user.username : 'no', 'hash:', user ? user.password_hash.slice(0, 25) : null);
  if (!user) {
    console.log('[auth] User not found');
    return null;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  console.log('[auth] Password valid:', valid);
  if (!valid) {
    console.log('[auth] Password invalid');
    return null;
  }

  if (!user.isActive) {
    console.log('[auth] User inactive');
    return null;
  }

  const result = { ...user };
  delete result.password_hash;
  return result;
}

module.exports = {
  db,
  initDefaultAdmin,
  getConfig,
  setConfig,
  // Goods
  listGoods,
  createGoods,
  updateGoods,
  deleteGoods,
  // Warehouses
  listWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  // Inventory & Logs
  listInventory,
  listLogs,
  createStockIn,
  createStockOut,
  // Users
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  changeUserPassword,
  authenticateUser,
};
