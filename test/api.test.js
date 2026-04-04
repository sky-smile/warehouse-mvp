const test = require("node:test");
const assert = require("node:assert/strict");

const { app } = require("../src/server");
const { db } = require("../src/db");

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

async function postJson(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    json: await response.json(),
  };
}

test.beforeEach(() => {
  db.exec(`
    DELETE FROM inventory_logs;
    DELETE FROM inventory;
    DELETE FROM goods;
    DELETE FROM warehouses;
    DELETE FROM sqlite_sequence WHERE name IN ('goods', 'warehouses', 'inventory', 'inventory_logs');
  `);
});

test("creates stock in and stock out records with inventory updates", async (t) => {
  const { server, baseUrl } = await createServer();
  t.after(() => server.close());

  const goodsResult = await postJson(baseUrl, "/api/goods", {
    name: "纸箱",
    unit: "个",
  });
  assert.equal(goodsResult.status, 201);

  const warehouseResult = await postJson(baseUrl, "/api/warehouses", {
    name: "A库",
    remark: "主库",
  });
  assert.equal(warehouseResult.status, 201);

  const stockInResult = await postJson(baseUrl, "/api/stock-in", {
    goodsId: goodsResult.json.id,
    warehouseId: warehouseResult.json.id,
    quantity: 10,
    bizDate: "2026-04-04",
    remark: "初始入库",
  });
  assert.equal(stockInResult.status, 201);
  assert.equal(stockInResult.json.type, "IN");

  const stockOutResult = await postJson(baseUrl, "/api/stock-out", {
    goodsId: goodsResult.json.id,
    warehouseId: warehouseResult.json.id,
    quantity: 3,
    bizDate: "2026-04-04",
    remark: "领用",
  });
  assert.equal(stockOutResult.status, 201);
  assert.equal(stockOutResult.json.type, "OUT");

  const inventoryResponse = await fetch(`${baseUrl}/api/inventory`);
  const inventory = await inventoryResponse.json();

  assert.equal(inventoryResponse.status, 200);
  assert.equal(inventory.length, 1);
  assert.equal(inventory[0].quantity, 7);
});

test("rejects stock out when inventory is insufficient", async (t) => {
  const { server, baseUrl } = await createServer();
  t.after(() => server.close());

  const goodsResult = await postJson(baseUrl, "/api/goods", {
    name: "胶带",
    unit: "卷",
  });

  const warehouseResult = await postJson(baseUrl, "/api/warehouses", {
    name: "B库",
  });

  const stockOutResult = await postJson(baseUrl, "/api/stock-out", {
    goodsId: goodsResult.json.id,
    warehouseId: warehouseResult.json.id,
    quantity: 1,
    bizDate: "2026-04-04",
  });

  assert.equal(stockOutResult.status, 400);
  assert.equal(stockOutResult.json.message, "Insufficient inventory for stock out");
});
