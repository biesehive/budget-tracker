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
fetch('manifest.json')
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

function openGraph() {
    openModal('graph-modal');
}

// IndexedDB initialization
let db;
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
};

window.addEventListener("DOMContentLoaded", initApp);

function getAllFromStore(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = function () {
            resolve(request.result);
        };
        request.onerror = function () {
            reject(request.error);
        };
    });
}

function getFromStore(storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = function () {
            resolve(request.result);
        };
        request.onerror = function () {
            reject(request.error);
        };
    });
}

function saveToStore(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);

        request.onsuccess = function () {
            resolve();
        };
        request.onerror = function () {
            reject(request.error);
        };
    });
}

function deleteFromStore(storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = function () {
            resolve();
        };
        request.onerror = function () {
            reject(request.error);
        };
    });
}

// App initialization
async function initApp() {
    bindEventListeners();
    await populateCategoryList();
    await populateCategoryDropdown();
}

// function bindEventListeners() {
//     const bind = (id, event, fn) => {
//         const el = document.getElementById(id);
//         if (el) el.addEventListener(event, fn);
//     };
function bindEventListeners() {
    console.log('Binding event listeners...');

    const bind = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener(event, fn);
            console.log(`Bound ${event} to #${id}`);
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
    bind("total-expenses", "click", openGraph);
    bind("slider", "input", updateSliderAmount);

    const sb = document.getElementById("starting-balance");
    if (sb) sb.ondblclick = editStartingBalance;
}

async function populateCategoryList() {
    const listEl = document.getElementById("category-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    const categories = await getAllFromStore("categories");
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

    const categories = await getAllFromStore("categories");
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
    await saveToStore("categories", { name });
    await populateCategoryList();
    await populateCategoryDropdown();
    input.value = "";
}

async function deleteSelectedCategories() {
    const checkboxes = document.querySelectorAll(".category-checkbox:checked");
    for (let checkbox of checkboxes) {
        await deleteFromStore("categories", checkbox.dataset.name);
    }
    await populateCategoryList();
    await populateCategoryDropdown();
}

function saveSettings() {
    const pf = document.getElementById("pay-frequency-dropdown").value;
    localStorage.setItem("payFrequency", pf);
    alert("Settings saved.");
}

async function openTransactions() {
    const modal = document.getElementById("transactions-modal");
    if (!modal) return;
    modal.style.display = "block";

    const list = document.getElementById("transaction-list");
    if (!list) return;

    const txns = await getAllFromStore("transactions");
    list.innerHTML = txns.map(txn => `
        <li>
            <input type="checkbox">
            ${txn.date} - $${txn.amount} - ${txn.category}
        </li>
    `).join("");
}

async function billIt() {
    const amtInput = document.getElementById("slider-amount");
    const catSelect = document.getElementById("category-dropdown");
    const val = parseFloat(amtInput.value);
    const category = catSelect.value;
    if (!val || val <= 0 || !category) return alert("Invalid input.");

    const date = new Date().toISOString().split("T")[0];
    await saveToStore("transactions", { date, amount: val, category });
    alert("Transaction saved.");
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
        await saveToStore("budgetData", { key: "startingBalance", value: val });
        sb.innerText = `$ ${val.toFixed(2)}`;
    };

    sb.innerHTML = "";
    sb.appendChild(input);
    input.focus();
}

function updateSliderAmount() {
    const slider = document.getElementById("slider");
    const amount = document.getElementById("slider-amount");
    if (slider && amount) amount.value = slider.value;
}
