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
    
    let startingBalance = Number(startingBalanceData?.value) || 5500;
    let totalExpenses = Number(totalExpensesData?.value) || 0;
    
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

    // Event listener for slider
    document.getElementById("slider").addEventListener("input", function(event) {
        let value = event.target.value;
        document.getElementById("slider-amount").value = value;
    });

    // Populate category dropdown
    await populateCategoryDropdown();

    // Event listener for the "Bill It" button
    document.getElementById("bill-button").addEventListener("click", billIt);

    // Add event listeners for double-click functionality
    document.getElementById('total-expenses').ondblclick = openTransactions;
    document.querySelector('.settings-icon').ondblclick = openSettings;
    document.querySelector('.graph-icon').ondblclick = openGraph;
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
    categoryDropdown.innerHTML = ''; // Clear existing options

    categories.forEach(category => {
        let option = document.createElement('option');
        option.value = category;
        option.text = category;
        categoryDropdown.appendChild(option);
    });
}

// Function to handle billing the entered amount
async function billIt() {
    let manualAmount = document.getElementById("slider-amount").value;

    // Show a warning if the user hasn't entered a valid amount
    if (!manualAmount || isNaN(manualAmount) || parseInt(manualAmount) <= 0) {
        alert("Please enter a valid amount in the 'Enter amount' field");
        return;
    }

    let amountToBill = parseInt(manualAmount);
    let selectedCategory = document.getElementById("category-dropdown").value;
    let today = new Date();
    let formattedDate = formatDateForStorage(today);

    // Retrieve transactions from IndexedDB
    let transactionsData = await getFromIndexedDB('transactions', 1);
    let transactions = transactionsData ? transactionsData.transactions : [];

    // Add the transaction
    transactions.push({ date: formattedDate, amount: amountToBill, category: selectedCategory });
    await saveToIndexedDB('transactions', { id: 1, transactions });

    // Update total expenses
    let totalExpensesData = await getFromIndexedDB('budgetData', 'totalExpenses');
    let totalExpenses = totalExpensesData ? totalExpensesData.value : 0;
    totalExpenses += amountToBill;
    await saveToIndexedDB('budgetData', { key: 'totalExpenses', value: totalExpenses });

    // Update the UI
    document.getElementById("total-expenses").innerText = `$ ${totalExpenses}`;
    await updateRemainingBalance(startingBalance, totalExpenses);

    // Reset fields
    document.getElementById("slider").value = minSliderValue + (maxSliderValue - minSliderValue) / 2;
    document.getElementById("slider-amount").value = "";
    document.getElementById("category-dropdown").value = "Other";
}

// Utility function to format date for display
function formatDateForDisplay(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`; // Format as MM/DD/YYYY
}

// Show the transaction modal
async function openTransactions() {
    document.getElementById('transactions-modal').style.display = 'block';
    await populateTransactionList();
}

// Show the settings modal
function openSettings() {
    populateCategoryList();
    document.getElementById('settings-modal').style.display = 'block';
}

// Show the graph modal
function openGraph() {
    document.getElementById('graph-modal').style.display = 'block';
    displayBarGraphCurrentMonth();
    displayBarGraphPast3Months();
    displayBarGraphYTD();
}

// Close any modal
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Edit Category Function
async function editCategory(index) {
    const categoryNameElement = document.getElementById(`category-${index}`);
    const currentCategoryName = categoryNameElement.innerText;

    // Create an input field for editing the category name
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentCategoryName;

    // When the input loses focus, save the new category name
    input.onblur = async function() {
        const newCategoryName = input.value.trim();
        if (newCategoryName && newCategoryName !== currentCategoryName) {
            let categoriesData = await getFromIndexedDB('categories', 'default');
            let categories = categoriesData.categories;

            // Update the category name
            categories[index] = newCategoryName;
            await saveToIndexedDB('categories', { name: 'default', categories });

            await populateCategoryList(); // Refresh the category list
            await populateCategoryDropdown(); // Refresh the dropdown in the UI
        }
    };

    // Replace the category name with the input field for editing
    categoryNameElement.innerHTML = '';
    categoryNameElement.appendChild(input);
    input.focus(); // Automatically focus the input
}

// Delete selected categories
async function deleteSelectedCategories() {
    let checkboxes = document.querySelectorAll('.category-checkbox:checked');
    let categoriesData = await getFromIndexedDB('categories', 'default');
    let categories = categoriesData ? categoriesData.categories : ['Other'];

    // Collect indexes of categories to delete
    let indexesToDelete = [];
    checkboxes.forEach(checkbox => {
        indexesToDelete.push(parseInt(checkbox.getAttribute('data-index')));
    });

    // Filter out the selected categories
    categories = categories.filter((_, index) => !indexesToDelete.includes(index));

    // Save updated categories to IndexedDB
    await saveToIndexedDB('categories', { name: 'default', categories });

    await populateCategoryList();  // Refresh the category list
    await populateCategoryDropdown();  // Refresh the category dropdown
}

// Function to add a new category
async function addCategory() {
    let newCategory = document.getElementById('new-category').value.trim();

    if (newCategory) {
        let categoriesData = await getFromIndexedDB('categories', 'default');
        let categories = categoriesData ? categoriesData.categories : [];

        // Check if the category already exists
        if (!categories.includes(newCategory)) {
            categories.push(newCategory);

            // Save the new category to IndexedDB
            await saveToIndexedDB('categories', { name: 'default', categories });

            // Refresh the UI
            await populateCategoryList();
            await populateCategoryDropdown();
            document.getElementById('new-category').value = ''; // Clear the input field
        } else {
            alert("Category already exists.");
        }
    }
}

// Populate the category list in the settings modal
async function populateCategoryList() {
    let categoryList = document.getElementById('category-list');
    categoryList.innerHTML = ''; // Clear the list

    let categoriesData = await getFromIndexedDB('categories', 'default');
    let categories = categoriesData ? categoriesData.categories : ['Other'];

    categories.forEach((category, index) => {
        let listItem = document.createElement('li');
        listItem.innerHTML = `
            <input type="checkbox" class="category-checkbox" data-index="${index}">
            <span class="category-name" id="category-${index}">${category}</span>
        `;

        // Add event listener for editing a category on double-click
        listItem.querySelector('.category-name').ondblclick = () => editCategory(index);

        categoryList.appendChild(listItem);
    });
}

// Populate the transaction list
async function populateTransactionList() {
    let transactionList = document.getElementById('transaction-list');
    transactionList.innerHTML = ''; // Clear existing transactions

    // Fetch transactions from IndexedDB
    let transactionsData = await getFromIndexedDB('transactions', 1);
    let transactions = transactionsData ? transactionsData.transactions : [];

    transactions.forEach((transaction, index) => {
        let listItem = document.createElement('li');
        listItem.innerHTML = `
            <input type="checkbox" class="transaction-checkbox" data-index="${index}">
            ${formatDateForDisplay(transaction.date)} - $${transaction.amount} - ${transaction.category}
        `;

        // Add event listener for editing a transaction on double-click
        listItem.ondblclick = () => editTransaction(index);

        transactionList.appendChild(listItem);
    });
}

// Edit transaction with a double-click (opens the modal)
async function editTransaction(index) {
    let transactionsData = await getFromIndexedDB('transactions', 1);
    let transactions = transactionsData ? transactionsData.transactions : [];
    
    transactionToEditIndex = index; // Store the index of the transaction being edited
    let transaction = transactions[index];

    // Populate the modal fields with current transaction values
    document.getElementById('edit-amount').value = transaction.amount;

    // Clear existing dropdown options
    let categoryDropdown = document.getElementById('edit-category-dropdown');
    categoryDropdown.innerHTML = ''; 

    // Populate the dropdown with available categories
    let categoriesData = await getFromIndexedDB('categories', 'default');
    let categories = categoriesData ? categoriesData.categories : ['Other'];

    categories.forEach(category => {
        let option = document.createElement('option');
        option.value = category;
        option.text = category;
        if (category === transaction.category) {
            option.selected = true; // Select the current transaction's category
        }
        categoryDropdown.appendChild(option);
    });

    // Show the edit modal
    document.getElementById('edit-transaction-modal').style.display = 'block';
}

// Save edited transaction
async function saveTransactionEdits() {
    let transactionsData = await getFromIndexedDB('transactions', 1);
    let transactions = transactionsData ? transactionsData.transactions : [];

    let newAmount = document.getElementById('edit-amount').value;
    let newCategory = document.getElementById('edit-category-dropdown').value;

    // Validate the input
    if (newAmount === null || isNaN(newAmount) || newAmount <= 0) {
        alert("Please enter a valid amount");
        return;
    }

    // Update the transaction
    transactions[transactionToEditIndex].amount = parseFloat(newAmount);
    transactions[transactionToEditIndex].category = newCategory;

    // Save updated transactions to IndexedDB
    await saveToIndexedDB('transactions', { id: 1, transactions });

    // Refresh the UI
    await populateTransactionList(); // Recalculate total expenses and refresh list
    await updateTotalExpenses(); // Update total expenses
    closeEditTransaction(); // Close the modal
}

function closeEditTransaction() {
    document.getElementById('edit-transaction-modal').style.display = 'none';
}

// Update the total expenses after editing a transaction
async function updateTotalExpenses() {
    let transactionsData = await getFromIndexedDB('transactions', 1);
    let transactions = transactionsData ? transactionsData.transactions : [];
    let totalExpenses = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    document.getElementById("total-expenses").innerText = `$ ${totalExpenses}`;
    await updateRemainingBalance(startingBalance, totalExpenses);
}

// Delete selected transactions
async function deleteSelectedTransactions() {
    let checkboxes = document.querySelectorAll('.transaction-checkbox:checked');
    let transactionsData = await getFromIndexedDB('transactions', 1);
    let transactions = transactionsData ? transactionsData.transactions : [];

    // Collect the indexes of selected transactions
    let indexesToDelete = [];
    checkboxes.forEach(checkbox => {
        indexesToDelete.push(parseInt(checkbox.getAttribute('data-index')));
    });

    // Remove selected transactions by filtering
    transactions = transactions.filter((_, index) => !indexesToDelete.includes(index));

    // Save updated transactions to IndexedDB
    await saveToIndexedDB('transactions', { id: 1, transactions });

    // Refresh the UI
    await populateTransactionList(); // Refresh the transaction list
    await updateTotalExpenses(); // Recalculate total expenses
}
