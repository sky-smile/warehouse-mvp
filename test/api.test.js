const test = require("node:test");
const assert = require("node:assert/strict");

process.env.TEST_DB_PATH = ":memory:";

const { app } = require("../src/server");
const { db, initDefaultAdmin } = require("../src/db");

function createServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`,
      });
    });
  });
}

async function postJson(baseUrl, path, body, token) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    json: await response.json(),
  };
}

async function putJson(baseUrl, path, body, token) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    json: await response.json(),
  };
}

async function getJson(baseUrl, path, token) {
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    headers,
  });

  return {
    status: response.status,
    json: await response.json(),
  };
}

async function login(baseUrl, username = "admin", password = "123456") {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  return data.token;
}

function cleanDb() {
  db.exec(`
    DELETE FROM inventory_logs;
    DELETE FROM inventory;
    DELETE FROM goods;
    DELETE FROM warehouses;
    DELETE FROM sqlite_sequence WHERE name IN ('goods', 'warehouses', 'inventory', 'inventory_logs');
  `);
}

test("creates stock in and stock out records with inventory updates", async (t) => {
  cleanDb();
  await initDefaultAdmin();
  const { server, baseUrl } = await createServer();
  t.after(() => server.close());

  const token = await login(baseUrl);

  const goodsResult = await postJson(baseUrl, "/api/goods", {
    name: "纸箱",
    unit: "个",
  }, token);
  assert.equal(goodsResult.status, 201);

  const warehouseResult = await postJson(baseUrl, "/api/warehouses", {
    name: "A库",
    remark: "主库",
  }, token);
  assert.equal(warehouseResult.status, 201);

  const stockInResult = await postJson(baseUrl, "/api/stock-in", {
    goodsId: goodsResult.json.id,
    warehouseId: warehouseResult.json.id,
    quantity: 10,
    bizDate: "2026-04-04",
    remark: "初始入库",
  }, token);
  assert.equal(stockInResult.status, 201);
  assert.equal(stockInResult.json.type, "IN");

  const stockOutResult = await postJson(baseUrl, "/api/stock-out", {
    goodsId: goodsResult.json.id,
    warehouseId: warehouseResult.json.id,
    quantity: 3,
    bizDate: "2026-04-04",
    remark: "领用",
  }, token);
  assert.equal(stockOutResult.status, 201);
  assert.equal(stockOutResult.json.type, "OUT");

  const inventoryResponse = await fetch(`${baseUrl}/api/inventory`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const inventory = await inventoryResponse.json();

  assert.equal(inventoryResponse.status, 200);
  assert.equal(inventory.length, 1);
  assert.equal(inventory[0].quantity, 7);
});

test("rejects stock out when inventory is insufficient", async (t) => {
  cleanDb();
  await initDefaultAdmin();
  const { server, baseUrl } = await createServer();
  t.after(() => server.close());

  const token = await login(baseUrl);

  const goodsResult = await postJson(baseUrl, "/api/goods", {
    name: "胶带",
    unit: "卷",
  }, token);

  const warehouseResult = await postJson(baseUrl, "/api/warehouses", {
    name: "B库",
  }, token);

  const stockOutResult = await postJson(baseUrl, "/api/stock-out", {
    goodsId: goodsResult.json.id,
    warehouseId: warehouseResult.json.id,
    quantity: 1,
    bizDate: "2026-04-04",
  }, token);

  assert.equal(stockOutResult.status, 400);
  assert.equal(stockOutResult.json.message, "库存不足，无法出库");
});

test("requires authentication for read-only data APIs", async (t) => {
  cleanDb();
  await initDefaultAdmin();
  const { server, baseUrl } = await createServer();
  t.after(() => server.close());

  const goodsResponse = await getJson(baseUrl, "/api/goods");
  const warehousesResponse = await getJson(baseUrl, "/api/warehouses");
  const inventoryResponse = await getJson(baseUrl, "/api/inventory");
  const logsResponse = await getJson(baseUrl, "/api/logs");

  assert.equal(goodsResponse.status, 401);
  assert.equal(warehousesResponse.status, 401);
  assert.equal(inventoryResponse.status, 401);
  assert.equal(logsResponse.status, 401);
});

test("keeps issued tokens valid across server restarts", async (t) => {
  cleanDb();
  await initDefaultAdmin();

  const firstInstance = await createServer();
  t.after(() => firstInstance.server.close());

  const token = await login(firstInstance.baseUrl);
  firstInstance.server.close();

  const secondInstance = await createServer();
  t.after(() => secondInstance.server.close());

  const meResponse = await getJson(secondInstance.baseUrl, "/api/me", token);

  assert.equal(meResponse.status, 200);
  assert.equal(meResponse.json.username, "admin");
});

test("preserves admin status and updates user real name correctly", async (t) => {
  cleanDb();
  await initDefaultAdmin();
  const { server, baseUrl } = await createServer();
  t.after(() => server.close());

  const token = await login(baseUrl);
  const createdUser = await postJson(baseUrl, "/api/users", {
    username: "worker1",
    realName: "仓库员工",
    role: "worker",
  }, token);

  assert.equal(createdUser.status, 201);
  assert.equal(createdUser.json.realName, "仓库员工");
  assert.equal(createdUser.json.isActive, 1);

  const updatedUser = await putJson(baseUrl, `/api/users/${createdUser.json.id}`, {
    role: "manager",
    isActive: "0",
  }, token);

  assert.equal(updatedUser.status, 200);
  assert.equal(updatedUser.json.realName, "仓库员工");
  assert.equal(updatedUser.json.role, "manager");
  assert.equal(updatedUser.json.isActive, 0);

  const updatedAdmin = await putJson(baseUrl, "/api/users/1", {
    realName: "超级管理员",
    role: "worker",
    isActive: "0",
  }, token);

  assert.equal(updatedAdmin.status, 200);
  assert.equal(updatedAdmin.json.realName, "超级管理员");
  assert.equal(updatedAdmin.json.role, "admin");
  assert.equal(updatedAdmin.json.isActive, 1);
});

test("rejects weak or reused passwords", async (t) => {
  cleanDb();
  await initDefaultAdmin();
  const { server, baseUrl } = await createServer();
  t.after(() => server.close());

  const token = await login(baseUrl);
  const shortPasswordChange = await postJson(baseUrl, "/api/users/me/password", {
    oldPassword: "123456",
    newPassword: "123",
  }, token);

  assert.equal(shortPasswordChange.status, 400);
  assert.equal(shortPasswordChange.json.message, "密码长度不能少于 6 位");

  const reusedPasswordChange = await postJson(baseUrl, "/api/users/me/password", {
    oldPassword: "123456",
    newPassword: "123456",
  }, token);

  assert.equal(reusedPasswordChange.status, 400);
  assert.equal(reusedPasswordChange.json.message, "新密码不能使用默认密码");

  const createdUser = await postJson(baseUrl, "/api/users", {
    username: "manager1",
    realName: "经理",
    role: "manager",
  }, token);

  const emptyReset = await postJson(baseUrl, `/api/users/${createdUser.json.id}/reset-password`, {
    password: "",
  }, token);

  assert.equal(emptyReset.status, 200);

  const weakReset = await postJson(baseUrl, `/api/users/${createdUser.json.id}/reset-password`, {
    password: "123",
  }, token);

  assert.equal(weakReset.status, 400);
  assert.equal(weakReset.json.message, "密码长度不能少于 6 位");
});

test("rejects invalid business dates for stock movements", async (t) => {
  cleanDb();
  await initDefaultAdmin();
  const { server, baseUrl } = await createServer();
  t.after(() => server.close());

  const token = await login(baseUrl);

  const goodsResult = await postJson(baseUrl, "/api/goods", {
    name: "日期测试货物",
    unit: "件",
  }, token);
  assert.equal(goodsResult.status, 201);

  const warehouseResult = await postJson(baseUrl, "/api/warehouses", {
    name: "日期测试仓库",
    remark: "校验日期",
  }, token);
  assert.equal(warehouseResult.status, 201);

  const badFormatResult = await postJson(baseUrl, "/api/stock-in", {
    goodsId: goodsResult.json.id,
    warehouseId: warehouseResult.json.id,
    quantity: 5,
    bizDate: "2026/04/04",
    remark: "格式错误",
  }, token);

  assert.equal(badFormatResult.status, 400);
  assert.equal(badFormatResult.json.message, "业务日期格式必须为 YYYY-MM-DD");

  const invalidDateResult = await postJson(baseUrl, "/api/stock-in", {
    goodsId: goodsResult.json.id,
    warehouseId: warehouseResult.json.id,
    quantity: 5,
    bizDate: "2026-02-30",
    remark: "日期无效",
  }, token);

  assert.equal(invalidDateResult.status, 400);
  assert.equal(invalidDateResult.json.message, "业务日期无效");
});
