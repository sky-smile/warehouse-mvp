const today = new Date().toISOString().slice(0, 10);
const ROLE_LABELS = { admin: "管理员", manager: "经理", worker: "操作员" };
const ROLE_COLORS = { admin: "#ef4444", manager: "#f59e0b", worker: "#3b82f6" };

// ===========================================================
// App Info (loaded from server)
// ===========================================================
async function loadAppInfo() {
  try {
    const res = await fetch("/api/version");
    if (res.ok) {
      const data = await res.json();
      const versionEl = document.getElementById("app-version");
      const copyrightEl = document.getElementById("footer-copyright-text");
      const githubLink = document.getElementById("github-link");
      const githubText = document.getElementById("github-link-text");

      if (versionEl) versionEl.textContent = `v${data.version}`;

      if (copyrightEl && data.author) {
        const year = new Date().getFullYear();
        copyrightEl.textContent = `© ${year} ${data.author}`;
      }

      if (githubLink && data.repository) {
        githubLink.href = data.repository;
      }

      if (githubText && data.author) {
        githubText.textContent = data.author;
      }
    }
  } catch (err) {
    console.warn("无法获取版本信息:", err);
  }
}

// ===========================================================
// Theme
// ===========================================================
function initTheme() {
  const saved = localStorage.getItem("wms_theme");
  if (saved === "dark") {
    document.documentElement.classList.add("dark");
  }
}
function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("wms_theme", isDark ? "dark" : "light");
}
initTheme();

// ===========================================================
// Auth state
// ===========================================================
let currentUser = null;
let authToken = null;
let isHandlingAuthError = false;

function saveAuth(token, user) {
  authToken = token;
  currentUser = user;
  localStorage.setItem("wms_token", token);
  localStorage.setItem("wms_user", JSON.stringify(user));
}
function clearAuth() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem("wms_token");
  localStorage.removeItem("wms_user");
}
function loadAuth() {
  const token = localStorage.getItem("wms_token");
  const u = localStorage.getItem("wms_user");
  if (token && u) { try { authToken = token; currentUser = JSON.parse(u); return true; } catch (e) { } }
  return false;
}

// Hide login hint based on server config
async function checkLoginHint() {
  try {
    const res = await fetch("/api/config/login-hint");
    if (res.ok) {
      const data = await res.json();
      if (!data.showHint && loginHint) {
        loginHint.style.display = "none";
      }
    }
  } catch (err) {
    // 如果获取失败，保持默认显示
  }
}

function hasRole(...roles) { return currentUser && roles.includes(currentUser.role); }
function canDo(action) {
  if (!currentUser) return false;
  const r = currentUser.role;
  if (action === "manage-data") return r === "admin" || r === "manager";
  if (action === "manage-accounts") return r === "admin";
  return true; // read-only
}

// ===========================================================
// DOM refs
// ===========================================================
const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menu-toggle");
const refreshBtn = document.getElementById("refresh-data");
const inventoryBody = document.getElementById("inventory-body");
const inventoryCount = document.getElementById("inventory-count");
const stockinInvBody = document.getElementById("stockin-inv-body");
const stockinInvCount = document.getElementById("stockin-inv-count");
const stockoutInvBody = document.getElementById("stockout-inv-body");
const stockoutInvCount = document.getElementById("stockout-inv-count");
const logsBody = document.getElementById("logs-body");
const logsBodyMini = document.getElementById("logs-body-mini");
const logsBodyIn = document.getElementById("logs-body-in");
const logsBodyOut = document.getElementById("logs-body-out");
const goodsList = document.getElementById("goods-list");
const goodsSearch = document.getElementById("goods-search");
const goodsCount = document.getElementById("goods-count");
const goodsForm = document.getElementById("goods-form");
const goodsFormTitle = document.getElementById("goods-form-title");
const goodsSubmitBtn = document.getElementById("goods-submit");
const goodsCancelBtn = document.getElementById("goods-cancel");
const warehouseList = document.getElementById("warehouse-list");
const warehouseCount = document.getElementById("warehouse-count");
const warehouseForm = document.getElementById("warehouse-form");
const warehouseFormTitle = document.getElementById("warehouse-form-title");
const warehouseSubmitBtn = document.getElementById("warehouse-submit-btn");
const warehouseCancelBtn = document.getElementById("warehouse-cancel");
const stockInForm = document.getElementById("stock-in-form");
const stockOutForm = document.getElementById("stock-out-form");
const toast = document.getElementById("toast");
const toastText = document.getElementById("toast-text");
const loading = document.getElementById("loading");
const confirmModal = document.getElementById("confirm-modal");
const confirmTitle = document.getElementById("confirm-title");
const confirmMessage = document.getElementById("confirm-message");
const confirmOk = document.getElementById("confirm-ok");
const confirmCancel = document.getElementById("confirm-cancel");

// Filter
const filterGoods = document.getElementById("filter-goods");
const filterType = document.getElementById("filter-type");
const filterStart = document.getElementById("filter-start");
const filterEnd = document.getElementById("filter-end");
const filterApply = document.getElementById("filter-apply");
const filterReset = document.getElementById("filter-reset");
const exportExcel = document.getElementById("export-excel");

// Stats
const statGoods = document.getElementById("stat-goods");
const statWarehouses = document.getElementById("stat-warehouses");
const statStockinToday = document.getElementById("stat-stockin-today");
const statStockoutToday = document.getElementById("stat-stockout-today");

// Logs stats
const logTotal = document.getElementById("log-total");
const logInTotal = document.getElementById("log-in-total");
const logOutTotal = document.getElementById("log-out-total");
const logTodayTotal = document.getElementById("log-today-total");
const logsCount = document.getElementById("logs-count");

// Login page
const loginPage = document.getElementById("login-page");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginHint = document.getElementById("login-hint");

// Topbar user
const topbarUserName = document.getElementById("topbar-user-name");
const topbarRoleBadge = document.getElementById("topbar-role-badge");
const userDropdown = document.getElementById("user-dropdown");
const logoutBtn = document.getElementById("logout-btn");
const userAvatarBtn = document.getElementById("user-avatar-btn");

// Change password
const changePwdModal = document.getElementById("change-pwd-modal");
const changePwdForm = document.getElementById("change-pwd-form");
const changePwdCancel = document.getElementById("change-pwd-cancel");
const changePwdBtn = document.getElementById("change-pwd-btn");

// Users
const usersForm = document.getElementById("users-form");
const usersFormTitle = document.getElementById("users-form-title");
const usersSubmit = document.getElementById("users-submit");
const usersCancel = document.getElementById("users-cancel");
const usersCount = document.getElementById("users-count");
const usersList = document.getElementById("users-list");
const resetWarehouseBtn = document.getElementById("reset-warehouse-btn");

// Nav
const navItems = document.querySelectorAll(".nav-item");
const tabPanels = document.querySelectorAll(".tab-panel");
const pageTitle = document.getElementById("page-title");

const TAB_LABELS = {
  "overview": "总览", "goods": "货物管理", "warehouses": "仓库管理",
  "stock-in": "入库登记", "stock-out": "出库登记", "logs": "出入库流水", "accounts": "账户管理",
};

let goodsCache = [];
let warehouseCache = [];
let invCache = [];
let logsCache = [];
let usersCache = [];

stockInForm.elements.bizDate.value = today;
stockOutForm.elements.bizDate.value = today;
updateClock();
setInterval(updateClock, 30_000);

/* ===========================================================
   Helpers
   =========================================================== */
function ft(form) { return Object.fromEntries(new FormData(form).entries()); }

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function escapeCsvCell(value) {
  const normalizedValue = String(value ?? "").replace(/\r?\n/g, " ");
  const safeValue = /^[=+\-@]/.test(normalizedValue) ? `'${normalizedValue}` : normalizedValue;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

async function request(url, opts = {}) {
  const h = { "Content-Type": "application/json" };
  if (authToken) h["Authorization"] = `Bearer ${authToken}`;
  const r = await fetch(url, { cache: "no-store", headers: h, ...opts });
  if (r.status === 401) {
    clearAuth();

    if (!isHandlingAuthError) {
      isHandlingAuthError = true;
      userDropdown?.classList.add("hidden");
      showLoginPage();
      loginError.classList.remove("hidden");
      loginError.textContent = "登录已过期，请重新登录";
      showToast("登录已过期，请重新登录", true);
      setTimeout(() => {
        isHandlingAuthError = false;
      }, 0);
    }

    throw new Error("登录已过期，请重新登录");
  }

  if (!r.ok) {
    const e = await r.json().catch(() => ({ message: "操作失败" }));
    throw new Error(e.message);
  }
  if (r.status === 204) return null;
  return r.json();
}

/* ===========================================================
   Permission apply
   =========================================================== */
function applyPerms() {
  const canManage = canDo("manage-data");
  const canAccount = canDo("manage-accounts");
  navItems.forEach(n => {
    const t = n.dataset.tab;
    let show;
    if (t === "accounts") show = canAccount;
    else if (t === "goods" || t === "warehouses") show = canManage;
    else show = true; // overview, stock-in, stock-out, logs 都显示
    n.style.display = show ? "" : "none";
  });
}

/* ===========================================================
   Login / Logout flow
   =========================================================== */
function showLoginPage() {
  loginPage.classList.remove("hidden");
  document.querySelector(".app").style.display = "none";
  loginForm.reset();
  if (!isHandlingAuthError) {
    loginError.classList.add("hidden");
  }
}
function showMainPage() {
  loginPage.classList.add("hidden");
  document.querySelector(".app").style.display = "flex";
  topbarUserName.textContent = currentUser.realName || currentUser.username;
  topbarRoleBadge.textContent = ROLE_LABELS[currentUser.role];
  topbarRoleBadge.style.background = `${ROLE_COLORS[currentUser.role]}18`;
  topbarRoleBadge.style.color = ROLE_COLORS[currentUser.role];
  applyPerms();
  const firstTab = document.querySelector(".nav-item:not([style*='display'])")?.dataset.tab || "overview";
  switchTab(firstTab);
  refreshAll();
}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const u = loginForm.username.value.trim();
      const p = loginForm.password.value;
      const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, password: p }) });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      const data = await r.json();
      saveAuth(data.token, data.user);
      showMainPage();
    } catch (err) { loginError.classList.remove("hidden"); loginError.textContent = err.message; }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => { userDropdown.classList.add("hidden"); clearAuth(); showLoginPage(); });
}
if (userAvatarBtn) {
  userAvatarBtn.addEventListener("click", (e) => { e.stopPropagation(); userDropdown.classList.toggle("hidden"); });
}
document.addEventListener("click", () => userDropdown?.classList.add("hidden"));

// Change own password
if (changePwdBtn) {
  changePwdBtn.addEventListener("click", () => {
    userDropdown.classList.add("hidden");
    changePwdModal.classList.remove("hidden");
    changePwdForm.reset();
  });
}
if (changePwdCancel) changePwdCancel.addEventListener("click", () => { changePwdModal.classList.add("hidden"); changePwdForm.reset(); });
if (changePwdForm) {
  changePwdForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const oldP = changePwdForm.old.value;
    const newP = changePwdForm.new.value;
    try {
      await request("/api/users/me/password", { method: "POST", body: JSON.stringify({ oldPassword: oldP, newPassword: newP }) });
      showToast("密码修改成功");
      changePwdModal.classList.add("hidden");
      changePwdForm.reset();
    } catch (err) { showToast(err.message, true); }
  });
}

/* ===========================================================
   Navigation & Tab system
   =========================================================== */
function switchTab(name) {
  navItems.forEach(n => n.classList.toggle("active", n.dataset.tab === name));
  tabPanels.forEach(p => p.classList.toggle("active", p.dataset.panel === name));
  pageTitle.textContent = TAB_LABELS[name] || name;
  window.__sidebarBackdrop && window.__sidebarBackdrop.remove();
  sidebar.classList.remove("open");
}

navItems.forEach(btn => { btn.addEventListener("click", () => switchTab(btn.dataset.tab)); });
if (menuToggle) menuToggle.addEventListener("click", () => {
  sidebar.classList.toggle("open");
  if (sidebar.classList.contains("open")) {
    const bd = document.createElement("div"); bd.className = "sidebar-backdrop";
    bd.addEventListener("click", () => { sidebar.classList.remove("open"); bd.remove(); });
    document.body.appendChild(bd); window.__sidebarBackdrop = bd;
  }
});
document.querySelectorAll("[data-nav]").forEach(el => el.addEventListener("click", () => switchTab(el.dataset.nav)));

/* ===========================================================
  Clock
   =========================================================== */
function updateClock() {
  const topbarTime = document.getElementById("topbar-time");
  if (!topbarTime) return;
  const d = new Date();
  topbarTime.textContent = d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
    + " " + d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

/* ===========================================================
   Toast
   =========================================================== */
function showToast(message, isError = false) {
  toastText.textContent = message;
  toast.className = `toast ${isError ? "error" : "success"}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.className = "toast hidden"; }, 2400);
}

/* ===========================================================
   Loading
   =========================================================== */
let loadingCount = 0;
function showLoading() { loadingCount++; loading.classList.remove("hidden"); }
function hideLoading() { if (--loadingCount <= 0) { loadingCount = 0; loading.classList.add("hidden"); } }

/* ===========================================================
   Confirm Modal (replaces window.confirm)
   =========================================================== */
function showConfirm(title, message) {
  return new Promise(resolve => {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmModal.classList.remove("hidden");
    const hide = () => { confirmModal.classList.add("hidden"); };
    confirmOk.onclick = () => { hide(); resolve(true); };
    confirmCancel.onclick = () => { hide(); resolve(false); };
  });
}

/* ===========================================================
   Render helpers
   =========================================================== */
function badge(type) {
  if (type === "IN") return `<span class="badge in">入库</span>`;
  return `<span class="badge out">出库</span>`;
}
function qtyClass(qty) {
  if (qty === 0) return "out-stock";
  if (qty <= 5) return "low-stock";
  return "in-row";
}
function makeOptionsHTML(items, placeholder, formatter) {
  return `<option value="">${escapeHtml(placeholder)}</option>` + items.map(formatter).join("");
}

/* ===========================================================
   Warehouse filtering — 出库时自动排除无此货物的仓库
   =========================================================== */
function updateStockOutWarehouseSelect(goodsId) {
  const select = stockOutForm.querySelector('[data-role="warehouse-select"]');
  if (!select) return;
  if (!goodsId) {
    select.innerHTML = makeOptionsHTML(warehouseCache, "请选择仓库", w => `<option value="${escapeAttr(w.id)}">${escapeHtml(w.name)}</option>`);
    return;
  }
  const availableWhIds = new Set(invCache.filter(i => String(i.goodsId) === String(goodsId)).map(i => String(i.warehouseId)));
  const filtered = warehouseCache.filter(w => availableWhIds.has(String(w.id)));
  select.innerHTML = makeOptionsHTML(filtered, filtered.length > 0 ? "请选择仓库" : "此货物暂无可用库存", w => `<option value="${escapeAttr(w.id)}">${escapeHtml(w.name)}</option>`);
}

/* ===========================================================
   Load data
   =========================================================== */
async function loadReferenceData(preloaded = {}) {
  const goods = preloaded.goods || await request("/api/goods");
  const warehouses = preloaded.warehouses || await request("/api/warehouses");
  goodsCache = goods; warehouseCache = warehouses;

  const goodsOpt = makeOptionsHTML(goods, "请选择货物", g => `<option value="${escapeAttr(g.id)}">${escapeHtml(g.name)} (${escapeHtml(g.unit)})</option>`);
  document.querySelectorAll('[data-role="goods-select"]').forEach(s => s.innerHTML = goodsOpt);

  // 先更新所有仓库选择框，出库表单的过滤在 loadInventory 之后单独处理
  const whOpt = makeOptionsHTML(warehouses, "请选择仓库", w => `<option value="${escapeAttr(w.id)}">${escapeHtml(w.name)}</option>`);
  document.querySelectorAll('[data-role="warehouse-select"]').forEach(s => {
    if (!s.closest("#stock-out-form")) s.innerHTML = whOpt;
  });

  if (filterGoods) filterGoods.innerHTML = makeOptionsHTML(goods, "全部货物", g => `<option value="${escapeAttr(g.id)}">${escapeHtml(g.name)}</option>`);

  goodsCount.textContent = `${goods.length} 个`; renderGoodsList(goods);
  warehouseCount.textContent = `${warehouses.length} 个`; renderWarehouseList(warehouses);
}

function renderGoodsList(items) {
  goodsCache = items;
  const filter = (goodsSearch?.value || "").toLowerCase();
  const filtered = items.filter(g => g.name.toLowerCase().includes(filter) || g.unit.toLowerCase().includes(filter));
  if (filtered.length === 0) { goodsList.innerHTML = `<div class="empty-msg">暂无${filter ? '匹配' : ''}货物</div>`; return; }
  goodsList.innerHTML = filtered.map(g => `
    <div class="data-list-item">
      <span class="data-list-text">${escapeHtml(g.name)}<span class="sub">${escapeHtml(g.unit)}</span></span>
      <span class="data-list-actions">
        <button type="button" class="btn-edit" data-id="${escapeAttr(g.id)}" data-name="${escapeAttr(g.name)}" data-unit="${escapeAttr(g.unit)}">✎ 编辑</button>
        ${hasRole("admin") ? `<button type="button" class="btn-del" data-id="${escapeAttr(g.id)}" data-name="${escapeAttr(g.name)}">✕ 删除</button>` : ""}
      </span>
    </div>
  `).join("");
}
if (goodsSearch) goodsSearch.addEventListener("input", () => renderGoodsList(goodsCache));

function renderWarehouseList(items) {
  warehouseCache = items;
  if (items.length === 0) { warehouseList.innerHTML = `<div class="empty-msg">暂无仓库</div>`; return; }
  warehouseList.innerHTML = items.map(w => `
    <div class="data-list-item">
      <span class="data-list-text">${escapeHtml(w.name)}<span class="sub">${escapeHtml(w.remark || "—")}</span></span>
      <span class="data-list-actions">
        <button type="button" class="btn-edit" data-id="${escapeAttr(w.id)}" data-name="${escapeAttr(w.name)}" data-remark="${escapeAttr(w.remark || "")}">✎ 编辑</button>
        ${hasRole("admin") ? `<button type="button" class="btn-del" data-id="${escapeAttr(w.id)}" data-name="${escapeAttr(w.name)}">✕ 删除</button>` : ""}
      </span>
    </div>
  `).join("");
}

function inventoryRows(items) {
  if (items.length === 0) return `<tr><td colspan="4" class="empty-cell">暂无库存</td></tr>`;
  return items.map(i => `<tr><td>${escapeHtml(i.goodsName)}</td><td>${escapeHtml(i.unit)}</td><td>${escapeHtml(i.warehouseName)}</td><td class="text-right"><span class="${qtyClass(i.quantity)}">${escapeHtml(i.quantity)}</span></td></tr>`).join("");
}

async function loadInventory(preloadedInventory) {
  invCache = preloadedInventory || await request("/api/inventory");
  inventoryCount.textContent = `${invCache.length} 项`;
  inventoryBody.innerHTML = inventoryRows(invCache);
  stockinInvCount.textContent = `${invCache.length} 项`;
  stockinInvBody.innerHTML = inventoryRows(invCache);
  stockoutInvCount.textContent = `${invCache.length} 项`;
  stockoutInvBody.innerHTML = inventoryRows(invCache);
  const cg = stockOutForm.querySelector('[data-role="goods-select"]')?.value;
  updateStockOutWarehouseSelect(cg);
}

async function loadLogs(overrides = {}, preloadedLogs) {
  const hasOverrides = Object.values(overrides).some(Boolean);
  const params = new URLSearchParams();
  if (overrides.goodsId) params.set("goodsId", overrides.goodsId);
  if (overrides.type) params.set("type", overrides.type);
  if (overrides.startDate) params.set("startDate", overrides.startDate);
  if (overrides.endDate) params.set("endDate", overrides.endDate);
  const logs = (!hasOverrides && preloadedLogs)
    ? preloadedLogs
    : await request("/api/logs" + (params.toString() ? "?" + params.toString() : ""));
  if (!hasOverrides) {
    logsCache = logs;
  }

  // 更新统计
  updateLogStats(logs);

  logsBody.innerHTML = logs.length > 0
    ? logs.map(l => {
      const time = l.createdAt ? new Date(l.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
      return `<tr><td>${badge(l.type)}</td><td>${escapeHtml(l.goodsName)}</td><td>${escapeHtml(l.warehouseName)}</td><td class="text-right ${l.type === "IN" ? "in-row" : "out-row"}">${escapeHtml(l.quantity)}</td><td>${escapeHtml(l.unit)}</td><td>${escapeHtml(l.bizDate)}</td><td>${escapeHtml(time)}</td><td>${escapeHtml(l.operatorName || l.operatorUsername || "—")}</td><td>${escapeHtml(l.remark || "—")}</td></tr>`;
    }).join("")
    : `<tr><td colspan="9" class="empty-cell">暂无流水记录</td></tr>`;

  logsBodyMini.innerHTML = logs.slice(0, 5).length > 0
    ? logs.slice(0, 5).map(l => {
      const time = l.createdAt ? new Date(l.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
      return `<tr><td>${badge(l.type)}</td><td>${escapeHtml(l.goodsName)}</td><td>${escapeHtml(l.warehouseName)}</td><td class="text-right ${l.type === "IN" ? "in-row" : "out-row"}">${escapeHtml(l.quantity)}</td><td>${escapeHtml(l.unit)}</td><td>${escapeHtml(l.bizDate)}</td><td>${escapeHtml(time)}</td></tr>`;
    }).join("")
    : `<tr><td colspan="7" class="empty-cell">暂无流水</td></tr>`;

  const ins = logs.filter(l => l.type === "IN").slice(0, 6);
  logsBodyIn.innerHTML = ins.length > 0 ? ins.map(l => {
    const time = l.createdAt ? new Date(l.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
    return `<tr><td>${escapeHtml(l.goodsName)}</td><td>${escapeHtml(l.warehouseName)}</td><td class="text-right in-row">${escapeHtml(l.quantity)}</td><td>${escapeHtml(l.unit)}</td><td>${escapeHtml(l.bizDate)}</td><td>${escapeHtml(time)}</td><td>${escapeHtml(l.operatorName || l.operatorUsername || "—")}</td></tr>`;
  }).join("") : `<tr><td colspan="7" class="empty-cell">暂无</td></tr>`;

  const outs = logs.filter(l => l.type === "OUT").slice(0, 6);
  logsBodyOut.innerHTML = outs.length > 0 ? outs.map(l => {
    const time = l.createdAt ? new Date(l.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
    return `<tr><td>${escapeHtml(l.goodsName)}</td><td>${escapeHtml(l.warehouseName)}</td><td class="text-right out-row">${escapeHtml(l.quantity)}</td><td>${escapeHtml(l.unit)}</td><td>${escapeHtml(l.bizDate)}</td><td>${escapeHtml(time)}</td><td>${escapeHtml(l.operatorName || l.operatorUsername || "—")}</td></tr>`;
  }).join("") : `<tr><td colspan="7" class="empty-cell">暂无</td></tr>`;
}

function updateLogStats(logs) {
  const total = logs.length;
  const inCount = logs.filter(l => l.type === "IN").length;
  const outCount = logs.filter(l => l.type === "OUT").length;
  const todayCount = logs.filter(l => l.bizDate === today).length;

  if (logTotal) logTotal.textContent = total;
  if (logInTotal) logInTotal.textContent = inCount;
  if (logOutTotal) logOutTotal.textContent = outCount;
  if (logTodayTotal) logTodayTotal.textContent = todayCount;
  if (logsCount) logsCount.textContent = `${total} 条`;
}

/* ===========================================================
   导出Excel
   =========================================================== */
async function exportLogsToExcel() {
  try {
    // 获取当前筛选条件
    const params = new URLSearchParams();
    if (filterGoods.value) params.set("goodsId", filterGoods.value);
    if (filterType.value) params.set("type", filterType.value);
    if (filterStart.value) params.set("startDate", filterStart.value);
    if (filterEnd.value) params.set("endDate", filterEnd.value);

    const logs = await request("/api/logs" + (params.toString() ? "?" + params.toString() : ""));

    if (logs.length === 0) {
      showToast("没有数据可导出", "error");
      return;
    }

    // 构建CSV内容
    const BOM = '\uFEFF';
    const headers = ["类型", "货物", "单位", "仓库", "数量", "日期", "时间", "操作人员", "备注"];
    const rows = logs.map(l => {
      const time = l.createdAt ? new Date(l.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
      return [
        escapeCsvCell(l.type === "IN" ? "入库" : "出库"),
        escapeCsvCell(l.goodsName),
        escapeCsvCell(l.unit),
        escapeCsvCell(l.warehouseName),
        escapeCsvCell(`${l.quantity} ${l.unit}`),
        escapeCsvCell(l.bizDate),
        escapeCsvCell(time),
        escapeCsvCell(l.operatorName || l.operatorUsername || "—"),
        escapeCsvCell(l.remark || "—")
      ];
    });

    const csvContent = BOM + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

    // 下载文件
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `出入库流水_${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`✅ 成功导出 ${logs.length} 条记录`);
  } catch (error) {
    console.error("导出失败:", error);
    showToast("导出失败，请重试", "error");
  }
}

/* ===========================================================
   Stats
   =========================================================== */
async function loadStats(preloaded = {}) {
  const goods = preloaded.goods || goodsCache || [];
  const warehouses = preloaded.warehouses || warehouseCache || [];
  const logs = preloaded.logs || logsCache || [];
  statGoods.textContent = goods.length; statWarehouses.textContent = warehouses.length;
  const ti = logs.filter(l => l.type === "IN" && l.bizDate === today); const to = logs.filter(l => l.type === "OUT" && l.bizDate === today);
  statStockinToday.textContent = ti.reduce((s, l) => s + l.quantity, 0); statStockoutToday.textContent = to.reduce((s, l) => s + l.quantity, 0);
}

/* ===========================================================
   Users CRUD
   =========================================================== */
async function loadAccounts(preloadedUsers) {
  try {
    const users = preloadedUsers || await request("/api/users");
    usersCache = users;
    usersCount.textContent = `${users.length} 个`;
    renderUsersList(users);
  }
  catch { usersCache = []; usersCount.textContent = "0 个"; usersList.innerHTML = ""; }
}

function renderUsersList(items) {
  if (items.length === 0) { usersList.innerHTML = `<div class="empty-msg">暂无用户</div>`; return; }
  usersList.innerHTML = items.map(u => {
    const createDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';
    return `
    <div class="data-list-item">
      <div class="user-info">
        <div class="user-main">
          <span class="user-username">${escapeHtml(u.username)}</span>
          ${u.realName ? `<span class="user-realname">${escapeHtml(u.realName)}</span>` : ""}
        </div>
        <div class="user-meta">
          <span class="user-role-badge" style="background:${ROLE_COLORS[u.role] || '#64748b'}18;color:${ROLE_COLORS[u.role] || '#64748b'};">${escapeHtml(ROLE_LABELS[u.role])}</span>
          <span class="user-status ${u.isActive ? 'active' : 'inactive'}">${u.isActive ? "● 启用" : "● 停用"}</span>
          <span class="user-created">创建于 ${escapeHtml(createDate)}</span>
        </div>
      </div>
      <span class="data-list-actions">
        <button type="button" class="btn-edit" data-user-id="${escapeAttr(u.id)}" data-user-name="${escapeAttr(u.username)}" data-user-real="${escapeAttr(u.realName)}" data-user-role="${escapeAttr(u.role)}" data-user-active="${escapeAttr(u.isActive)}">✎ 编辑</button>
        <button type="button" class="btn-icon btn-resetpwd" data-resetpwd="${escapeAttr(u.id)}" data-resetpwd-name="${escapeAttr(u.username)}" title="重置密码"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></button>
        ${u.username !== "admin" ? `<button type="button" class="btn-del" data-user-del-id="${escapeAttr(u.id)}" data-user-del-name="${escapeAttr(u.username)}">✕ 删除</button>` : ""}
      </span>
    </div>
  `;
  }).join("");
}

/* User form */
function resetUsersForm() {
  usersForm.reset();
  usersForm.elements.username.required = true;
  usersForm.elements.id.value = "";
  delete usersForm.elements.id.dataset.editId;
  usersFormTitle.textContent = "新增用户";
  usersSubmit.textContent = "保存";
  usersCancel.classList.add("hidden");
  usersForm.elements.username.disabled = false;
}

if (usersCancel) usersCancel.addEventListener("click", resetUsersForm);
if (usersForm) {
  usersForm.addEventListener("submit", async e => {
    e.preventDefault();
    const editId = usersForm.elements.id.dataset.editId;
    const data = {
      username: usersForm.elements.username.value.trim(),
      realName: usersForm.elements.realName.value.trim(),
      role: usersForm.elements.role.value,
      isActive: usersForm.elements.isActive.value
    };
    try {
      if (editId) {
        await request(`/api/users/${editId}`, { method: "PUT", body: JSON.stringify(data) });
        showToast("用户更新成功");
      } else {
        await request("/api/users", { method: "POST", body: JSON.stringify(data) });
        showToast("用户已创建 (密码: 123456)");
      }
      resetUsersForm();
      await loadAccounts();
    } catch (err) { showToast(err.message, true); }
  });
}

// Event delegation: edit, delete, reset password for users list
if (usersList) {
  usersList.addEventListener("click", async e => {
    const btn = e.target.closest("button"); if (!btn) return;

    // Edit
    if (btn.classList.contains("btn-edit")) {
      usersForm.elements.username.value = btn.dataset.userName;
      usersForm.elements.username.disabled = true;
      usersForm.elements.realName.value = btn.dataset.userReal || "";
      usersForm.elements.role.value = btn.dataset.userRole;
      usersForm.elements.isActive.value = btn.dataset.userActive;
      usersForm.elements.id.dataset.editId = btn.dataset.userId;
      usersFormTitle.textContent = "编辑用户";
      usersSubmit.textContent = "更新";
      usersCancel.classList.remove("hidden");

      // 默认管理员不能修改角色和状态
      const isDefaultAdmin = btn.dataset.userName === "admin";
      usersForm.elements.role.disabled = isDefaultAdmin;
      usersForm.elements.isActive.disabled = isDefaultAdmin;
    }

    // Delete
    if (btn.dataset.userDelId) {
      const ok = await showConfirm("删除用户", `确定删除用户 "${btn.dataset.userDelName}" 吗？`);
      if (!ok) return;
      try { await request(`/api/users/${btn.dataset.userDelId}`, { method: "DELETE" }); showToast("用户已删除"); await loadAccounts(); }
      catch (err) { showToast(err.message, true); }
    }

    // Reset password
    if (btn.dataset.resetpwd) {
      const ok = await showConfirm("重置密码", `确定将用户 "${btn.dataset.resetpwdName}" 的密码重置为 123456 吗？`);
      if (!ok) return;
      try { await request(`/api/users/${btn.dataset.resetpwd}/reset-password`, { method: "POST", body: {} }); showToast("密码已重置为 123456"); }
      catch (err) { showToast(err.message, true); }
    }
  });
}

/* ===========================================================
   Refresh all
   =========================================================== */
async function refreshAll() {
  showLoading();
  try {
    const [goods, warehouses, inventory, logs, users] = await Promise.all([
      request("/api/goods"),
      request("/api/warehouses"),
      request("/api/inventory"),
      request("/api/logs"),
      currentUser?.role === "admin" ? request("/api/users") : Promise.resolve([]),
    ]);

    await Promise.all([
      loadReferenceData({ goods, warehouses }),
      loadInventory(inventory),
      loadLogs({}, logs),
      loadAccounts(users),
    ]);
    await loadStats({ goods, warehouses, logs });
  }
  catch (e) { showToast(e.message, true); }
  hideLoading();
}
refreshBtn.addEventListener("click", refreshAll);

// Theme toggle
const themeToggle = document.getElementById("theme-toggle");
if (themeToggle) themeToggle.addEventListener("click", toggleTheme);

/* ===========================================================
   Filter bar
   =========================================================== */
if (filterApply) filterApply.addEventListener("click", () => loadLogs({ goodsId: filterGoods.value || undefined, type: filterType.value || undefined, startDate: filterStart.value || undefined, endDate: filterEnd.value || undefined }));
if (filterReset) filterReset.addEventListener("click", async () => { filterGoods.value = ""; filterType.value = ""; filterStart.value = ""; filterEnd.value = ""; await loadLogs(); showToast("筛选已重置"); });
if (exportExcel) exportExcel.addEventListener("click", exportLogsToExcel);

/* ===========================================================
   出库表单：选择货物后自动过滤仓库
   =========================================================== */
stockOutForm.querySelector('[data-role="goods-select"]').addEventListener("change", function () { updateStockOutWarehouseSelect(this.value); });

/* ===========================================================
   Forms — 货物
   =========================================================== */
goodsForm.addEventListener("submit", async e => {
  e.preventDefault();
  const editId = goodsForm.elements.name.dataset.editId;
  try {
    if (editId) { await request(`/api/goods/${editId}`, { method: "PUT", body: JSON.stringify(ft(goodsForm)) }); resetGoodsForm(); showToast("货物更新成功"); }
    else { await request("/api/goods", { method: "POST", body: JSON.stringify(ft(goodsForm)) }); showToast("货物添加成功"); }
    goodsForm.reset(); resetGoodsForm();
    await Promise.all([loadReferenceData(), loadInventory()]);
    // 更新出库表单的仓库过滤（使用最新的库存数据）
    const gs = stockOutForm.querySelector('[data-role="goods-select"]');
    updateStockOutWarehouseSelect(gs?.value);
  } catch (err) { showToast(err.message, true); }
});
function resetGoodsForm() { delete goodsForm.elements.name.dataset.editId; delete goodsForm.elements.unit.dataset.editId; goodsFormTitle.textContent = "新增货物"; goodsSubmitBtn.textContent = "保存"; goodsCancelBtn?.classList.add("hidden"); }
if (goodsCancelBtn) goodsCancelBtn.addEventListener("click", () => { goodsForm.reset(); resetGoodsForm(); });

/* ===========================================================
   Forms — 仓库
   =========================================================== */
warehouseForm.addEventListener("submit", async e => {
  e.preventDefault();
  const editId = warehouseForm.elements.name.dataset.editId;
  try {
    if (editId) { await request(`/api/warehouses/${editId}`, { method: "PUT", body: JSON.stringify(ft(warehouseForm)) }); resetWarehouseForm(); showToast("仓库更新成功"); }
    else { await request("/api/warehouses", { method: "POST", body: JSON.stringify(ft(warehouseForm)) }); showToast("仓库添加成功"); }
    warehouseForm.reset(); resetWarehouseForm();
    await Promise.all([loadReferenceData(), loadInventory()]);
    // 更新出库表单的仓库过滤（使用最新的库存数据）
    const gs = stockOutForm.querySelector('[data-role="goods-select"]');
    updateStockOutWarehouseSelect(gs?.value);
  } catch (err) { showToast(err.message, true); }
});
function resetWarehouseForm() { delete warehouseForm.elements.name.dataset.editId; delete warehouseForm.elements.remark.dataset.editId; warehouseFormTitle.textContent = "新增仓库"; warehouseSubmitBtn.textContent = "保存"; warehouseCancelBtn.classList.add("hidden"); }
if (warehouseCancelBtn) warehouseCancelBtn.addEventListener("click", () => { warehouseForm.reset(); resetWarehouseForm(); });

/* ===========================================================
   Forms — 入库
   =========================================================== */
stockInForm.addEventListener("submit", async e => {
  e.preventDefault();
  try { await request("/api/stock-in", { method: "POST", body: JSON.stringify(ft(stockInForm)) }); stockInForm.reset(); stockInForm.elements.bizDate.value = today; await Promise.all([loadInventory(), loadLogs(), loadStats()]); showToast("✅ 入库成功"); }
  catch (err) { showToast(err.message, true); }
});

/* ===========================================================
   Forms — 出库
   =========================================================== */
stockOutForm.addEventListener("submit", async e => {
  e.preventDefault();
  try { await request("/api/stock-out", { method: "POST", body: JSON.stringify(ft(stockOutForm)) }); stockOutForm.reset(); stockOutForm.elements.bizDate.value = today; updateStockOutWarehouseSelect(); await Promise.all([loadInventory(), loadLogs(), loadStats()]); showToast("✅ 出库成功"); }
  catch (err) { showToast(err.message, true); }
});

/* ===========================================================
   Event delegation — 编辑/删除 goods & warehouses
   =========================================================== */
goodsList.addEventListener("click", async e => {
  const el = e.target.closest("button"); if (!el) return;
  if (el.classList.contains("btn-del")) {
    const ok = await showConfirm("删除货物", `确定删除货物 "${el.dataset.name}" 吗？\n（如果已有库存或流水记录则无法删除）`);
    if (!ok) return;
    try { await request(`/api/goods/${el.dataset.id}`, { method: "DELETE" }); await refreshAll(); showToast("货物删除成功"); }
    catch (err) { showToast(err.message, true); }
  } else if (el.classList.contains("btn-edit")) {
    goodsForm.elements.name.value = el.dataset.name; goodsForm.elements.unit.value = el.dataset.unit;
    goodsForm.elements.name.dataset.editId = el.dataset.id; goodsForm.elements.unit.dataset.editId = el.dataset.id;
    goodsFormTitle.textContent = "编辑货物"; goodsSubmitBtn.textContent = "更新"; goodsCancelBtn.classList.remove("hidden");
  }
});

warehouseList.addEventListener("click", async e => {
  const el = e.target.closest("button"); if (!el) return;
  if (el.classList.contains("btn-del")) {
    const ok = await showConfirm("删除仓库", `确定删除仓库 "${el.dataset.name}" 吗？\n（如果已有库存记录则无法删除）`);
    if (!ok) return;
    try { await request(`/api/warehouses/${el.dataset.id}`, { method: "DELETE" }); await refreshAll(); showToast("仓库删除成功"); }
    catch (err) { showToast(err.message, true); }
  } else if (el.classList.contains("btn-edit")) {
    warehouseForm.elements.name.value = el.dataset.name; warehouseForm.elements.remark.value = el.dataset.remark || "";
    warehouseForm.elements.name.dataset.editId = el.dataset.id; warehouseForm.elements.remark.dataset.editId = el.dataset.id;
    warehouseFormTitle.textContent = "编辑仓库"; warehouseSubmitBtn.textContent = "更新"; warehouseCancelBtn.classList.remove("hidden");
  } else if (el.dataset.resetpwd) {
    // already handled above
  } else if (el.dataset.userDelId) {
    // already handled above
  }
});

/* ===========================================================
   Reset Warehouse
   =========================================================== */
if (resetWarehouseBtn) {
  resetWarehouseBtn.addEventListener("click", async () => {
    const ok = await showConfirm(
      "重置仓库",
      "警告！此操作将清除所有货物、仓库、库存和出入库记录，但保留默认管理员账户。\n\n此操作不可恢复，确定要继续吗？"
    );
    if (!ok) return;

    // 二次确认
    const ok2 = await showConfirm(
      "再次确认",
      "您确定要重置仓库吗？所有数据将被永久删除！"
    );
    if (!ok2) return;

    try {
      showLoading();
      await request("/api/reset", { method: "POST", body: JSON.stringify({}) });
      showToast("仓库已重置成功");
      await refreshAll();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      hideLoading();
    }
  });
}

/* ===========================================================
   Init
   =========================================================== */
function init() {
  loadAppInfo();
  if (loadAuth() && currentUser) {
    showMainPage();
  } else {
    showLoginPage();
  }
  checkLoginHint();
}
init();
