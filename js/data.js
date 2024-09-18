// Sample default categories
let categories = JSON.parse(localStorage.getItem('budgetTracker_categories')) || [
  "Groceries", "Dining", "Other", "Transport", "Utilities", "Entertainment", "Clothing", "Rent", "Health", "Insurance", "Repairs"
];

// Populate category dropdown
let dropdown = document.getElementById('category-dropdown');
categories.forEach(category => {
    let option = document.createElement('option');
    option.value = category;
    option.text = category;
    dropdown.appendChild(option);
});

// Function to add/edit/delete categories in settings
function manageCategories(action, categoryName) {
    if (action === 'add') {
        categories.push(categoryName);
    } else if (action === 'delete') {
        categories = categories.filter(cat => cat !== categoryName);
    }
    localStorage.setItem('budgetTracker_categories', JSON.stringify(categories));
}
