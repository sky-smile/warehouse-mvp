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

  const inventoryResponse = await fetch(`${baseUrl}/api/inventory`);
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
