// Initialize transactions and categories with default values if not present
var transactions = localStorage.getItem('budgetTracker_transactions');
var categories = localStorage.getItem('budgetTracker_categories');

// Initialize if null or undefined
transactions = transactions ? JSON.parse(transactions) : [];
categories = categories ? JSON.parse(categories) : ['Other'];

// Save initialized values back into localStorage
localStorage.setItem('budgetTracker_transactions', JSON.stringify(transactions));
localStorage.setItem('budgetTracker_categories', JSON.stringify(categories));

// Initial setup or fetch from localStorage
let startingBalance = parseInt(localStorage.getItem('startingBalance')) || 5500;
let totalExpenses = parseInt(localStorage.getItem('totalExpenses')) || 0;

// Update UI with initial values
document.getElementById("starting-balance").innerText = `$ ${startingBalance}`;
document.getElementById("total-expenses").innerText = `$ ${totalExpenses}`;
updateRemainingBalance();
updateDaysLeft();
updateDailySpend();

// Slider values for minimum and maximum amounts
let minSliderValue = 25;  // Minimum value for the slider
let maxSliderValue = 500; // Maximum value for the slider

// Utility functions for date and localStorage
const formatDateForStorage = date => 
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const formatDateForDisplay = dateStr => dateStr.split('-').reverse().join('/'); // YYYY-MM-DD to MM/DD/YYYY

// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/budget-tracker/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// Initialize slider min/max values display
function initializeSlider() {
    document.getElementById('min-value').innerText = minSliderValue.toFixed(2);
    document.getElementById('max-value').innerText = maxSliderValue.toFixed(2);
}

// Call initializeSlider on page load
initializeSlider();

// Function to update slider amount
function updateSliderAmount() {
    let sliderValue = document.getElementById("slider").value;
    document.getElementById("slider-amount").value = sliderValue;
}

// Function to handle billing the entered amount
function billIt() {
    let manualAmount = document.getElementById("slider-amount").value;

    // Show a warning if the user hasn't entered a valid amount
    if (!manualAmount || isNaN(manualAmount) || parseInt(manualAmount) <= 0) {
        alert("Please enter a valid amount in the 'Enter amount' field");
        return; // Prevent billing if the input is invalid
    }

    let amountToBill = parseInt(manualAmount); // Use manual input
    let selectedCategory = document.getElementById("category-dropdown").value;

    let today = new Date();
    let formattedDate = `${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getDate().toString().padStart(2, '0')}/${today.getFullYear()}`;

    // Add the transaction
    let transaction = { date: formattedDate, amount: amountToBill, category: selectedCategory };
    transactions.push(transaction);

    // Update total expenses and remaining balance
    totalExpenses += amountToBill;
    localStorage.setItem('totalExpenses', totalExpenses);
    localStorage.setItem('budgetTracker_transactions', JSON.stringify(transactions));

    document.getElementById("total-expenses").innerText = `$ ${totalExpenses}`;
    updateRemainingBalance();

    // Reset fields
    document.getElementById("slider").value = 250;
    document.getElementById("slider-amount").value = "";
    document.getElementById("category-dropdown").value = "Other";
}

// Function to update remaining balance
function updateRemainingBalance() {
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
function updateDailySpend() {
    let today = new Date();
    let dayOfMonth = today.getDate();
    let dailySpend = Math.floor(totalExpenses / dayOfMonth);
    document.getElementById("daily-spend").innerText = `Daily spending $${dailySpend}`;
}

// Function to handle editing the starting balance
function editStartingBalance() {
    const balanceDiv = document.getElementById('starting-balance');
    const currentBalance = startingBalance;

    // Create an input element to edit the balance
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentBalance;

    // When the input loses focus, save the new balance
    input.onblur = function() {
        const newBalance = parseFloat(input.value);

        if (!isNaN(newBalance) && newBalance >= 0) {
            startingBalance = newBalance;
            localStorage.setItem('startingBalance', newBalance); // Save the new balance to localStorage
            balanceDiv.innerText = `$ ${newBalance.toFixed(2)}`; // Update the UI with the new balance
            updateRemainingBalance(); // Recalculate the remaining balance
        } else {
            alert('Please enter a valid number for the balance');
        }
    };

    // When pressing Enter, blur the input to trigger the onblur event
    input.onkeydown = function(event) {
        if (event.key === 'Enter') {
            input.blur();
        }
    };

    // Replace the balance div with the input field for editing
    balanceDiv.innerHTML = '';
    balanceDiv.appendChild(input);

    // Focus the input immediately
    input.focus();
}

// Show the transaction modal
function openTransactions() {
    document.getElementById('transactions-modal').style.display = 'block';
    populateTransactionList();
}

// Format date as MM/DD/YYYY
function formatDate(dateString) {
    let dateParts = dateString.split('/');
    return `${dateParts[1]}/${dateParts[0]}/${dateParts[2]}`;
}

// Delete selected transactions
function deleteSelectedTransactions() {
    let checkboxes = document.querySelectorAll('.transaction-checkbox:checked');

    // Collect the indexes of selected transactions
    let indexesToDelete = [];
    checkboxes.forEach(checkbox => {
        indexesToDelete.push(parseInt(checkbox.getAttribute('data-index')));
    });

    // Remove selected transactions by filtering
    transactions = transactions.filter((_, index) => !indexesToDelete.includes(index));

    // Recalculate total expenses
    totalExpenses = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);

    // Update localStorage
    localStorage.setItem('budgetTracker_transactions', JSON.stringify(transactions));
    localStorage.setItem('totalExpenses', totalExpenses);

    // Update the UI
    document.getElementById("total-expenses").innerText = `$ ${totalExpenses}`;
    updateRemainingBalance();
    populateTransactionList(); // Refresh the transaction list
}

// Edit transaction with a double-click (opens the modal)
function editTransaction(index) {
    transactionToEditIndex = index; // Store the index of the transaction being edited
    let transaction = transactions[index];

    // Populate the modal fields with current transaction values
    document.getElementById('edit-amount').value = transaction.amount;

    // Clear existing dropdown options
    let categoryDropdown = document.getElementById('edit-category-dropdown');
    categoryDropdown.innerHTML = ''; 

    // Populate the dropdown with available categories
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

// Close the edit modal
function closeEditTransaction() {
    document.getElementById('edit-transaction-modal').style.display = 'none';
}

function closeTransactions() {
    document.getElementById('transactions-modal').style.display = 'none';
}

// Save the edited transaction
function saveTransactionEdits() {
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

    // Update localStorage
    localStorage.setItem('budgetTracker_transactions', JSON.stringify(transactions));

    // Refresh the UI
    populateTransactionList();
    updateTotalExpenses(); // Recalculate total expenses
    closeEditTransaction(); // Close the modal
}

// Update the total expenses after editing a transaction
function updateTotalExpenses() {
    totalExpenses = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    localStorage.setItem('totalExpenses', totalExpenses);
    document.getElementById("total-expenses").innerText = `$ ${totalExpenses}`;
    updateRemainingBalance();
}

// Populate the transaction list
function populateTransactionList() {
    let transactionList = document.getElementById('transaction-list');
    transactionList.innerHTML = ''; // Clear existing transactions

    transactions.forEach(function(transaction, index) {
        const formattedDate = formatDateForDisplay(transaction.date);
        let category = handleNullCategories(transaction);
        let listItem = document.createElement('li');
        
        listItem.innerHTML = `<input type="checkbox" class="transaction-checkbox" data-index="${index}">` +
                             `${formattedDate} - $${transaction.amount} - ${category}`;

        listItem.ondblclick = function() {
            editTransaction(index);
        };

        transactionList.appendChild(listItem);
    });
}

// Handle null or missing categories
function handleNullCategories(transaction) {
    return transaction.category ? transaction.category : "Other";
}

function openGraph() {
    document.getElementById('graph-modal').style.display = 'block';
    displayBarGraphCurrentMonth(); 
    displayBarGraphPast3Months(); 
    displayBarGraphYTD();
}

function closeGraph() {
    document.getElementById('graph-modal').style.display = 'none';
}

// Store the chart instance globally to keep track of it
let currentMonthChart = null;

// Function to generate the current month graph with flipped axes
function displayBarGraphCurrentMonth() {
    const ctx = document.getElementById('barChartCurrentMonth').getContext('2d');
    const currentMonthData = filterTransactionsByCurrentMonth();

    // Reset the category totals object
    let categoryTotals = {};

    // Loop through all transactions and aggregate totals
    currentMonthData.forEach(transaction => {
        let category = transaction.category || "Other"; // Handle null categories
        if (!categoryTotals[category]) {
            categoryTotals[category] = 0;
        }
        categoryTotals[category] += transaction.amount;
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
            labels: validCategories,
            datasets: [{
                label: 'Expenses for Current Month',
                data: validTotals,
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
                    max: 500,
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
function displayBarGraphPast3Months() {
    const ctx = document.getElementById('barChartPast3Months').getContext('2d');
    const past3MonthsData = filterTransactionsByPast3Months();
    
    let categoryTotals = {};

    past3MonthsData.forEach(transaction => {
        let category = transaction.category || "Other";
        if (!categoryTotals[category]) {
            categoryTotals[category] = 0;
        }
        categoryTotals[category] += transaction.amount;
    });

    const validCategories = Object.keys(categoryTotals).filter(category => categoryTotals[category] > 0);
    const validTotals = validCategories.map(category => categoryTotals[category]);

    if (past3MonthsChart) {
        past3MonthsChart.destroy();
    }

    past3MonthsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: validCategories,
            datasets: [{
                label: 'Expenses for Past 3 Months',
                data: validTotals,
                backgroundColor: 'rgba(153, 102, 255, 0.2)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            scales: {
                x: {
                    beginAt: 50,
                    max: 500,
                    ticks: {
                        stepSize: 50,
                    },
                    title: {
                        display: true,
                        text: 'Amount ($)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Categories'
                    }
                }
            }
        }
    });
}

// Store the chart instance globally to keep track of it
let ytdChart = null;

// Function to generate year-to-date graph with flipped axes
function displayBarGraphYTD() {
    const ctx = document.getElementById('barChartYTD').getContext('2d');
    const ytdData = filterTransactionsByYTD();

    let categoryTotals = {};

    ytdData.forEach(transaction => {
        let category = transaction.category || "Other";
        if (!categoryTotals[category]) {
            categoryTotals[category] = 0;
        }
        categoryTotals[category] += transaction.amount;
    });

    const validCategories = Object.keys(categoryTotals).filter(category => categoryTotals[category] > 0);
    const validTotals = validCategories.map(category => categoryTotals[category]);

    if (ytdChart) {
        ytdChart.destroy();
    }

    ytdChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: validCategories,
            datasets: [{
                label: 'Year-to-Date Expenses',
                data: validTotals,
                backgroundColor: 'rgba(255, 159, 64, 0.2)',
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            scales: {
                x: {
                    beginAt: 50,
                    max: 500,
                    ticks: {
                        stepSize: 50,
                    },
                    title: {
                        display: true,
                        text: 'Amount ($)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Categories'
                    }
                }
            }
        }
    });
}

// Helper functions to filter data by time periods
function filterTransactionsByCurrentMonth() {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    return transactions.filter(transaction => {
        let [part1, part2, year] = transaction.date.split('/').map(Number);
        let month, day;

        if (part1 > 12) {
            day = part1;
            month = part2 - 1;
        } else {
            month = part1 - 1;
            day = part2;
        }

        return month === currentMonth && year === currentYear;
    });
}

function filterTransactionsByPast3Months() {
    const today = new Date();
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1);

    return transactions.filter(transaction => {
        let transactionDate = parseDate(transaction.date);
        return transactionDate >= threeMonthsAgo && transactionDate <= today;
    });
}

function filterTransactionsByYTD() {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    return transactions.filter(transaction => {
        let transactionDate = parseDate(transaction.date);
        return transactionDate >= startOfYear && transactionDate <= today;
    });
}

// Helper function to parse date
function parseDate(dateString) {
    const dateParts = dateString.split('/');
    if (parseInt(dateParts[0], 10) <= 12) {
        return new Date(dateParts[2] + '-' + dateParts[0] + '-' + dateParts[1]);
    } else {
        return new Date(dateParts[2] + '-' + dateParts[1] + '-' + dateParts[0]);
    }
}

// Function to clean up and summarize transactions
function cleanUpTransactions() {
    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());

    let summarizedTransactions = [];
    let summaryByCategory = {};

    transactions = transactions.filter(transaction => {
        let transactionDate = parseDate(transaction.date);

        // Remove transactions older than 1 year
        if (transactionDate < oneYearAgo) {
            return false;
        }

        // Summarize transactions older than 3 months
        if (transactionDate < threeMonthsAgo) {
            const category = transaction.category || "Other";
            if (!summaryByCategory[category]) {
                summaryByCategory[category] = 0;
            }
            summaryByCategory[category] += transaction.amount;
            return false; // Do not keep the transaction details
        }

        return true; // Keep recent transactions (within 3 months)
    });

    // Create summarized transactions and add them to the transactions array
    Object.keys(summaryByCategory).forEach(category => {
        summarizedTransactions.push({
            date: "Summary (3+ Months Ago)", // Placeholder date
            amount: summaryByCategory[category],
            category: category
        });
    });

    // Combine summarized and recent transactions
    transactions = transactions.concat(summarizedTransactions);

    // Update localStorage
    localStorage.setItem('budgetTracker_transactions', JSON.stringify(transactions));
}

// Run cleanup before the window unloads
window.onbeforeunload = function() {
    cleanUpTransactions();
};

// Add event listener for the cleanup button in settings
document.getElementById('cleanup-btn').addEventListener('click', function() {
    cleanUpTransactions();
    alert('Transactions cleaned up successfully!');
    populateTransactionList();
});

// Function to open settings modal
function openSettings() {
    populateCategoryList();
    document.getElementById('settings-modal').style.display = 'block';
}

// Function to save settings
function saveSettings() {
    const newCategories = Array.from(document.querySelectorAll('.category-checkbox'))
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.getAttribute('data-index'));

    const updatedCategories = newCategories.map(index => categories[parseInt(index)]);
    localStorage.setItem('budgetTracker_categories', JSON.stringify(updatedCategories));

    closeSettings();
    alert('Settings saved successfully!');
}

// Function to close settings modal
function closeSettings() {
    document.getElementById('settings-modal').style.display = 'none';
}

// Populate category dropdown
function populateCategoryDropdown() {
    let categoryDropdown = document.getElementById('category-dropdown');
    categoryDropdown.innerHTML = '';

    let updatedCategories = JSON.parse(localStorage.getItem('budgetTracker_categories')) || ['Other'];

    updatedCategories.forEach(category => {
        let option = document.createElement('option');
        option.value = category;
        option.text = category;
        categoryDropdown.appendChild(option);
    });
}

// Populate category list in settings
function populateCategoryList() {
    let categoryList = document.getElementById('category-list');
    categoryList.innerHTML = '';

    let updatedCategories = JSON.parse(localStorage.getItem('budgetTracker_categories')) || ['Other'];

    updatedCategories.forEach((category, index) => {
        let listItem = document.createElement('li');
        listItem.innerHTML = `
            <input type="checkbox" class="category-checkbox" data-index="${index}">
            <span class="category-name" id="category-${index}" ondblclick="editCategory(${index})">${category}</span>
        `;
        categoryList.appendChild(listItem);
    });
}

// Call populate functions on page load
populateCategoryDropdown();
populateCategoryList();

// Add a new category
function addCategory() {
    let newCategory = document.getElementById('new-category').value.trim();

    if (newCategory && !categories.includes(newCategory)) {
        categories.push(newCategory);
        localStorage.setItem('budgetTracker_categories', JSON.stringify(categories));
        populateCategoryList();
        populateCategoryDropdown();
        document.getElementById('new-category').value = '';
    } else {
        alert("Category already exists or input is empty.");
    }
}

// Save edited category
function saveEditedCategory(index, newCategory) {
    if (newCategory && !categories.includes(newCategory)) {
        categories[index] = newCategory;
        localStorage.setItem('budgetTracker_categories', JSON.stringify(categories));

        populateCategoryList();
        populateCategoryDropdown();
    } else {
        alert("Category already exists or input is empty.");
    }
}

// Delete selected categories
function deleteSelectedCategories() {
    let checkboxes = document.querySelectorAll('.category-checkbox:checked');

    let indexesToDelete = [];
    checkboxes.forEach(checkbox => {
        indexesToDelete.push(parseInt(checkbox.getAttribute('data-index')));
    });

    categories = categories.filter((_, index) => !indexesToDelete.includes(index));

    localStorage.setItem('budgetTracker_categories', JSON.stringify(categories));

    populateCategoryList();
    populateCategoryDropdown();
}
