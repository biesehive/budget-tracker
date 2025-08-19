// File: js/app.js
// Budget Tracker – Production-ready app.js (charts separated, full UI hooks, IndexedDB-backed)

"use strict";

// ---------------- Charts (separate module) ----------------
import {
  displayBarGraphCurrentMonth,
  displayBarGraphPast3Months,
  displayBarGraphYTD,
} from "./chart.js";

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
function qs(id) {
  return document.getElementById(id);
}

function formatDateForStorage(date) {
  return date.toISOString().split("T")[0];
}

function formatDateForDisplay(dateStr) {
  if (!dateStr) return "Invalid Date";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${m}/${d}/${y}`;
  }
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

function openModal(modalId) {
  const el = qs(modalId);
  if (el) el.classList.add("is-open");
}

function closeModal(modalId) {
  const el = qs(modalId);
  if (el) el.classList.remove("is-open");
}

function updateSliderAmount() {
  const slider = qs("slider");
  const amountField = qs("slider-amount");
  if (slider && amountField) amountField.value = parseFloat(slider.value).toFixed(2);
}

function sanitizeAmountInput(value) {
  const num = parseFloat(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(num) ? num : NaN;
}

async function updateRemainingBalance(startBalance, expenses) {
  const remaining = (startBalance || 0) - (expenses || 0);
  const el = qs("remaining-balance");
  if (el) el.innerText = `$ ${remaining.toFixed(2)}`;
}

function updateDailySpend(totalExpenses) {
  const today = new Date();
  const day = today.getDate() || 1;
  const daily = Math.floor((Number(totalExpenses) || 0) / day);
  const el = qs("daily-spend");
  if (el) el.innerText = `Daily spending $${daily}`;
}

async function updateTotalExpenses() {
  const transactionsData = await getAllRecords("transactions");
  const totalExpenses = transactionsData.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const el = qs("total-expenses");
  if (el) el.innerText = `$ ${totalExpenses.toFixed(2)}`;
  await updateRemainingBalance(startingBalance, totalExpenses);
  updateDailySpend(totalExpenses);
}

function updateDaysLeft() {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysLeft = Math.max(0, lastDay.getDate() - today.getDate());
  const el = qs("days-left");
  if (el) el.innerText = `${daysLeft} days until the end of the month`;
}

// ---------------- Event Bindings ----------------
function bindEventListeners() {
  const on = (id, event, fn) => {
    const el = qs(id);
    if (el) el.addEventListener(event, fn);
  };

  on("open-settings", "click", openSettings);
  on("open-graph", "click", openGraph);
  on("close-graph", "click", () => closeModal("graph-modal"));
  on("close-settings", "click", () => closeModal("settings-modal"));
  on("close-transactions", "click", () => closeModal("transactions-modal"));
  on("close-edit-transaction", "click", () => closeModal("edit-transaction-modal"));
  on("bill-button", "click", billIt);
  on("add-category", "click", addCategory);
  on("delete-category", "click", deleteSelectedCategories);
  on("delete-transaction", "click", deleteSelectedTransactions);
  on("save-settings-btn", "click", saveSettings);
  on("cleanup-btn", "click", deleteOldTransactions);
  on("open-transactions", "click", openTransactions);
  on("total-expenses", "dblclick", openTransactions);
  on("slider", "input", updateSliderAmount);

  const amountField = qs("slider-amount");
  if (amountField) {
    amountField.addEventListener("input", () => {
      const slider = qs("slider");
      if (!slider) return;
      const val = sanitizeAmountInput(amountField.value);
      if (!isNaN(val)) {
        const clamped = Math.min(Math.max(val, Number(slider.min)), Number(slider.max));
        slider.value = String(clamped);
      }
    });
  }

  const sb = qs("starting-balance");
  if (sb) sb.addEventListener("dblclick", editStartingBalance);

  document.querySelectorAll(".settings-icon").forEach((el) => el.addEventListener("dblclick", openSettings));
  document.querySelectorAll(".graph-icon").forEach((el) => el.addEventListener("dblclick", openGraph));

  const transactionsList = qs("transaction-list");
  if (transactionsList) {
    transactionsList.addEventListener("change", (e) => {
      if (e.target && e.target.classList.contains("transaction-checkbox")) {
        updateMainTrashDisabledState();
      }
    });
  }

  const categoryList = qs("category-list");
  if (categoryList) {
    categoryList.addEventListener("change", (e) => {
      if (e.target && e.target.classList.contains("category-checkbox")) {
        updateCategoryTrashDisabledState();
      }
    });
  }
}

// ---------------- Categories ----------------
async function populateCategoryList() {
  const listEl = qs("category-list");
  if (!listEl) return;
  listEl.innerHTML = "";

  let categoriesData = await getFromIndexedDB("categories", "default");
  let categories = categoriesData && Array.isArray(categoriesData.categories)
    ? categoriesData.categories
    : ["Other"];

  categories.forEach((category, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <label>
        <input type="checkbox" class="category-checkbox" data-index="${index}">
        <span class="category-name" id="category-${index}" title="Double-click to rename">${category}</span>
      </label>
    `;
    li.querySelector(".category-name").addEventListener("dblclick", () => editCategory(index));
    listEl.appendChild(li);
  });

  updateCategoryTrashDisabledState();
}

async function populateCategoryDropdown() {
  const dropdown = qs("category-dropdown");
  const editDropdown = qs("edit-category-dropdown");
  const fill = async (el) => {
    if (!el) return;
    el.innerHTML = "";
    let categoriesData = await getFromIndexedDB("categories", "default");
    let categories = categoriesData && Array.isArray(categoriesData.categories)
      ? categoriesData.categories
      : ["Other"];
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      el.appendChild(option);
    });
  };
  await fill(dropdown);
  await fill(editDropdown);
}

async function addCategory() {
  const inputEl = qs("new-category");
  const newCategory = inputEl ? inputEl.value.trim() : "";
  if (!newCategory) {
    alert("Please enter a category name.");
    return;
  }

  let categoriesData = await getFromIndexedDB("categories", "default");
  let categories = categoriesData && Array.isArray(categoriesData.categories)
    ? categoriesData.categories
    : [];

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
  const el = qs(`category-${index}`);
  if (!el) return;
  const currentName = el.textContent || "";

  const input = document.createElement("input");
  input.type = "text";
  input.value = currentName;
  input.className = "category-edit-input";

  const commit = async () => {
    const newName = input.value.trim();
    if (!newName || newName === currentName) {
      el.textContent = currentName;
      input.replaceWith(el);
      return;
    }
    let categoriesData = await getFromIndexedDB("categories", "default");
    let categories = categoriesData && Array.isArray(categoriesData.categories)
      ? categoriesData.categories
      : [];
    categories[index] = newName;
    await saveToIndexedDB("categories", { id: "default", categories });
    await populateCategoryList();
    await populateCategoryDropdown();
  };

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
  el.replaceWith(input);
  input.focus();
}

function updateCategoryTrashDisabledState() {
  const trash = qs("delete-category");
  if (!trash) return;
  const hasSelection = document.querySelectorAll(".category-checkbox:checked").length > 0;
  if (hasSelection) {
    trash.classList.remove("is-disabled");
    trash.setAttribute("aria-disabled", "false");
  } else {
    trash.classList.add("is-disabled");
    trash.setAttribute("aria-disabled", "true");
  }
}

async function deleteSelectedCategories() {
  const checkboxes = document.querySelectorAll(".category-checkbox:checked");
  if (!checkboxes.length) {
    alert("Please select categories to delete.");
    return;
  }
  let categoriesData = await getFromIndexedDB("categories", "default");
  let categories = categoriesData && Array.isArray(categoriesData.categories)
    ? categoriesData.categories
    : ["Other"];

  const indexesToDelete = Array.from(checkboxes).map((cb) => parseInt(cb.dataset.index, 10));
  const remaining = categories.filter((_, i) => !indexesToDelete.includes(i));

  if (!remaining.length) {
    if (!confirm("This will remove all categories. 'Other' will be added back automatically. Continue?")) return;
    remaining.push("Other");
  }

  await saveToIndexedDB("categories", { id: "default", categories: remaining });
  await populateCategoryList();
  await populateCategoryDropdown();
}

// ---------------- Transactions ----------------
async function getAllTransactions() {
  return getAllRecords("transactions");
}

async function openTransactions() {
  openModal("transactions-modal");
  await populateTransactionList();
}

async function populateTransactionList() {
  const list = qs("transaction-list");
  if (!list) return;
  let txns = await getAllTransactions();
  txns.sort((a, b) => new Date(b.date) - new Date(a.date));
  list.innerHTML = "";
  if (!txns.length) {
    list.innerHTML = "<li>No transactions available</li>";
    updateMainTrashDisabledState();
    return;
  }

  txns.forEach((txn) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <label class="transaction-item" title="Double-click to edit">
        <input type="checkbox" class="transaction-checkbox" data-id="${String(txn.id)}">
        <span class="transaction-date">${formatDateForDisplay(txn.date)}</span>
        <span class="transaction-amount">$${Number(txn.amount).toFixed(2)}</span>
        <span class="transaction-category">${txn.category || "Other"}</span>
      </label>
    `;
    li.addEventListener("dblclick", () => editTransaction(Number(txn.id)));
    list.appendChild(li);
  });

  updateMainTrashDisabledState();
}

function getCheckedTransactionIds() {
  return Array.from(document.querySelectorAll(".transaction-checkbox:checked"))
    .map((cb) => parseInt(cb.dataset.id, 10))
    .filter((id) => !Number.isNaN(id));
}

function updateMainTrashDisabledState() {
  const trash = qs("delete-transaction");
  if (!trash) return;
  const hasSelection = document.querySelectorAll(".transaction-checkbox:checked").length > 0;
  if (hasSelection) {
    trash.classList.remove("is-disabled");
    trash.setAttribute("aria-disabled", "false");
  } else {
    trash.classList.add("is-disabled");
    trash.setAttribute("aria-disabled", "true");
  }
}

async function editTransaction(transactionId) {
  const txn = await getFromIndexedDB("transactions", transactionId);
  if (!txn) { alert("Transaction not found."); return; }
  const amountEl = qs("edit-amount");
  const catDropdown = qs("edit-category-dropdown");
  if (!amountEl || !catDropdown) return;

  amountEl.value = Number(txn.amount).toFixed(2);
  catDropdown.innerHTML = "";

  let categoriesData = await getFromIndexedDB("categories", "default");
  let categories = categoriesData && Array.isArray(categoriesData.categories)
    ? categoriesData.categories
    : ["Other"];

  categories.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c; opt.textContent = c;
    if (c === (txn.category || "Other")) opt.selected = true;
    catDropdown.appendChild(opt);
  });

  openModal("edit-transaction-modal");

  const saveBtn = qs("save-edit-btn");
  if (saveBtn) saveBtn.onclick = async () => { await saveTransactionEdits(transactionId); };
}

async function saveTransactionEdits(transactionId) {
  const amountEl = qs("edit-amount");
  const catDropdown = qs("edit-category-dropdown");
  const newAmount = sanitizeAmountInput(amountEl?.value || "");
  const newCategory = (catDropdown?.value || "Other").trim() || "Other";

  if (isNaN(newAmount) || newAmount <= 0) { alert("Please enter a valid amount greater than 0."); return; }

  const txn = await getFromIndexedDB("transactions", transactionId);
  if (!txn) { alert("Transaction not found."); return; }

  txn.amount = Number(newAmount); txn.category = newCategory;

  await saveToIndexedDB("transactions", txn);
  closeModal("edit-transaction-modal");
  await populateTransactionList();
  await updateTotalExpenses();
}

async function deleteSelectedTransactions() {
  const ids = getCheckedTransactionIds();
  if (!ids.length) { alert("Please select transactions to delete."); return; }
  if (!confirm(`Delete ${ids.length} selected transaction(s)?`)) return;
  try {
    for (const id of ids) await deleteTransactionById(id);
    await populateTransactionList();
    await updateTotalExpenses();
  } catch (err) {
    alert("Failed to delete selected transactions. See console for details.");
    console.error(err);
  }
}

async function billIt() {
  const billButton = qs("bill-button");
  const amountField = qs("slider-amount");
  if (isProcessingTransaction || !billButton || !amountField) return;

  const rawAmount = amountField.value;
  const amountToBill = sanitizeAmountInput(rawAmount);

  billButton.disabled = true;
  amountField.disabled = true;

  if (!rawAmount || isNaN(amountToBill) || amountToBill <= 0) {
    alert("Please enter a valid amount greater than 0.");
    billButton.disabled = false;
    amountField.disabled = false;
    return;
  }

  isProcessingTransaction = true;
  const catEl = qs("category-dropdown");
  const selectedCategory = catEl ? (catEl.value || "Other") : "Other";
  const formattedDate = formatDateForStorage(new Date());

  try {
    await addRecord("transactions", { date: formattedDate, amount: Number(amountToBill), category: selectedCategory });
    await updateTotalExpenses();
  } catch (err) {
    alert("Failed to add transaction. See console for details.");
    console.error(err);
  }

  const slider = qs("slider");
  if (slider) slider.value = ((Number(slider.min) + Number(slider.max)) / 2).toString();
  updateSliderAmount();
  amountField.value = "";
  if (catEl) catEl.value = "Other";

  isProcessingTransaction = false;
  billButton.disabled = false;
  amountField.disabled = false;
}

// ---------------- Starting Balance ----------------
function editStartingBalance() {
  const balanceDiv = qs("starting-balance");
  if (!balanceDiv) return;

  const current = startingBalance;
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.value = current.toFixed(2);

  const commit = async () => {
    const newVal = sanitizeAmountInput(input.value);
    if (!isNaN(newVal) && newVal >= 0) {
      startingBalance = Number(newVal);
      await saveToIndexedDB("settings", { id: "startingBalance", value: startingBalance });
      balanceDiv.innerText = `$ ${startingBalance.toFixed(2)}`;

      const startingAmtInput = qs("starting-amount");
      if (startingAmtInput) startingAmtInput.value = startingBalance.toFixed(2);

      await updateTotalExpenses();
    } else {
      alert("Please enter a valid non-negative number for the starting balance.");
      balanceDiv.innerText = `$ ${current.toFixed(2)}`;
    }
  };

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });

  balanceDiv.innerHTML = "";
  balanceDiv.appendChild(input);
  input.focus();
}

// ---------------- Settings ----------------
function openSettings() {
  populateCategoryList();

  const stored = localStorage.getItem("payFrequency") || "monthly";
  const pf = qs("pay-frequency-dropdown");
  if (pf) pf.value = stored;

  const startingAmtInput = qs("starting-amount");
  if (startingAmtInput) startingAmtInput.value = startingBalance.toFixed(2);

  openModal("settings-modal");
}

async function saveSettings() {
  const pf = qs("pay-frequency-dropdown")?.value;
  if (pf) localStorage.setItem("payFrequency", pf);

  const amtRaw = qs("starting-amount")?.value;
  const amt = sanitizeAmountInput(amtRaw ?? "");

  if (!isNaN(amt) && amt >= 0) {
    startingBalance = Number(amt);
    await saveToIndexedDB("settings", { id: "startingBalance", value: startingBalance });

    const sb = qs("starting-balance");
    if (sb) sb.innerText = `$ ${startingBalance.toFixed(2)}`;

    await updateTotalExpenses();
    alert("Settings saved!");
  } else {
    alert("Please enter a valid non-negative number for the starting amount.");
  }
}

// ---------------- Cleanup (Delete Old Transactions) ----------------
async function deleteOldTransactions() {
  const today = new Date();
  const cutoff = new Date(today.getFullYear(), today.getMonth() - 12, 1);
  const input = prompt(
    "Delete transactions older than this date (YYYY-MM-DD). Leave blank to use default (12 months ago from this month start).",
    formatDateForStorage(cutoff)
  );
  if (input === null) return;

  let cutoffDate = cutoff;
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    cutoffDate = parseDate(input);
  }

  const txns = await getAllTransactions();
  const toDelete = txns.filter((t) => parseDate(t.date) < cutoffDate).map((t) => t.id);
  if (!toDelete.length) { alert("No transactions found before the specified date."); return; }

  if (!confirm(`This will delete ${toDelete.length} transaction(s) older than ${formatDateForDisplay(formatDateForStorage(cutoffDate))}. Continue?`)) return;

  for (const id of toDelete) {
    await deleteTransactionById(id);
  }

  await populateTransactionList();
  await updateTotalExpenses();
  alert("Old transactions deleted.");
}

// ---------------- Graph Trigger ----------------
async function openGraph() {
  openModal("graph-modal");
  await displayBarGraphCurrentMonth();
  await displayBarGraphPast3Months();
  await displayBarGraphYTD();
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

  // Ensure categories exist
  let categoriesData = await getFromIndexedDB("categories", "default");
  if (!categoriesData || !Array.isArray(categoriesData.categories)) {
    await saveToIndexedDB("categories", { id: "default", categories: ["Other"] });
  }

  // Load starting balance (default 0)
  const startingBalanceRecord = await getFromIndexedDB("settings", "startingBalance");
  if (startingBalanceRecord && typeof startingBalanceRecord.value === "number") {
    startingBalance = Number(startingBalanceRecord.value) || 0;
  } else {
    startingBalance = 0;
    await saveToIndexedDB("settings", { id: "startingBalance", value: startingBalance });
  }

  const sbEl = qs("starting-balance");
  if (sbEl) sbEl.innerText = `$ ${startingBalance.toFixed(2)}`;

  await populateCategoryList();
  await populateCategoryDropdown();
  await updateTotalExpenses();
  updateDaysLeft();

  // Slider setup + labels
  const slider = qs("slider");
  if (slider) {
    slider.min = "25";
    slider.max = "500";
    slider.value = ((25 + 500) / 2).toString();
    updateSliderAmount();
    const minValEl = qs("min-value"); const maxValEl = qs("max-value");
    if (minValEl) minValEl.textContent = Number(slider.min).toFixed(2);
    if (maxValEl) maxValEl.textContent = Number(slider.max).toFixed(2);
  }

  const startingAmtInput = qs("starting-amount");
  if (startingAmtInput) startingAmtInput.value = startingBalance.toFixed(2);
})();
