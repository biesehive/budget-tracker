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
                db.createObjectStore("categories", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("settings")) {
                db.createObjectStore("settings", { keyPath: "id" });
            }
        };
        request.onsuccess = function (e) {
            db = e.target.result;
            resolve(db);
        };
        request.onerror = function (e) {
            reject(e);
        };
    });
}

function getFromIndexedDB(storeName, key) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], "readonly");
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function saveToIndexedDB(storeName, data) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], "readwrite");
        const store = tx.objectStore(storeName);
        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function getAllRecords(storeName) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], "readonly");
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function addRecord(storeName, data) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], "readwrite");
        const store = tx.objectStore(storeName);
        const request = store.add(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function deleteTransactionById(id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["transactions"], "readwrite");
        const store = tx.objectStore("transactions");
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ---------------- Utility ----------------
function formatDateForStorage(date) {
    return date.toISOString().split("T")[0];
}

// ---------------- Event Bindings ----------------
function bindEventListeners() {
    const bind = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, fn);
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

    const sb = document.getElementById("starting-balance");
    if (sb) sb.ondblclick = editStartingBalance;
}

// ---------------- Transactions ----------------
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
            <span class="delete-transaction" data-id="${txn.id}">🗑</span>
        `;
        li.ondblclick = () => editTransaction(txn.id);
        list.appendChild(li);
    });

    document.querySelectorAll(".delete-transaction").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = parseInt(e.target.getAttribute("data-id"));
            await deleteTransactionById(id);
            await updateTotalExpenses();
            openTransactions();
        });
    });
}

async function billIt() {
    const billButton = document.getElementById("bill-button");
    const amountField = document.getElementById("slider-amount");
    if (isProcessingTransaction) return;

    let manualAmount = amountField.value;
    billButton.disabled = true;
    amountField.disabled = true;

    if (!manualAmount || isNaN(manualAmount) || parseFloat(manualAmount) <= 0) {
        billButton.disabled = false;
        amountField.disabled = false;
        return;
    }

    isProcessingTransaction = true;
    let amountToBill = parseFloat(manualAmount);
    let selectedCategory = document.getElementById("category-dropdown").value;
    let formattedDate = formatDateForStorage(new Date());

    await addRecord("transactions", { date: formattedDate, amount: amountToBill, category: selectedCategory });
    await updateTotalExpenses();

    document.getElementById("slider").value = (25 + 500) / 2;
    updateSliderAmount();
    amountField.value = "";
    document.getElementById("category-dropdown").value = "Other";

    isProcessingTransaction = false;
    billButton.disabled = false;
    amountField.disabled = false;
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
        li.querySelector('.category-name').ondblclick = () => editCategory(index);
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
    const newCategory = prompt("Enter new category:");
    if (!newCategory) return;

    let categoriesData = await getFromIndexedDB("categories", "default");
    let categories = categoriesData ? categoriesData.categories : ["Other"];

    if (!categories.includes(newCategory)) {
        categories.push(newCategory);
        await saveToIndexedDB("categories", { id: "default", categories });
        populateCategoryList();
        populateCategoryDropdown();
    }
}

async function deleteSelectedCategories() {
    let checkboxes = document.querySelectorAll(".category-checkbox:checked");
    if (!checkboxes.length) return;

    let categoriesData = await getFromIndexedDB("categories", "default");
    let categories = categoriesData ? categoriesData.categories : ["Other"];

    let indexesToDelete = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
    categories = categories.filter((_, i) => !indexesToDelete.includes(i));

    await saveToIndexedDB("categories", { id: "default", categories });
    populateCategoryList();
    populateCategoryDropdown();
}

// ---------------- Balances & Slider ----------------
async function updateTotalExpenses() {
    let transactionsData = await getAllRecords("transactions");
    let totalExpenses = transactionsData.reduce((sum, t) => sum + t.amount, 0);
    document.getElementById("total-expenses").innerText = `$ ${totalExpenses.toFixed(2)}`;
    await updateRemainingBalance(startingBalance, totalExpenses);
}

async function updateRemainingBalance(startBalance, expenses) {
    let remaining = startBalance - expenses;
    document.getElementById("remaining-balance").innerText = `$ ${remaining.toFixed(2)}`;
}

function editStartingBalance() {
    const newBalance = prompt("Enter new starting balance:", startingBalance);
    if (newBalance !== null && !isNaN(parseFloat(newBalance))) {
        startingBalance = parseFloat(newBalance);
        updateTotalExpenses();
    }
}

function updateSliderAmount() {
    const slider = document.getElementById("slider");
    const amountField = document.getElementById("slider-amount");
    if (slider && amountField) {
        amountField.value = parseFloat(slider.value).toFixed(2);
    }
}

// ---------------- Init ----------------
(async function init() {
    await openDB();
    bindEventListeners();
    populateCategoryList();
    populateCategoryDropdown();
    updateTotalExpenses();
})();
