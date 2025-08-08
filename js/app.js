// ---------------- Service Worker ----------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/budget-tracker/service-worker.js")
      .then((reg) => console.log("SW registered:", reg.scope))
      .catch((err) => console.log("SW registration failed:", err));
  });
}

// ---------------- State ----------------
let db;
let startingBalance = 0;
let isProcessingTransaction = false;
let currentMonthChart = null;
let past3MonthsChart = null;
let ytdChart = null;

// ---------------- IndexedDB Helpers ----------------
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("budgetDB", 1);
    request.onupgradeneeded = function (e) {
      db = e.target.result;
      if (!db.objectStoreNames.contains("transactions")) {
        db.createObjectStore("transactions", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("categories")) {
        db.createObjectStore("categories", { keyPath: "id" }); // id: "default"
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "id" }); // id: "startingBalance"
      }
    };
    request.onsuccess = function (e) {
      db = e.target.result;
      resolve(db);
    };
    request.onerror = function (e) {
      console.error("Error opening IndexedDB:", e.target?.error || e);
      reject(e);
    };
  });
}

function getFromIndexedDB(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], "readonly");
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => {
      console.error("Error getting data from IndexedDB", request.error);
      reject(request.error);
    };
  });
}

function saveToIndexedDB(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error("Error saving data to IndexedDB", request.error);
      reject(request.error);
    };
  });
}

function getAllRecords(storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => {
      console.error("Error retrieving records from IndexedDB", request.error);
      reject(request.error);
    };
  });
}

function addRecord(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.add(data);
    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error("Error adding record to IndexedDB", request.error);
      reject(request.error);
    };
  });
}

function deleteTransactionById(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["transactions"], "readwrite");
    const store = tx.objectStore("transactions");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error("Error deleting transaction", request.error);
      reject(request.error);
    };
  });
}

// ---------------- Utility ----------------
function formatDateForStorage(date) { return date.toISOString().split("T")[0]; }

function formatDateForDisplay(dateStr) {
  if (!dateStr) return "Invalid Date";
  const parts = dateStr.split("-");
  if (parts.length === 3) { const [y, m, d] = parts; return `${m}/${d}/${y}`; }
  return dateStr;
}

function parseDate(dateString) {
  if (!dateString) return new Date();
  if (dateString.includes("-")) {
    const [y, m, d] = dateString.split("-").map((p) => parseInt(p, 10));
    return new Date(y, (m || 1) - 1, d || 1);
  }
  if (dateString.includes("/")) {
    const [a, b, c] = dateString.split("/").map((p) => parseInt(p, 10));
    if (a > 12) return new Date(c, (b || 1) - 1, a || 1);
    return new Date(c, (a || 1) - 1, b || 1);
  }
  return new Date();
}

function closeModal(modalId) { const el = document.getElementById(modalId); if (el) el.style.display = "none"; }

function updateSliderAmount() {
  const slider = document.getElementById("slider");
  const amountField = document.getElementById("slider-amount");
  if (slider && amountField) amountField.value = parseFloat(slider.value).toFixed(2);
}

async function updateRemainingBalance(startBalance, expenses) {
  const remaining = (startBalance || 0) - (expenses || 0);
  const el = document.getElementById("remaining-balance");
  if (el) el.innerText = `$ ${remaining.toFixed(2)}`;
}

async function updateTotalExpenses() {
  const transactionsData = await getAllRecords("transactions");
  const totalExpenses = transactionsData.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const el = document.getElementById("total-expenses");
  if (el) el.innerText = `$ ${totalExpenses.toFixed(2)}`;
  await updateRemainingBalance(startingBalance, totalExpenses);
  updateDailySpend(totalExpenses);
}

function updateDaysLeft() {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysLeft = lastDay.getDate() - today.getDate();
  const el = document.getElementById("days-left");
  if (el) el.innerText = `${daysLeft} days until the end of the month`;
}

function updateDailySpend(totalExpenses) {
  const today = new Date();
  const day = today.getDate() || 1;
  const daily = Math.floor((Number(totalExpenses) || 0) / day);
  const el = document.getElementById("daily-spend");
  if (el) el.innerText = `Daily spending $${daily}`;
}

// ---------------- Event Bindings ----------------
function bindEventListeners() {
  const on = (id, event, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(event, fn); };

  on("open-settings", "click", openSettings);
  on("open-graph", "click", openGraph);
  on("close-graph", "click", () => closeModal("graph-modal"));
  on("close-settings", "click", () => closeModal("settings-modal"));
  on("close-transactions", "click", () => closeModal("transactions-modal"));
  on("close-edit-transaction", "click", () => closeModal("edit-transaction-modal"));
  on("bill-button", "click", billIt);
  on("add-category", "click", addCategory);
  on("delete-category", "click", deleteSelectedCategories);
  on("delete-transactions", "click", deleteSelectedTransactions);
  on("save-settings-btn", "click", saveSettings);
  on("open-transactions", "click", openTransactions);
  on("total-expenses", "dblclick", openTransactions);
  on("slider", "input", updateSliderAmount);

  const sb = document.getElementById("starting-balance");
  if (sb) sb.ondblclick = editStartingBalance;

  document.querySelectorAll(".settings-icon").forEach((el) => el.addEventListener("dblclick", openSettings));
  document.querySelectorAll(".graph-icon").forEach((el) => el.addEventListener("dblclick", openGraph));
}

// ---------------- Categories ----------------
async function populateCategoryList() {
  const listEl = document.getElementById("category-list");
  if (!listEl) return;
  listEl.innerHTML = "";

  let categoriesData = await getFromIndexedDB("categories", "default");
  let categories = categoriesData ? categoriesData.categories : ["Other"];

  categories.forEach((category, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <input type="checkbox" class="category-checkbox" data-index="${index}">
      <span class="category-name" id="category-${index}">${category}</span>
    `;
    li.querySelector(".category-name").ondblclick = () => editCategory(index);
    listEl.appendChild(li);
  });
}

async function populateCategoryDropdown() {
  const dropdown = document.getElementById("category-dropdown");
  if (!dropdown) return;
  dropdown.innerHTML = "";

  let categoriesData = await getFromIndexedDB("categories", "default");
  let categories = categoriesData ? categoriesData.categories : ["Other"];

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    dropdown.appendChild(option);
  });
}

async function addCategory() {
  const inputEl = document.getElementById("new-category");
  const newCategory = inputEl ? inputEl.value.trim() : prompt("Enter new category:")?.trim();
  if (!newCategory) return;

  let categoriesData = await getFromIndexedDB("categories", "default");
  let categories = categoriesData ? categoriesData.categories : [];

  if (!categories.includes(newCategory)) {
    categories.push(newCategory);
    await saveToIndexedDB("categories", { id: "default", categories });
    await populateCategoryList();
    await populateCategoryDropdown();
    if (inputEl) inputEl.value = "";
  } else {
    alert("Category already exists.");
  }
}

async function editCategory(index) {
  const el = document.getElementById(`category-${index}`);
  if (!el) return;
  const currentName = el.innerText;

  const input = document.createElement("input");
  input.type = "text";
  input.value = currentName;
  input.onblur = async () => {
    const newName = input.value.trim();
    if (!newName || newName === currentName) {
      el.textContent = currentName;
      return;
    }
    let categoriesData = await getFromIndexedDB("categories", "default");
    let categories = categoriesData ? categoriesData.categories : [];
    categories[index] = newName;
    await saveToIndexedDB("categories", { id: "default", categories });
    await populateCategoryList();
    await populateCategoryDropdown();
  };
  input.onkeydown = (e) => { if (e.key === "Enter") input.blur(); };
  el.replaceWith(input);
  input.focus();
}

async function deleteSelectedCategories() {
  let checkboxes = document.querySelectorAll(".category-checkbox:checked");
  if (!checkboxes.length) return;
  let categoriesData = await getFromIndexedDB("categories", "default");
  let categories = categoriesData ? categoriesData.categories : ["Other"];
  let indexesToDelete = Array.from(checkboxes).map((cb) => parseInt(cb.dataset.index, 10));
  categories = categories.filter((_, i) => !indexesToDelete.includes(i));
  await saveToIndexedDB("categories", { id: "default", categories });
  await populateCategoryList();
  await populateCategoryDropdown();
}

// ---------------- Transactions ----------------
async function getAllTransactions() { return getAllRecords("transactions"); }

async function openTransactions() {
  const modal = document.getElementById("transactions-modal");
  if (!modal) return;
  modal.style.display = "block";
  await populateTransactionList();
}

async function populateTransactionList() {
  const list = document.getElementById("transaction-list");
  if (!list) return;
  let txns = await getAllTransactions();
  txns.sort((a, b) => new Date(b.date) - new Date(a.date));
  list.innerHTML = "";
  if (!txns.length) { list.innerHTML = "<li>No transactions available</li>"; return; }
  txns.forEach((txn) => {
    const li = document.createElement("li");
    li.innerHTML = `
    <label class="transaction-item">
        <input type="checkbox" class="transaction-checkbox" data-id="${String(txn.id)}">
        <span class="transaction-date">${formatDateForDisplay(txn.date)}</span>
        <span class="transaction-amount">$${Number(txn.amount).toFixed(2)}</span>
        <span class="transaction-category">${txn.category}</span>
    </label>
    `;
        li.ondblclick = () => editTransaction(txn.id);
        list.appendChild(li);
  });
//   document.querySelectorAll(".delete-transaction").forEach((btn) => {
//     btn.addEventListener("click", async (e) => {
//       const id = parseInt(e.currentTarget.getAttribute("data-id"), 10);
//       if (Number.isNaN(id)) return;
//       try {
//         await deleteTransactionById(id);
//         await updateTotalExpenses();
//         await populateTransactionList();
//       } catch (err) {
//         alert("Failed to delete transaction. See console for details.");
//         console.error(err);
//       }
//     });
//   });
}

async function editTransaction(transactionId) {
  const txn = await getFromIndexedDB("transactions", transactionId);
  if (!txn) { alert("Transaction not found."); return; }
  const amountEl = document.getElementById("edit-amount");
  const catDropdown = document.getElementById("edit-category-dropdown");
  if (!amountEl || !catDropdown) return;
  amountEl.value = Number(txn.amount).toFixed(2);
  catDropdown.innerHTML = "";
  let categoriesData = await getFromIndexedDB("categories", "default");
  let categories = categoriesData ? categoriesData.categories : ["Other"];
  categories.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c; opt.textContent = c;
    if (c === txn.category) opt.selected = true;
    catDropdown.appendChild(opt);
  });
  const modal = document.getElementById("edit-transaction-modal");
  if (modal) modal.style.display = "block";
  const saveBtn = document.getElementById("save-edit-btn");
  if (saveBtn) saveBtn.onclick = async () => { await saveTransactionEdits(transactionId); };
}

async function saveTransactionEdits(transactionId) {
  const amountEl = document.getElementById("edit-amount");
  const catDropdown = document.getElementById("edit-category-dropdown");
  const newAmount = parseFloat(amountEl?.value || "");
  const newCategory = catDropdown?.value || "Other";
  if (isNaN(newAmount) || newAmount <= 0) { alert("Please enter a valid amount."); return; }
  const txn = await getFromIndexedDB("transactions", transactionId);
  if (!txn) { alert("Transaction not found."); return; }
  txn.amount = newAmount; txn.category = newCategory;
  await saveToIndexedDB("transactions", txn);
  closeModal("edit-transaction-modal");
  await populateTransactionList();
  await updateTotalExpenses();
}

async function deleteSelectedTransactions() {
  const checked = document.querySelectorAll(".transaction-checkbox:checked");
  if (!checked.length) { alert("Please select transactions to delete."); return; }
  try {
    for (const cb of checked) {
      const id = parseInt(cb.getAttribute("data-id"), 10);
      if (!Number.isNaN(id)) await deleteTransactionById(id);
    }
    await populateTransactionList();
    await updateTotalExpenses();
  } catch (err) {
    alert("Failed to delete selected transactions. See console for details.");
    console.error(err);
  }
}

async function billIt() {
  const billButton = document.getElementById("bill-button");
  const amountField = document.getElementById("slider-amount");
  if (isProcessingTransaction || !billButton || !amountField) return;

  let manualAmount = amountField.value;
  billButton.disabled = true;
  amountField.disabled = true;

  if (!manualAmount || isNaN(manualAmount) || parseFloat(manualAmount) <= 0) {
    billButton.disabled = false;
    amountField.disabled = false;
    return;
  }

  isProcessingTransaction = true;
  const amountToBill = parseFloat(manualAmount);
  const catEl = document.getElementById("category-dropdown");
  const selectedCategory = catEl ? catEl.value : "Other";
  const formattedDate = formatDateForStorage(new Date());

  try {
    await addRecord("transactions", { date: formattedDate, amount: amountToBill, category: selectedCategory });
    await updateTotalExpenses();
  } catch (err) {
    alert("Failed to add transaction. See console for details.");
    console.error(err);
  }

  const slider = document.getElementById("slider");
  if (slider) slider.value = ((25 + 500) / 2).toString();
  updateSliderAmount();
  amountField.value = "";
  if (catEl) catEl.value = "Other";

  isProcessingTransaction = false;
  billButton.disabled = false;
  amountField.disabled = false;
}

// ---------------- Starting Balance ----------------
function editStartingBalance() {
  const balanceDiv = document.getElementById("starting-balance");
  if (!balanceDiv) return;
  const input = document.createElement("input");
  input.type = "text";
  input.value = startingBalance.toFixed(2);
  input.onblur = async () => {
    const newBalance = parseFloat(input.value);
    if (!isNaN(newBalance) && newBalance >= 0) {
      startingBalance = newBalance;
      await saveToIndexedDB("settings", { id: "startingBalance", value: newBalance });
      balanceDiv.innerText = `$ ${newBalance.toFixed(2)}`;
      await updateTotalExpenses();
    } else {
      alert("Please enter a valid number for the balance");
      balanceDiv.innerText = `$ ${startingBalance.toFixed(2)}`;
    }
  };
  input.onkeydown = (e) => { if (e.key === "Enter") input.blur(); };
  balanceDiv.innerHTML = "";
  balanceDiv.appendChild(input);
  input.focus();
}

// ---------------- Settings ----------------
function openSettings() { populateCategoryList(); const m = document.getElementById("settings-modal"); if (m) m.style.display = "block"; }
function saveSettings() {
  const v = document.getElementById("pay-frequency-dropdown")?.value;
  if (v) localStorage.setItem("payFrequency", v);
  alert("Settings saved!");
}

// ---------------- Graphs (Chart.js) ----------------
function closeGraph() { closeModal("graph-modal"); }

function buildCategoryTotals(transactions) {
  const totals = {};
  transactions.forEach((t) => { const c = t.category || "Other"; totals[c] = (totals[c] || 0) + (Number(t.amount) || 0); });
  const labels = Object.keys(totals).filter((k) => totals[k] > 0);
  const values = labels.map((k) => totals[k]);
  return { labels, values };
}

function renderBarChart(ctx, chartRef, labels, values, label) {
  if (chartRef && chartRef.destroy) chartRef.destroy();
  if (typeof Chart === "undefined") return null; // Chart.js guard
  return new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label, data: values }] },
    options: {
      responsive: true,
      indexAxis: "y",
      scales: {
        x: { min: 50, max: 500, ticks: { stepSize: 50 }, title: { display: true, text: "Amount ($)" } },
        y: { title: { display: true, text: "Categories" } },
      },
    },
  });
}

async function openGraph() {
  const modal = document.getElementById("graph-modal"); if (modal) modal.style.display = "block";
  await displayBarGraphCurrentMonth();
  await displayBarGraphPast3Months();
  await displayBarGraphYTD();
}

async function displayBarGraphCurrentMonth() {
  const canvas = document.getElementById("barChartCurrentMonth"); if (!canvas) return;
  const data = await filterTransactionsByCurrentMonth();
  const { labels, values } = buildCategoryTotals(data);
  currentMonthChart = renderBarChart(canvas.getContext("2d"), currentMonthChart, labels, values, "Expenses for Current Month");
}

async function displayBarGraphPast3Months() {
  const canvas = document.getElementById("barChartPast3Months"); if (!canvas) return;
  const data = await filterTransactionsByPast3Months();
  const { labels, values } = buildCategoryTotals(data);
  past3MonthsChart = renderBarChart(canvas.getContext("2d"), past3MonthsChart, labels, values, "Expenses for Past 3 Months");
}

async function displayBarGraphYTD() {
  const canvas = document.getElementById("barChartYTD"); if (!canvas) return;
  const data = await filterTransactionsByYTD();
  const { labels, values } = buildCategoryTotals(data);
  ytdChart = renderBarChart(canvas.getContext("2d"), ytdChart, labels, values, "Year-to-Date Expenses");
}

// ---------------- Date Filters ----------------
async function filterTransactionsByCurrentMonth() {
  const today = new Date();
  const m = today.getMonth();
  const y = today.getFullYear();
  const txns = await getAllTransactions();
  return txns.filter((t) => { const d = parseDate(t.date); return d.getMonth() === m && d.getFullYear() === y; });
}

async function filterTransactionsByPast3Months() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth() - 2, 1);
  const txns = await getAllTransactions();
  return txns.filter((t) => { const d = parseDate(t.date); return d >= from && d <= today; });
}

async function filterTransactionsByYTD() {
  const today = new Date();
  const from = new Date(today.getFullYear(), 0, 1);
  const txns = await getAllTransactions();
  return txns.filter((t) => { const d = parseDate(t.date); return d >= from && d <= today; });
}

// ---------------- Clear Stores (Utility) ----------------
function clearIndexedDBObjectStore(storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => { console.error(`Error clearing ${storeName}`, req.error); reject(req.error); };
  });
}
function clearAllStores() { ["transactions", "categories", "settings"].forEach((s) => clearIndexedDBObjectStore(s)); }

// ---------------- Init ----------------
(async function init() {
  await openDB();
  bindEventListeners();

  let categoriesData = await getFromIndexedDB("categories", "default");
  if (!categoriesData) {
    await saveToIndexedDB("categories", { id: "default", categories: ["Other"] });
    categoriesData = await getFromIndexedDB("categories", "default");
  }

  const startingBalanceRecord = await getFromIndexedDB("settings", "startingBalance");
  startingBalance = Number(startingBalanceRecord?.value) || 5500;
  const sbEl = document.getElementById("starting-balance");
  if (sbEl) sbEl.innerText = `$ ${startingBalance.toFixed(2)}`;

  await populateCategoryList();
  await populateCategoryDropdown();
  await updateTotalExpenses();
  updateDaysLeft();

  const slider = document.getElementById("slider");
  if (slider) { slider.min = "25"; slider.max = "500"; slider.value = ((25 + 500) / 2).toString(); updateSliderAmount(); }
})();

