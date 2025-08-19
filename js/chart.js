
// // chart.js

// let currentMonthChart = null;
// let past3MonthsChart = null;
// let rollingYearChart = null;
// import { getAllRecords } from './app.js';

// async function displayBarGraphCurrentMonth() {
//     const ctx = document.getElementById('barChartCurrentMonth')?.getContext('2d');
//     if (!ctx) return;

//     const transactions = await getAllRecords('transactions');
//     const categoryTotals = {};

//     const now = new Date();
//     const currentMonth = now.getMonth();
//     const currentYear = now.getFullYear();

//     transactions.forEach(({ date, amount, category }) => {
//         const tDate = new Date(date);
//         if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
//             categoryTotals[category || 'Other'] = (categoryTotals[category || 'Other'] || 0) + amount;
//         }
//     });

//     if (currentMonthChart) currentMonthChart.destroy();

//     currentMonthChart = new Chart(ctx, {
//         type: 'bar',
//         data: {
//             labels: Object.keys(categoryTotals),
//             datasets: [{
//                 label: 'Current Month Expenses',
//                 data: Object.values(categoryTotals),
//                 backgroundColor: 'rgba(75, 192, 192, 0.2)',
//                 borderColor: 'rgba(75, 192, 192, 1)',
//                 borderWidth: 1
//             }]
//         },
//         options: {
//             responsive: true,
//             indexAxis: 'y',
//             scales: {
//                 x: {
//                     beginAtZero: true,
//                     title: { display: true, text: 'Amount ($)' }
//                 },
//                 y: {
//                     title: { display: true, text: 'Categories' }
//                 }
//             }
//         }
//     });
// }

// async function displayBarGraphPast3Months() {
//     const ctx = document.getElementById('barChartPast3Months')?.getContext('2d');
//     if (!ctx) return;

//     const transactions = await getAllRecords('transactions');
//     const categoryTotals = {};

//     const now = new Date();
//     const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

//     transactions.forEach(({ date, amount, category }) => {
//         const tDate = new Date(date);
//         if (tDate >= threeMonthsAgo && tDate <= now) {
//             categoryTotals[category || 'Other'] = (categoryTotals[category || 'Other'] || 0) + amount;
//         }
//     });

//     if (past3MonthsChart) past3MonthsChart.destroy();

//     past3MonthsChart = new Chart(ctx, {
//         type: 'bar',
//         data: {
//             labels: Object.keys(categoryTotals),
//             datasets: [{
//                 label: 'Past 3 Months Expenses',
//                 data: Object.values(categoryTotals),
//                 backgroundColor: 'rgba(153, 102, 255, 0.2)',
//                 borderColor: 'rgba(153, 102, 255, 1)',
//                 borderWidth: 1
//             }]
//         },
//         options: {
//             responsive: true,
//             indexAxis: 'y',
//             scales: {
//                 x: {
//                     beginAtZero: true,
//                     title: { display: true, text: 'Amount ($)' }
//                 },
//                 y: {
//                     title: { display: true, text: 'Categories' }
//                 }
//             }
//         }
//     });
// }

// async function displayBarGraphRollingYear() {
//     const ctx = document.getElementById('barChartYTD')?.getContext('2d');
//     if (!ctx) return;

//     const transactions = await getAllRecords('transactions');
//     const categoryTotals = {};

//     const now = new Date();
//     const oneYearAgo = new Date(now);
//     oneYearAgo.setFullYear(now.getFullYear() - 1);

//     transactions.forEach(({ date, amount, category }) => {
//         const tDate = new Date(date);
//         if (tDate >= oneYearAgo && tDate <= now) {
//             categoryTotals[category || 'Other'] = (categoryTotals[category || 'Other'] || 0) + amount;
//         }
//     });

//     if (rollingYearChart) rollingYearChart.destroy();

//     rollingYearChart = new Chart(ctx, {
//         type: 'bar',
//         data: {
//             labels: Object.keys(categoryTotals),
//             datasets: [{
//                 label: 'Rolling 12-Month Expenses',
//                 data: Object.values(categoryTotals),
//                 backgroundColor: 'rgba(255, 159, 64, 0.2)',
//                 borderColor: 'rgba(255, 159, 64, 1)',
//                 borderWidth: 1
//             }]
//         },
//         options: {
//             responsive: true,
//             indexAxis: 'y',
//             scales: {
//                 x: {
//                     beginAtZero: true,
//                     title: { display: true, text: 'Amount ($)' }
//                 },
//                 y: {
//                     title: { display: true, text: 'Categories' }
//                 }
//             }
//         }
//     });
// }

// export {
//     displayBarGraphCurrentMonth,
//     displayBarGraphPast3Months,
//     displayBarGraphRollingYear
// };
// File: js/chart.js
// Budget Tracker – Production-ready chart.js (no placeholders, full logic)

"use strict";

// ---------------- Module State ----------------
let db = null;
let currentMonthChart = null;
let past3MonthsChart = null;
let ytdChart = null;

// ---------------- IndexedDB Helpers (read-mostly) ----------------
function openDB() {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("budgetDB", 1);
    request.onupgradeneeded = function (e) {
      // Ensure stores exist (idempotent)
      db = e.target.result;
      if (!db.objectStoreNames.contains("transactions")) {
        db.createObjectStore("transactions", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("categories")) {
        db.createObjectStore("categories", { keyPath: "id" }); // id: "default"
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "id" }); // id: "startingBalance"
      }
    };
    request.onsuccess = function (e) {
      db = e.target.result;
      resolve(db);
    };
    request.onerror = function (e) {
      console.error("Chart module: Error opening IndexedDB:", e.target?.error || e);
      reject(e);
    };
  });
}

function getAllRecords(storeName) {
  return new Promise(async (resolve, reject) => {
    try {
      await openDB();
      const tx = db.transaction([storeName], "readonly");
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => {
        console.error("Chart module: Error retrieving records", request.error);
        reject(request.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

// ---------------- Utilities ----------------
function parseDate(dateString) {
  if (!dateString) return new Date(NaN);
  if (typeof dateString === "string") {
    if (dateString.includes("-")) {
      const [y, m, d] = dateString.split("-").map((p) => parseInt(p, 10));
      return new Date(y, (m || 1) - 1, d || 1);
    }
    if (dateString.includes("/")) {
      const [a, b, c] = dateString.split("/").map((p) => parseInt(p, 10));
      if (a > 12) return new Date(c, (b || 1) - 1, a || 1);
      return new Date(c, (a || 1) - 1, b || 1);
    }
  }
  // Fallback to native parsing for Date objects or other supported formats
  return new Date(dateString);
}

function ensureChartJS() {
  if (typeof Chart === "undefined") {
    console.warn("Chart.js is not loaded; cannot render charts.");
    return false;
  }
  return true;
}

function buildCategoryTotals(transactions) {
  const totals = {};
  for (const t of transactions) {
    const cat = (t.category || "Other").trim() || "Other";
    const amt = Number(t.amount);
    if (Number.isFinite(amt) && amt > 0) {
      totals[cat] = (totals[cat] || 0) + amt;
    }
  }
  const labels = Object.keys(totals).filter((k) => totals[k] > 0);
  const values = labels.map((k) => totals[k]);
  return { labels, values };
}

function renderBarChart(ctx, existingChart, labels, values, label) {
  if (!ensureChartJS()) return null;
  if (existingChart && typeof existingChart.destroy === "function") existingChart.destroy();
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label, data: values }],
    },
    options: {
      responsive: true,
      indexAxis: "y",
      scales: {
        x: {
          title: { display: true, text: "Amount ($)" },
          ticks: { precision: 0 },
        },
        y: {
          title: { display: true, text: "Categories" },
        },
      },
      plugins: {
        legend: { display: !!label },
      },
    },
  });
}

// ---------------- Data Filters ----------------
async function getTransactions() {
  return getAllRecords("transactions");
}

function filterByCurrentMonth(transactions) {
  const today = new Date();
  const m = today.getMonth();
  const y = today.getFullYear();
  return transactions.filter((t) => {
    const d = parseDate(t.date);
    return d.getFullYear() === y && d.getMonth() === m;
  });
}

function filterByPast3Months(transactions) {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth() - 2, 1);
  return transactions.filter((t) => {
    const d = parseDate(t.date);
    return d >= from && d <= today;
  });
}

function filterByYTD(transactions) {
  const today = new Date();
  const from = new Date(today.getFullYear(), 0, 1);
  return transactions.filter((t) => {
    const d = parseDate(t.date);
    return d >= from && d <= today;
  });
}

// ---------------- Public Chart Renderers ----------------
async function displayBarGraphCurrentMonth() {
  const canvas = document.getElementById("barChartCurrentMonth");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const txns = await getTransactions();
  const filtered = filterByCurrentMonth(txns);
  const { labels, values } = buildCategoryTotals(filtered);
  currentMonthChart = renderBarChart(ctx, currentMonthChart, labels, values, "Expenses for Current Month");
}

async function displayBarGraphPast3Months() {
  const canvas = document.getElementById("barChartPast3Months");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const txns = await getTransactions();
  const filtered = filterByPast3Months(txns);
  const { labels, values } = buildCategoryTotals(filtered);
  past3MonthsChart = renderBarChart(ctx, past3MonthsChart, labels, values, "Expenses for Past 3 Months");
}

async function displayBarGraphYTD() {
  const canvas = document.getElementById("barChartYTD");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const txns = await getTransactions();
  const filtered = filterByYTD(txns);
  const { labels, values } = buildCategoryTotals(filtered);
  ytdChart = renderBarChart(ctx, ytdChart, labels, values, "Year-to-Date Expenses");
}

// ---------------- Convenience API ----------------
async function refreshAllCharts() {
  await displayBarGraphCurrentMonth();
  await displayBarGraphPast3Months();
  await displayBarGraphYTD();
}

function destroyAllCharts() {
  if (currentMonthChart && currentMonthChart.destroy) currentMonthChart.destroy();
  if (past3MonthsChart && past3MonthsChart.destroy) past3MonthsChart.destroy();
  if (ytdChart && ytdChart.destroy) ytdChart.destroy();
  currentMonthChart = past3MonthsChart = ytdChart = null;
}

// ---------------- Exports (ESM + Global) ----------------
export {
  displayBarGraphCurrentMonth,
  displayBarGraphPast3Months,
  displayBarGraphYTD,
  refreshAllCharts,
  destroyAllCharts,
};

// Optional global attachment for non-module usage
if (typeof window !== "undefined") {
  window.BudgetCharts = {
    displayBarGraphCurrentMonth,
    displayBarGraphPast3Months,
    displayBarGraphYTD,
    refreshAllCharts,
    destroyAllCharts,
  };
}
