// Register the service worker if supported
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('/budget-tracker/service-worker.js')
            .then(function (registration) {
                console.log('Service Worker registered with scope:', registration.scope);
            }).catch(function (error) {
                console.log('Service Worker registration failed:', error);
            });
    });
}

// Force HTTPS unless on localhost
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    location.href = 'https:' + window.location.href.substring(window.location.protocol.length);
}

// Load version from manifest
fetch('/budget-tracker/manifest.json')
    .then(response => response.json())
    .then(manifest => {
        const version = manifest.version || 'n/a';
        const versionEl = document.getElementById('app-version');
        if (versionEl) versionEl.textContent = version;
    })
    .catch(() => {
        const versionEl = document.getElementById('app-version');
        if (versionEl) versionEl.textContent = 'n/a';
    });

// Modal utilities
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'block';
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

function openSettings() {
    populateCategoryList();
    openModal('settings-modal');
}

// app.js (chart integration section only)

import {
  displayBarGraphCurrentMonth,
  displayBarGraphPast3Months,
  displayBarGraphRollingYear
} from './chart.js';

// Graph Modal Handling
function openGraph() {
  const graphModal = document.getElementById('graph-modal');
  if (graphModal) {
    graphModal.style.display = 'block';
    displayBarGraphCurrentMonth();
    displayBarGraphPast3Months();
    displayBarGraphRollingYear();
  }
}

function closeGraph() {
  const graphModal = document.getElementById('graph-modal');
  if (graphModal) {
    graphModal.style.display = 'none';
  }
}

// Export if used elsewhere
export { openGraph, closeGraph };

// IndexedDB initialization
let db;
let dbReady = false;
let domReady = false;

const request = indexedDB.open('budgetTrackerDB', 1);

request.onupgradeneeded = function (event) {
    db = event.target.result;
    if (!db.objectStoreNames.contains('transactions')) {
        db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
    }
    if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'name' });
    }
    if (!db.objectStoreNames.contains('budgetData')) {
        db.createObjectStore('budgetData', { keyPath: 'key' });
    }
};

request.onerror = function (event) {
    console.error("Database error:", event.target.errorCode);
};

request.onsuccess = function (event) {
    db = event.target.result;
    dbReady = true;
    console.log("DB ready");
    if (domReady) tryInitApp();
};

window.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM ready");
    while (!dbReady) {
        console.log("Waiting for DB...");
        await new Promise(r => setTimeout(r, 50)); // Poll until db is ready
    }
    console.log("Init App...");
    domReady = true;
    if (dbReady) tryInitApp();
});

// Wait until BOTH DB and DOM are ready before running initApp once
function tryInitApp() {
    if (dbReady && domReady) {
        console.log("DB and DOM ready — running initApp()");
        initApp();
    }
}

async function openTransactions() {
    const modal = document.getElementById("transactions-modal");
    if (!modal) return;
    modal.style.display = "block";

    const list = document.getElementById("transaction-list");
    if (!list) return;

    let txns = await getAllRecords("transactions");
    txns.sort((a, b) => new Date(b.date) - new Date(a.date));

    list.innerHTML = "";
    txns.forEach((txn) => {
        const li = document.createElement("li");
        li.innerHTML = `
            <input type="checkbox" class="transaction-checkbox" data-id="${txn.id}">
            ${txn.date} - $${txn.amount.toFixed(2)} - ${txn.category}
        `;
        li.ondblclick = () => editTransaction(txn.id);
        list.appendChild(li);
    });
}

function getAllRecords(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const objstore = transaction.objectStore(storeName);
        const request = objstore.getAll();

        request.onsuccess = function () {
            resolve(request.result);
        };
        request.onerror = function () {
            reject(request.error);
        };
    });
}

function getRecord(storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const objstore = transaction.objectStore(storeName);
        const request = objstore.get(key);

        request.onsuccess = function () {
            resolve(request.result);
        };
        request.onerror = function () {
            reject(request.error);
        };
    });
}

function saveRecord(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const objstore = transaction.objectStore(storeName);
        const request = objstore.put(data);

        request.onsuccess = function () {
            resolve();
        };
        request.onerror = function () {
            reject(request.error);
        };
    });
}

function deleteRecord(storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const objstore = transaction.objectStore(storeName);
        const request = objstore.delete(key);

        request.onsuccess = function () {
            resolve();
        };
        request.onerror = function () {
            reject(request.error);
        };
    });
}

async function deleteRecordById(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    await deleteRecord("transactions", id);
    await openTransactions();
    await updateTotalExpenses();
}

async function editTransaction(id) {
    const txn = await getRecord("transactions", id);
    if (!txn) return alert("Transaction not found");

    const modal = document.getElementById("edit-transaction-modal");
    if (!modal) return;

    document.getElementById("edit-amount").value = txn.amount;

    const catDropdown = document.getElementById("edit-category-dropdown");
    catDropdown.innerHTML = "";
    const categories = await getAllRecords("categories");
    categories.forEach(({ name }) => {
        const option = document.createElement("option");
        option.value = name;
        option.text = name;
        if (name === txn.category) option.selected = true;
        catDropdown.appendChild(option);
    });

    modal.style.display = "block";

    document.getElementById("save-edit-btn").onclick = async () => {
        const newAmount = parseFloat(document.getElementById("edit-amount").value);
        const newCategory = document.getElementById("edit-category-dropdown").value;
        if (isNaN(newAmount) || newAmount <= 0 || !newCategory) return alert("Invalid input");

        txn.amount = newAmount;
        txn.category = newCategory;
        await saveRecord("transactions", txn);

        modal.style.display = "none";
        await openTransactions();
        await updateTotalExpenses();
    };
}

// App initialization
async function initApp() {
    bindEventListeners();
    await populateCategoryList();
    await populateCategoryDropdown();
    await loadStartingBalance();
    updateSliderAmount();
    await updateTotalExpenses();
}

function bindEventListeners() {
    const bind = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener(event, fn);
        } else {
            console.warn(`Element #${id} not found.`);
        }
    };

    bind("open-settings", "click", openSettings);
    bind("open-graph", "click", openGraph);
    bind("close-graph", "click", () => closeModal("graph-modal"));
    bind("close-settings", "click", () => closeModal("settings-modal"));
    bind("close-transactions", "click", () => closeModal("transactions-modal"));
    bind("close-edit-transaction", "click", () => closeModal("edit-transaction-modal"));
    bind("bill-button", "click", billIt);
    bind("add-category", "click", addCategory);
    bind("delete-category", "click", deleteSelectedCategories);
    bind("save-settings-btn", "click", saveSettings);
    bind("open-transactions", "click", openTransactions);
    bind("total-expenses", "click", openTransactions);
    bind("slider", "input", updateSliderAmount);

    // Transaction modal delete (trash can icon)
    bind("delete-transaction", "click", async () => {
        const checkboxes = document.querySelectorAll(".transaction-checkbox:checked");
        for (const checkbox of checkboxes) {
            const id = parseInt(checkbox.dataset.id);
            if (!isNaN(id)) {
                await deleteRecordById(id);
            }
        }
    });

    // 🖱️ Double-click starting balance to edit
    const sb = document.getElementById("starting-balance");
    if (sb) sb.ondblclick = editStartingBalance;
}

async function populateCategoryList() {
    const listEl = document.getElementById("category-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    const categories = await getAllRecords("categories");
    categories.forEach(({ name }) => {
        const li = document.createElement("li");
        li.innerHTML = `
            <input type="checkbox" class="category-checkbox" data-name="${name}">
            <span class="category-name">${name}</span>
        `;
        listEl.appendChild(li);
    });
}

async function populateCategoryDropdown() {
    const dropdown = document.getElementById("category-dropdown");
    if (!dropdown) return;
    dropdown.innerHTML = "";

    const categories = await getAllRecords("categories");
    categories.forEach(({ name }) => {
        const option = document.createElement("option");
        option.value = name;
        option.text = name;
        dropdown.appendChild(option);
    });
}

async function addCategory() {
    const input = document.getElementById("new-category");
    if (!input || !input.value.trim()) return;

    const name = input.value.trim();
    await saveRecord("categories", { name });
    await populateCategoryList();
    await populateCategoryDropdown();
    input.value = "";
}

async function deleteSelectedCategories() {
    const checkboxes = document.querySelectorAll(".category-checkbox:checked");
    for (let checkbox of checkboxes) {
        await deleteRecord("categories", checkbox.dataset.name);
    }
    await populateCategoryList();
    await populateCategoryDropdown();
}

function saveSettings() {
    const pf = document.getElementById("pay-frequency-dropdown").value;
    localStorage.setItem("payFrequency", pf);
    alert("Settings saved.");
}

async function billIt() {
    const amtInput = document.getElementById("slider-amount");
    const slider = document.getElementById("slider");
    const catSelect = document.getElementById("category-dropdown");

    let val = parseFloat(amtInput.value.trim());
    if (isNaN(val) && slider) {
        val = parseFloat(slider.value);
    }

    const category = catSelect.value.trim();
    // if (!val || val <= 0 || !category) {
    if (!category || isNaN(val) || val <= 0) {
        return alert("Invalid input.");
    }

    const date = new Date().toISOString().split("T")[0];
    await saveRecord("transactions", { date, amount: val, category });
    alert("Transaction saved.");
    // Reset slider and input to default
    if (slider) slider.value = (slider.max - slider.min) / 2;
    if (amtInput) amtInput.value = "";
    updateSliderAmount();
    await updateTotalExpenses();
}

async function loadStartingBalance() {
    const sb = document.getElementById("starting-balance");
    const entry = await getRecord("budgetData", "startingBalance");
    if (sb && entry) {
        sb.innerText = `$ ${entry.value.toFixed(2)}`;
    }
}

function editStartingBalance() {
    const sb = document.getElementById("starting-balance");
    if (!sb) return;

    const input = document.createElement("input");
    input.type = "text";
    input.value = sb.innerText.replace(/[^\d.]/g, "");

    input.onblur = async () => {
        const val = parseFloat(input.value);
        if (isNaN(val)) return;
        await saveRecord("budgetData", { key: "startingBalance", value: val });
        sb.innerText = `$ ${val.toFixed(2)}`;
    };

    sb.innerHTML = "";
    sb.appendChild(input);
    input.focus();
}

async function updateTotalExpenses() {
    const totalEl = document.getElementById("total-expenses");
    if (!totalEl) return;
    const transactions = await getAllRecords("transactions");
    const total = transactions.reduce((sum, txn) => sum + txn.amount, 0);
    totalEl.textContent = `$ ${total.toFixed(2)}`;
}

function updateSliderAmount() {
    const slider = document.getElementById("slider");
    const amount = document.getElementById("slider-amount");
    if (slider && amount) amount.value = slider.value;
}

export { getAllRecords };
