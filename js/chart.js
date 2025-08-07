
// chart.js

let currentMonthChart = null;
let past3MonthsChart = null;
let rollingYearChart = null;

async function displayBarGraphCurrentMonth() {
    const ctx = document.getElementById('barChartCurrentMonth')?.getContext('2d');
    if (!ctx) return;

    const transactions = await getAllFromStore('transactions');
    const categoryTotals = {};

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    transactions.forEach(({ date, amount, category }) => {
        const tDate = new Date(date);
        if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
            categoryTotals[category || 'Other'] = (categoryTotals[category || 'Other'] || 0) + amount;
        }
    });

    if (currentMonthChart) currentMonthChart.destroy();

    currentMonthChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                label: 'Current Month Expenses',
                data: Object.values(categoryTotals),
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    title: { display: true, text: 'Amount ($)' }
                },
                y: {
                    title: { display: true, text: 'Categories' }
                }
            }
        }
    });
}

async function displayBarGraphPast3Months() {
    const ctx = document.getElementById('barChartPast3Months')?.getContext('2d');
    if (!ctx) return;

    const transactions = await getAllFromStore('transactions');
    const categoryTotals = {};

    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    transactions.forEach(({ date, amount, category }) => {
        const tDate = new Date(date);
        if (tDate >= threeMonthsAgo && tDate <= now) {
            categoryTotals[category || 'Other'] = (categoryTotals[category || 'Other'] || 0) + amount;
        }
    });

    if (past3MonthsChart) past3MonthsChart.destroy();

    past3MonthsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                label: 'Past 3 Months Expenses',
                data: Object.values(categoryTotals),
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
                    beginAtZero: true,
                    title: { display: true, text: 'Amount ($)' }
                },
                y: {
                    title: { display: true, text: 'Categories' }
                }
            }
        }
    });
}

async function displayBarGraphRollingYear() {
    const ctx = document.getElementById('barChartYTD')?.getContext('2d');
    if (!ctx) return;

    const transactions = await getAllFromStore('transactions');
    const categoryTotals = {};

    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    transactions.forEach(({ date, amount, category }) => {
        const tDate = new Date(date);
        if (tDate >= oneYearAgo && tDate <= now) {
            categoryTotals[category || 'Other'] = (categoryTotals[category || 'Other'] || 0) + amount;
        }
    });

    if (rollingYearChart) rollingYearChart.destroy();

    rollingYearChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                label: 'Rolling 12-Month Expenses',
                data: Object.values(categoryTotals),
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
                    beginAtZero: true,
                    title: { display: true, text: 'Amount ($)' }
                },
                y: {
                    title: { display: true, text: 'Categories' }
                }
            }
        }
    });
}

export {
    displayBarGraphCurrentMonth,
    displayBarGraphPast3Months,
    displayBarGraphRollingYear
};
