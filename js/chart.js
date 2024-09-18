// Use Chart.js to generate the bar graph of expenses by category
function displayBarGraph() {
    let ctx = document.getElementById('barChart').getContext('2d');

    let categoryTotals = {};
    transactions.forEach(transaction => {
        if (!categoryTotals[transaction.category]) {
            categoryTotals[transaction.category] = 0;
        }
        categoryTotals[transaction.category] += transaction.amount;
    });

    let chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                label: 'Expenses by Category',
                data: Object.values(categoryTotals),
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        }
    });
}
