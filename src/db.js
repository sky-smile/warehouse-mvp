const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = process.env.TEST_DB_PATH || path.join(__dirname, "..", "data", "warehouse.db");

if (dbPath !== ":memory:") {
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

const db = new Database(dbPath);

const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = "123456";

db.pragma("foreign_keys = ON");

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

// Add operator_id column if it doesn't exist (migration for older databases)
try {
  db.prepare("ALTER TABLE inventory_logs ADD COLUMN operator_id INTEGER").run();
} catch (err) {
  if (!err.message.includes("duplicate column") && !err.message.includes("no such table")) {
    console.log("[db] Unexpected error adding operator_id:", err.message);
  }
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

function validatePassword(password, { allowDefault = true } = {}) {
  const normalizedPassword = typeof password === "string" ? password : "";

  if (!normalizedPassword) {
    const error = new Error("密码不能为空");
    error.status = 400;
    throw error;
  }

  if (normalizedPassword.length < 6) {
    const error = new Error("密码长度不能少于 6 位");
    error.status = 400;
    throw error;
  }

  if (!allowDefault && normalizedPassword === DEFAULT_PASSWORD) {
    const error = new Error("新密码不能使用默认密码");
    error.status = 400;
    throw error;
  }

  return normalizedPassword;
}

async function initDefaultAdmin() {
  let adminUser = db.prepare("SELECT id, username, password_hash FROM users WHERE username = 'admin'").get();

  if (!adminUser) {
    const hash = await hashPassword(DEFAULT_PASSWORD);
    db.prepare("INSERT INTO users (username, password_hash, real_name, role) VALUES (?, ?, '默认管理员', 'admin')").run("admin", hash);
    console.log("[db] Default admin user created (username: admin, password: 123456)");
    adminUser = db.prepare("SELECT id, username, password_hash FROM users WHERE username = 'admin'").get();
  }

  if (getConfig("default_admin_password_changed") === null) {
    const usesDefaultPassword = adminUser
      ? await bcrypt.compare(DEFAULT_PASSWORD, adminUser.password_hash)
      : true;
    setConfig("default_admin_password_changed", usesDefaultPassword ? "false" : "true");
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

function setDefaultAdminPasswordChanged(changed) {
  setConfig("default_admin_password_changed", changed ? "true" : "false");
}

function isDefaultAdmin(user) {
  return user?.username === "admin";
}

async function isDefaultAdminPasswordChangeRequired(userId) {
  const user = findUserById.get(userId);
  if (!isDefaultAdmin(user)) {
    return false;
  }

  return getConfig("default_admin_password_changed") !== "true";
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

function validateBizDate(value) {
  const normalizedDate = normalizeText(value);

  if (!normalizedDate) {
    const error = new Error("业务日期不能为空");
    error.status = 400;
    throw error;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    const error = new Error("业务日期格式必须为 YYYY-MM-DD");
    error.status = 400;
    throw error;
  }

  const parsed = new Date(`${normalizedDate}T00:00:00Z`);
  const isValidDate = !Number.isNaN(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === normalizedDate;

  if (!isValidDate) {
    const error = new Error("业务日期无效");
    error.status = 400;
    throw error;
  }

  return normalizedDate;
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
      error.status = 409;
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

  const normalizedBizDate = validateBizDate(bizDate);

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
  const normalizedIsActive = isDefaultAdmin
    ? existing.isActive
    : (isActive !== undefined ? (isActive === 1 || isActive === true || isActive === "1" ? 1 : 0) : existing.isActive);

  db.prepare(`
    UPDATE users SET real_name = ?, role = ?, is_active = ? WHERE id = ?
  `).run(normalizedRealName || existing.realName, normalizedRole, normalizedIsActive, id);

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

  const plainPassword = validatePassword(newPassword || DEFAULT_PASSWORD);
  const hash = await hashPassword(plainPassword);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, id);

  if (isDefaultAdmin(existing)) {
    setDefaultAdminPasswordChanged(plainPassword !== DEFAULT_PASSWORD);
  }

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

  const normalizedNewPassword = validatePassword(newPassword, { allowDefault: false });
  if (oldPassword === normalizedNewPassword) {
    const error = new Error("新密码不能与旧密码相同");
    error.status = 400;
    throw error;
  }

  const hash = await hashPassword(normalizedNewPassword);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, id);

  if (isDefaultAdmin(existing)) {
    setDefaultAdminPasswordChanged(true);
  }

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
    error.status = 409;
    throw error;
  }

  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  return true;
}

// 重置仓库：清除所有数据，保留默认管理员账户
function resetWarehouse() {
  const resetTransaction = db.transaction(() => {
    // 先删除有外键依赖的表
    db.prepare("DELETE FROM inventory_logs").run();
    db.prepare("DELETE FROM inventory").run();
    db.prepare("DELETE FROM goods").run();
    db.prepare("DELETE FROM warehouses").run();
    // 删除除默认管理员外的所有用户
    db.prepare("DELETE FROM users WHERE username != 'admin'").run();
    db.prepare("DELETE FROM app_config").run();
  });

  resetTransaction();
  return { message: "仓库已重置，默认管理员账户已保留" };
}

async function authenticateUser(username, password) {
  const user = findUserByUsername.get(normalizeText(username));
  if (!user) {
    return null;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return null;
  }

  if (!user.isActive) {
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
  isDefaultAdminPasswordChangeRequired,
  // Warehouse reset
  resetWarehouse,
};
