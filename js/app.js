// Register the service worker if supported
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/budget-tracker/service-worker.js')
        .then(function(registration) {
            console.log('Service Worker registered with scope:', registration.scope);
        }).catch(function(error) {
            console.log('Service Worker registration failed:', error);
        });
    });
}

// Initialize IndexedDB
let db;
const request = indexedDB.open('budgetTrackerDB', 1);
let startingBalance = 3500;  
let totalExpenses = 0; // Initialize globally if needed

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
    // Clear the transactions and categories stores
    // clearIndexedDBObjectStore('transactions');
    // clearIndexedDBObjectStore('categories');

    // Retrieve stored categories and transactions, or set default
    //clearIndexedDBObjectStore('categories');

    // Retrieve stored categories and transactions, or set default
    let categoriesData = await getFromIndexedDB('categories', 'default');
    let categories = categoriesData ? categoriesData.categories : ['Other'];

    // Fetch all transactions properly using getAllTransactions()
    let transactionsData = await getAllTransactions(); // Fetch all transactions

    // Save initialized values back into IndexedDB if needed
    if (!categoriesData) {
        await saveToIndexedDB('categories', { name: 'default', categories });
    }

    // Check for last reset date and reset if necessary
    await checkAndResetForNewMonth();
    
    // Retrieve starting balance from IndexedDB or set default
    let startingBalanceData = await getFromIndexedDB('budgetData', 'startingBalance');
    let startingBalance = Number(startingBalanceData?.value) || 5500;

    // Calculate total expenses dynamically based on transactions
    let totalExpenses = transactionsData.reduce((sum, transaction) => sum + transaction.amount, 0);

    // Update UI with initial values
    document.getElementById("starting-balance").innerText = `$ ${startingBalance}`;
    document.getElementById("total-expenses").innerText = `$ ${totalExpenses}`;
    await updateRemainingBalance(startingBalance, totalExpenses);
    updateDaysLeft();
    updateDailySpend(totalExpenses);

    // Initialize slider values
    let minSliderValue = 25;
    let maxSliderValue = 500;
    document.getElementById("slider").min = minSliderValue;
    document.getElementById("slider").max = maxSliderValue;
    document.getElementById("slider").value = (minSliderValue + maxSliderValue) / 2;

    // Event listener for slider to update amount in the input box
    document.getElementById("slider").addEventListener("input", updateSliderAmount);

    // Double-click functionality to edit starting balance
    document.getElementById("starting-balance").ondblclick = editStartingBalance;

    // Event listener for the "Bill It" button
    document.getElementById("bill-button").addEventListener("click", billIt);

    // Add event listeners for double-click functionality
    document.getElementById('total-expenses').ondblclick = openTransactions;
    document.querySelector('.settings-icon').ondblclick = openSettings;
    document.querySelector('.graph-icon').ondblclick = openGraph;

    // Populate category dropdown
    await populateCategoryDropdown();
}

// Check and reset if it's a new month
async function checkAndResetForNewMonth() {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Get the last reset date from IndexedDB
    let lastResetData = await getFromIndexedDB('budgetData', 'lastResetDate');
    let lastResetDate = lastResetData ? new Date(lastResetData.value) : null;

    // Check if it's a new month or year compared to the last reset
    if (!lastResetDate || lastResetDate.getMonth() !== currentMonth || lastResetDate.getFullYear() !== currentYear) {
        // Clear the transactions store to reset expenses
        await clearIndexedDBObjectStore('transactions');

        // Save the current date as the new last reset date
        await saveToIndexedDB('budgetData', { key: 'lastResetDate', value: today.toISOString() });

        // Reset total expenses to 0 in the UI
        document.getElementById("total-expenses").innerText = "$ 0";
    }
}

// Function to retrieve all transactions from IndexedDB
function getAllTransactions() {
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['transactions'], 'readonly');
        const store = transaction.objectStore('transactions');
        const request = store.getAll(); // Use getAll to retrieve all transactions

        request.onsuccess = function () {
            resolve(request.result || []); // Return the results or an empty array
        };
        request.onerror = function () {
            console.error('Error retrieving transactions from IndexedDB');
            reject('Error retrieving transactions from IndexedDB');
        };
    });
}

// Function to update slider amount
function updateSliderAmount() {
    let sliderValue = document.getElementById("slider").value;
    document.getElementById("slider-amount").value = sliderValue;
}

// Function to edit the starting balance
function editStartingBalance() {
    const balanceDiv = document.getElementById('starting-balance');
    const currentBalance = startingBalance;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentBalance;

    input.onblur = async function() {
        const newBalance = parseFloat(input.value);
        if (!isNaN(newBalance) && newBalance >= 0) {
            startingBalance = newBalance;
            await saveToIndexedDB('budgetData', { key: 'startingBalance', value: newBalance });
            balanceDiv.innerText = `$ ${newBalance.toFixed(2)}`;
            await updateRemainingBalance(startingBalance, totalExpenses);
        } else {
            alert('Please enter a valid number for the balance');
        }
    };

    input.onkeydown = function(event) {
        if (event.key === 'Enter') {
            input.blur();
        }
    };

    balanceDiv.innerHTML = '';
    balanceDiv.appendChild(input);
    input.focus();
}

// Function to handle billing the entered amount
let isProcessingTransaction = false;  // Flag to prevent multiple transaction processing

async function billIt() {
    const billButton = document.getElementById("bill-button");
    const amountField = document.getElementById("slider-amount");

    if (isProcessingTransaction) return;  // Prevent re-entry if already processing

    let manualAmount = amountField.value;

    // Disable the button and input field to prevent multiple submissions
    billButton.disabled = true;
    amountField.disabled = true;

    if (!manualAmount || isNaN(manualAmount) || parseInt(manualAmount) <= 0) {
        // Re-enable the button and input field and exit if the amount is invalid
        billButton.disabled = false;
        amountField.disabled = false;
        return; 
    }

    isProcessingTransaction = true;  // Set flag to true, indicating processing

    let amountToBill = parseInt(manualAmount);
    let selectedCategory = document.getElementById("category-dropdown").value;
    let today = new Date();
    let formattedDate = formatDateForStorage(today);

    const transactionData = { date: formattedDate, amount: amountToBill, category: selectedCategory };
    const dbTransaction = db.transaction(['transactions'], 'readwrite');
    const store = dbTransaction.objectStore('transactions');

    const addRequest = store.add(transactionData);

    addRequest.onsuccess = async function() {
        // Fetch all transactions again to calculate total expenses dynamically
        let transactionsData = await getAllTransactions();
        let totalExpenses = transactionsData.reduce((sum, transaction) => sum + transaction.amount, 0);

        // Update the UI with the new totalExpenses
        document.getElementById("total-expenses").innerText = `$ ${totalExpenses}`;
        await updateRemainingBalance(startingBalance, totalExpenses);

        // Reset fields
        document.getElementById("slider").value = (25 + 500) / 2;
        amountField.value = "";
        document.getElementById("category-dropdown").value = "Other";

        // Re-enable the button and input field after successful transaction
        isProcessingTransaction = false;
        billButton.disabled = false;
        amountField.disabled = false; // Ensure input is re-enabled after success
    };

    addRequest.onerror = function() {
        console.error("Error adding transaction.");
        // Re-enable the button and input field in case of an error
        isProcessingTransaction = false;
        billButton.disabled = false;
        amountField.disabled = false;
    };
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
async function populateCategoryDropdown() {
    let categoriesData = await getFromIndexedDB('categories', 'default');
    let categories = categoriesData ? categoriesData.categories : ['Other'];

    let categoryDropdown = document.getElementById('category-dropdown');
    categoryDropdown.innerHTML = '';

    categories.forEach(category => {
        let option = document.createElement('option');
        option.value = category;
        option.text = category;
        categoryDropdown.appendChild(option);
    });
}

// Show the transaction modal
async function openTransactions() {
    document.getElementById('transactions-modal').style.display = 'block';
    await populateTransactionList(); // Populate the transaction list
}


// Show the settings modal
function openSettings() {
    populateCategoryList();
    document.getElementById('settings-modal').style.display = 'block';
}

function saveSettings() {
    // Get selected pay frequency
    const payFrequency = document.getElementById("pay-frequency-dropdown").value;

    // Optionally save pay frequency to IndexedDB or LocalStorage
    localStorage.setItem("payFrequency", payFrequency);

    // Optionally refresh the UI or notify the user
    alert('Settings saved!');
}

// Show the graph modal
async function openGraph() {
    document.getElementById('graph-modal').style.display = 'block';
    await displayBarGraphCurrentMonth(); // Use await here
    await displayBarGraphPast3Months();  // Ensure this is awaited
    await displayBarGraphYTD();          // Ensure this is awaited
}

function closeGraph() {
    document.getElementById('graph-modal').style.display = 'none';
}

// Store the chart instance globally to keep track of it
let currentMonthChart = null;

// Function to generate the current month graph with flipped axes
async function displayBarGraphCurrentMonth() {
    const ctx = document.getElementById('barChartCurrentMonth').getContext('2d');
    const currentMonthData = await filterTransactionsByCurrentMonth(); // Await the async function

    // Reset the category totals object
    let categoryTotals = {};

    // Loop through all transactions and aggregate totals
    currentMonthData.forEach(transaction => {
        let category = transaction.category || "Other"; // Fixed typo: transaction.category
        if (!categoryTotals[category]) {
            categoryTotals[category] = 0;
        }
        categoryTotals[category] += transaction.amount; // Fixed typo: transaction.amount
    });

    // Filter out categories that have a total amount greater than 0
    const validCategories = Object.keys(categoryTotals).filter(category => categoryTotals[category] > 0);
    const validTotals = validCategories.map(category => categoryTotals[category]);

    // If there is an existing chart, destroy it before creating a new one
    if (currentMonthChart) {
        currentMonthChart.destroy();
    }

    // Generate the new chart
    currentMonthChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: validCategories, // Show only categories with amounts
            datasets: [{
                label: 'Expenses for Current Month',
                data: validTotals, // Data for valid categories only
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y', // Flip X and Y axis
            scales: {
                x: {
                    beginAt: 50, // Start x-axis (dollar axis) at 50
                    max: 500, // Maximum value for x-axis (dollar axis)
                    ticks: {
                        stepSize: 50, // Step increments of 50
                    },
                    title: {
                        display: true,
                        text: 'Amount ($)' // Label for the x-axis
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Categories' // Label for the y-axis
                    }
                }
            }
        }
    });
}

// Store the chart instance globally to keep track of it
let past3MonthsChart = null;

// Function to generate past 3 months graph with flipped axes
async function displayBarGraphPast3Months() {
    const ctx = document.getElementById('barChartPast3Months').getContext('2d');
    const past3MonthsData = await filterTransactionsByPast3Months();
    
    // Reset the category totals object
    let categoryTotals = {};

    // Loop through all transactions and aggregate totals
    past3MonthsData.forEach(transaction => {
        let category = transaction.category || "Other"; // Fixed typo: transaction.category
        if (!categoryTotals[category]) {
            categoryTotals[category] = 0;
        }
        categoryTotals[category] += transaction.amount; // Fixed typo: transaction.amount
    });

    // Filter out categories that have a total amount greater than 0
    const validCategories = Object.keys(categoryTotals).filter(category => categoryTotals[category] > 0);
    const validTotals = validCategories.map(category => categoryTotals[category]);

    // If there is an existing chart, destroy it before creating a new one
    if (past3MonthsChart) {
        past3MonthsChart.destroy();
    }

    // Generate the new chart
    past3MonthsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: validCategories, // Show only categories with amounts
            datasets: [{
                label: 'Expenses for Past 3 Months',
                data: validTotals, // Data for valid categories only
                backgroundColor: 'rgba(153, 102, 255, 0.2)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y', // Flip X and Y axis
            scales: {
                x: {
                    beginAt: 50, // Start x-axis (dollar axis) at 50
                    max: 500, // Maximum value for x-axis (dollar axis)
                    ticks: {
                        stepSize: 50, // Step increments of 50
                    },
                    title: {
                        display: true,
                        text: 'Amount ($)' // Label for the x-axis
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Categories' // Label for the y-axis
                    }
                }
            }
        }
    });
}

// Store the chart instance globally to keep track of it
let ytdChart = null;

// Function to generate year-to-date graph with flipped axes
async function displayBarGraphYTD() {
    const ctx = document.getElementById('barChartYTD').getContext('2d');
    const ytdData = await filterTransactionsByYTD(); 
    
    // Reset the category totals object
    let categoryTotals = {};

    // Loop through all transactions and aggregate totals
    ytdData.forEach(transaction => {
        let category = transaction.category || "Other"; // Fixed typo: transaction.category
        if (!categoryTotals[category]) {
            categoryTotals[category] = 0;
        }
        categoryTotals[category] += transaction.amount; // Fixed typo: transaction.amount
    });

    // Filter out categories that have a total amount greater than 0
    const validCategories = Object.keys(categoryTotals).filter(category => categoryTotals[category] > 0);
    const validTotals = validCategories.map(category => categoryTotals[category]);

    // If there is an existing chart, destroy it before creating a new one
    if (ytdChart) {
        ytdChart.destroy();
    }

    // Generate the new chart
    ytdChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: validCategories, // Show only categories with amounts
            datasets: [{
                label: 'Year-to-Date Expenses',
                data: validTotals, // Data for valid categories only
                backgroundColor: 'rgba(255, 159, 64, 0.2)',
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y', // Flip X and Y axis
            scales: {
                x: {
                    beginAt: 50, // Start x-axis (dollar axis) at 50
                    max: 500, // Maximum value for x-axis (dollar axis)
                    ticks: {
                        stepSize: 50, // Step increments of 50
                    },
                    title: {
                        display: true,
                        text: 'Amount ($)' // Label for the x-axis
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Categories' // Label for the y-axis
                    }
                }
            }
        }
    });
}

// Helper functions to filter data by time periods
async function filterTransactionsByCurrentMonth() {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    let transactionsData = await getAllTransactions(); // Fetch all transactions from IndexedDB

    return transactionsData.filter(transaction => {
        let transactionDate = parseDate(transaction.date); // Normalize the date
        
        // Correctly compare the month and year of the transaction
        return transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear;
    });
}

async function filterTransactionsByPast3Months() {
    const today = new Date();
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1); // 3 months back (start of that month)

    let transactionsData = await getAllTransactions(); // Fetch all transactions from IndexedDB

    return transactionsData.filter(transaction => {
        let transactionDate = parseDate(transaction.date); // Normalize the date
        return transactionDate >= threeMonthsAgo && transactionDate <= today;
    });
}

async function filterTransactionsByYTD() {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1); // January 1st of the current year

    let transactionsData = await getAllTransactions(); // Fetch all transactions from IndexedDB

    return transactionsData.filter(transaction => {
        let transactionDate = parseDate(transaction.date); // Normalize the date
        return transactionDate >= startOfYear && transactionDate <= today;
    });
}



// Close any modal
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Edit Category Function
async function editCategory(index) {
    const categoryNameElement = document.getElementById(`category-${index}`);
    const currentCategoryName = categoryNameElement.innerText;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentCategoryName;

    input.onblur = async function() {
        const newCategoryName = input.value.trim();
        if (newCategoryName && newCategoryName !== currentCategoryName) {
            let categoriesData = await getFromIndexedDB('categories', 'default');
            let categories = categoriesData.categories;

            categories[index] = newCategoryName;
            await saveToIndexedDB('categories', { name: 'default', categories });

            await populateCategoryList();
            await populateCategoryDropdown();
        }
    };

    categoryNameElement.innerHTML = '';
    categoryNameElement.appendChild(input);
    input.focus();
}

// Delete selected categories
async function deleteSelectedCategories() {
    let checkboxes = document.querySelectorAll('.category-checkbox:checked');
    let categoriesData = await getFromIndexedDB('categories', 'default');
    let categories = categoriesData ? categoriesData.categories : ['Other'];

    let indexesToDelete = [];
    checkboxes.forEach(checkbox => {
        indexesToDelete.push(parseInt(checkbox.getAttribute('data-index')));
    });

    categories = categories.filter((_, index) => !indexesToDelete.includes(index));

    await saveToIndexedDB('categories', { name: 'default', categories });

    await populateCategoryList();
    await populateCategoryDropdown();
}

// Function to add a new category
async function addCategory() {
    let newCategory = document.getElementById('new-category').value.trim();

    if (newCategory) {
        let categoriesData = await getFromIndexedDB('categories', 'default');
        let categories = categoriesData ? categoriesData.categories : [];

        if (!categories.includes(newCategory)) {
            categories.push(newCategory);
            await saveToIndexedDB('categories', { name: 'default', categories });

            await populateCategoryList();
            await populateCategoryDropdown();
            document.getElementById('new-category').value = '';
        } else {
            alert("Category already exists.");
        }
    }
}

// Populate the category list in the settings modal
async function populateCategoryList() {
    let categoryList = document.getElementById('category-list');
    categoryList.innerHTML = '';

    let categoriesData = await getFromIndexedDB('categories', 'default');
    let categories = categoriesData ? categoriesData.categories : ['Other'];

    categories.forEach((category, index) => {
        let listItem = document.createElement('li');
        listItem.innerHTML = `
            <input type="checkbox" class="category-checkbox" data-index="${index}">
            <span class="category-name" id="category-${index}">${category}</span>
        `;

        listItem.querySelector('.category-name').ondblclick = () => editCategory(index);

        categoryList.appendChild(listItem);
    });
}

// Populate the transaction list
async function populateTransactionList() {
    let transactionList = document.getElementById('transaction-list');
    transactionList.innerHTML = ''; // Clear existing transactions

    // Retrieve all transactions using getAll
    let transactionsData = await getAllTransactions(); // Fetch all transactions from IndexedDB

    // Check if there are any transactions to display
    if (transactionsData.length === 0) {
        transactionList.innerHTML = '<li>No transactions available</li>';
        return;
    }
    
    // Display transactions in the UI
    transactionsData.forEach((transaction, index) => {
        let listItem = document.createElement('li');
        listItem.innerHTML = `
            <input type="checkbox" class="transaction-checkbox" data-index="${index}">
            ${formatDateForDisplay(transaction.date)} - $${transaction.amount} - ${transaction.category}
        `;

        // Add event listener for editing the transaction
        listItem.ondblclick = () => editTransaction(transaction.id);

        transactionList.appendChild(listItem);
    });
}

async function editTransaction(transactionId) {
    // Ensure the transaction ID is treated as an integer
    let transactionData = await getFromIndexedDB('transactions', transactionId);

    if (!transactionData) {
        alert('Transaction not found.');
        console.log(`Transaction not found for ID: ${transactionId}`);
        return;
    }

    // Populate the modal fields with the transaction data
    document.getElementById('edit-amount').value = transactionData.amount;

    let categoryDropdown = document.getElementById('edit-category-dropdown');
    categoryDropdown.innerHTML = ''; // Clear previous options

    // Fetch categories from IndexedDB and populate the dropdown
    let categoriesData = await getFromIndexedDB('categories', 'default');
    let categories = categoriesData ? categoriesData.categories : ['Other'];

    categories.forEach(category => {
        let option = document.createElement('option');
        option.value = category;
        option.text = category;
        if (category === transactionData.category) {
            option.selected = true; // Pre-select the current category
        }
        categoryDropdown.appendChild(option);
    });

    // Show the edit modal
    document.getElementById('edit-transaction-modal').style.display = 'block';

    // Attach the save action to the save button
    document.getElementById('save-edit-btn').onclick = async function() {
        await saveTransactionEdits(transactionId);  // Pass the ID to save changes
    };
}


// Save edited transaction
async function saveTransactionEdits(transactionId) {
    
    // Get the updated values from the modal fields
    let newAmount = parseFloat(document.getElementById('edit-amount').value);
    let newCategory = document.getElementById('edit-category-dropdown').value;

    if (isNaN(newAmount) || newAmount <= 0) {
        alert('Please enter a valid amount.');
        return;
    }

    // Fetch the transaction object to update it
    let transactionData = await getFromIndexedDB('transactions', transactionId);

    if (!transactionData) {
        alert('Transaction not found.');
        console.log(`Transaction not found for ID: ${transactionId}`);
        return;
    }

    // Update the transaction with new values
    transactionData.amount = newAmount;
    transactionData.category = newCategory;

    // Save the updated transaction back to IndexedDB
    const dbTransaction = db.transaction(['transactions'], 'readwrite');
    const store = dbTransaction.objectStore('transactions');
    store.put(transactionData).onsuccess = function() {
        // alert('Transaction updated successfully.');

        // Close the modal
        document.getElementById('edit-transaction-modal').style.display = 'none';

        // Refresh the transaction list
        populateTransactionList();
    };

    store.onerror = function() {
        console.error('Error updating transaction.');
    };

    // Update the UI after deletion
    await updateTotalExpenses(); // Update total expenses
}



// Update the total expenses after editing a transaction
async function updateTotalExpenses() {
    let transactionsData = await getAllTransactions(); // Fetch all transactions
    let totalExpenses = transactionsData.reduce((sum, transaction) => sum + transaction.amount, 0); // Sum the transaction amounts

    document.getElementById("total-expenses").innerText = `$ ${totalExpenses}`;
    await updateRemainingBalance(startingBalance, totalExpenses);
}


// Delete selected transactions
// Delete selected transactions
async function deleteSelectedTransactions() {
    let checkboxes = document.querySelectorAll('.transaction-checkbox:checked'); // Get all checked checkboxes
    if (checkboxes.length === 0) {
        alert("Please select transactions to delete.");
        return;
    }

    let transactionsData = await getAllTransactions(); // Fetch all transactions
    let indexesToDelete = []; // Store the indexes of transactions to delete

    checkboxes.forEach(checkbox => {
        indexesToDelete.push(parseInt(checkbox.getAttribute('data-index'))); // Get the index from the checkbox attribute
    });

    // Filter out the transactions to delete by their indexes
    transactionsData = transactionsData.filter((_, index) => !indexesToDelete.includes(index));

    // Save the filtered transactions back to IndexedDB
    const dbTransaction = db.transaction(['transactions'], 'readwrite');
    const store = dbTransaction.objectStore('transactions');
    const clearRequest = store.clear(); // Clear all existing records

    clearRequest.onsuccess = async function() {
        // Add the remaining transactions back to the store
        const addTransaction = db.transaction(['transactions'], 'readwrite');
        const addStore = addTransaction.objectStore('transactions');
        transactionsData.forEach(transaction => {
            addStore.add(transaction); // Re-add the remaining transactions
        });

        // Update the UI after deletion
        await populateTransactionList(); // Refresh the transaction list
        await updateTotalExpenses(); // Update total expenses

        // alert("Selected transactions have been deleted.");
    };

    clearRequest.onerror = function() {
        console.error("Error clearing transactions.");
    };
}


// Utility function to format date for display
function formatDateForDisplay(dateStr) {
    if (!dateStr) {
        return 'Invalid Date'; // Handle null/undefined/missing date values
    }
    
    const [year, month, day] = dateStr.split('-');
    
    // Validate the date format before attempting to format it
    if (!year || !month || !day) {
        return 'Invalid Date'; // Return a default value if the format is wrong
    }
    
    return `${month}/${day}/${year}`; // Format as MM/DD/YYYY
}

// Utility function to parse a date string in either MM/DD/YYYY or YYYY-MM-DD format
function parseDate(dateString) {
    let parts;
    
    // Check if the date is in YYYY-MM-DD format
    if (dateString.includes('-')) {
        parts = dateString.split('-');
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    
    // Check if the date is in MM/DD/YYYY format
    if (dateString.includes('/')) {
        parts = dateString.split('/');
        if (parts[0] > 12) { // Assuming DD/MM/YYYY
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
        return new Date(parts[2], parts[0] - 1, parts[1]);
    }

    // Fallback: return today's date if format is unrecognized
    return new Date();
}

function clearAllStores() {
    const storeNames = ['transactions', 'categories', 'budgetData']; // Add all relevant store names
    storeNames.forEach(storeName => {
        clearIndexedDBObjectStore(storeName);
    });
}

// Utility function to clear an object store in IndexedDB
function clearIndexedDBObjectStore(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear(); // Clears all records from the store

        request.onsuccess = function() {
            console.log(`Cleared all records from ${storeName}`);
            resolve();
        };
        request.onerror = function() {
            console.error(`Error clearing records from ${storeName}`);
            reject('Error clearing IndexedDB store');
        };
    });
}


