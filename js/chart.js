// File: js/chart.js v1.0.5.6
// Budget Tracker – Standalone charts module (no placeholders)

"use strict";

// ---------------- Module State ----------------
let db = null;
let currentMonthChart = null;
let past3MonthsChart = null;
let ytdChart = null;

// ---------------- IndexedDB (read-only in this module) ----------------
function openDB() {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("budgetDB", 1);
    request.onupgradeneeded = function (e) {
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
      console.error("[charts] Error opening IndexedDB:", e.target?.error || e);
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
        console.error("[charts] Error retrieving records", request.error);
        reject(request.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

// ---------------- Utilities ----------------
function ensureChartJS() {
  if (typeof Chart === "undefined") {
    console.warn("[charts] Chart.js is not loaded; charts will not render.");
    return false;
  }
  return true;
}

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
  return new Date(dateString);
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
    data: { labels, datasets: [{ label, data: values }] },
    options: {
      responsive: true,
      indexAxis: "y",
      scales: {
        x: { title: { display: true, text: "Amount ($)" }, ticks: { precision: 0 } },
        y: { title: { display: true, text: "Categories" } },
      },
      plugins: { legend: { display: !!label } },
    },
  });
}

// ---------------- Filters ----------------
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

// ---------------- Public API ----------------
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

// ---------------- Exports ----------------
export {
  displayBarGraphCurrentMonth,
  displayBarGraphPast3Months,
  displayBarGraphYTD,
  refreshAllCharts,
  destroyAllCharts,
};

// Optional global for non-module callers
if (typeof window !== "undefined") {
  window.BudgetCharts = {
    displayBarGraphCurrentMonth,
    displayBarGraphPast3Months,
    displayBarGraphYTD,
    refreshAllCharts,
    destroyAllCharts,
  };
}
