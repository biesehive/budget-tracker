// Initialize IndexedDB
let db;
const request = indexedDB.open('budgetTrackerDB', 1);

// Set up the database
request.onupgradeneeded = function(event) {
    db = event.target.result;
    
    // Create object stores for transactions, categories, and budget data
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

// On success
request.onsuccess = function(event) {
    db = event.target.result;
    initApp();
};

request.onerror = function(event) {
    console.error('Error opening IndexedDB:', event.target.errorCode);
};

// Utility function to get data from IndexedDB
function getFromIndexedDB(storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = function() {
            resolve(request.result);
        };
        request.onerror = function() {
            reject('Error getting data from IndexedDB');
        };
    });
}

// Utility function to save data to IndexedDB
function saveToIndexedDB(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);

        request.onsuccess = function() {
            resolve();
        };
        request.onerror = function() {
            reject('Error saving data to IndexedDB');
        };
    });
}

// Initialize the app after IndexedDB is set up
async function initApp() {
    // Retrieve stored categories and transactions, or set default
    let categoriesData = await getFromIndexedDB('categories', 'default');
    let categories = categoriesData ? categoriesData.categories : ['Other'];

    let transactionsData = await getFromIndexedDB('transactions', 1);
    let transactions = transactionsData ? transactionsData.transactions : [];

    // Save initialized values back into IndexedDB if needed
    await saveToIndexedDB('categories', { name: 'default', categories });
    await saveToIndexedDB('transactions', { id: 1, transactions });

    // Retrieve starting balance and total expenses or set defaults
    let startingBalanceData = await getFromIndexedDB('budgetData', 'startingBalance');
    let totalExpensesData = await getFromIndexedDB('budgetData', 'totalExpenses');
    
    let startingBalance = startingBalanceData ? startingBalanceData.value : 5500;
    let totalExpenses = totalExpensesData ? totalExpensesData.value : 0;

    // Update UI with initial values
    document.getElementById("starting-balance").innerText = `$ ${startingBalance}`;
    document.getElementById("total-expenses").innerText = `$ ${totalExpenses}`;
    updateRemainingBalance(startingBalance, totalExpenses);
    updateDaysLeft();
    updateDailySpend(totalExpenses);

    // Initialize slider values
    let minSliderValue = 25;
    let maxSliderValue = 500;
    document.getElementById("slider").min = minSliderValue;
    document.getElementById("slider").max = maxSliderValue;
    document.getElementById("slider").value = (minSliderValue + maxSliderValue) / 2;

    // Example: Event listener for slider
    document.getElementById("slider").addEventListener("input", function(event) {
        let value = event.target.value;
        document.getElementById("slider-amount").value = value;
    });

    // Populate category dropdown
    populateCategoryDropdown(categories);

    // Event listener for the "Bill It" button
    document.getElementById("bill-button").addEventListener("click", async () => {
        let manualAmount = document.getElementById("slider-amount").value;
        if (!manualAmount || isNaN(manualAmount) || parseInt(manualAmount) <= 0) {
            alert("Please enter a valid amount in the 'Enter amount' field");
            return;
        }

        let amountToBill = parseInt(manualAmount);
        let selectedCategory = document.getElementById("category-dropdown").value;
        let today = new Date();
        let formattedDate = formatDateForStorage(today);

        transactions.push({ date: formattedDate, amount: amountToBill, category: selectedCategory });
        await saveToIndexedDB('transactions', { id: 1, transactions });

        totalExpenses += amountToBill;
        await saveToIndexedDB('budgetData', { key: 'totalExpenses', value: totalExpenses });

        document.getElementById("total-expenses").innerText = `$ ${totalExpenses}`;
        updateRemainingBalance(startingBalance, totalExpenses);
    });
}

// Utility function to format date for storage
const formatDateForStorage = date => 
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Function to update the remaining balance
async function updateRemainingBalance(startingBalance, totalExpenses) {
    let remainingBalance = startingBalance - totalExpenses;
    document.getElementById("remaining-balance").innerText = `$ ${remainingBalance}`;
}

// Function to update days left in the month
function updateDaysLeft() {
    let today = new Date();
    let lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    let daysLeft = lastDayOfMonth.getDate() - today.getDate();
    document.getElementById("days-left").innerText = `${daysLeft} days until the end of the month`;
}

// Function to update daily spend
function updateDailySpend(totalExpenses) {
    let today = new Date();
    let dayOfMonth = today.getDate();
    let dailySpend = Math.floor(totalExpenses / dayOfMonth);
    document.getElementById("daily-spend").innerText = `Daily spending $${dailySpend}`;
}

// Populate the category dropdown
function populateCategoryDropdown(categories) {
    let categoryDropdown = document.getElementById("category-dropdown");
    categoryDropdown.innerHTML = ''; // Clear any existing options

    categories.forEach(category => {
        let option = document.createElement('option');
        option.value = category;
        option.text = category;
        categoryDropdown.appendChild(option);
    });
}
