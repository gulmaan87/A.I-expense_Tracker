// API Configuration
const API_BASE_URL = window.location.origin + '/api';
let authToken = localStorage.getItem('authToken');
let currentUser = null;

// DOM Elements
const authModal = document.getElementById('authModal');
const mainApp = document.getElementById('mainApp');
const monthlyLimitInput = document.getElementById("monthlyLimit");
const setLimitBtn = document.getElementById("setLimit");
const limitAmount = document.getElementById("limitAmount");
const totalExpenses = document.getElementById("totalExpenses");
const remainingAmount = document.getElementById("remainingAmount");
const expenseName = document.getElementById("expenseName");
const expenseAmount = document.getElementById("expenseAmount");
const expenseDate = document.getElementById("expenseDate");
const expenseCategory = document.getElementById("expenseCategory");
const expenseNotes = document.getElementById("expenseNotes");
const addExpenseBtn = document.getElementById("addExpense");
const expensesList = document.getElementById("expensesList");
const searchExpense = document.getElementById("searchExpense");
const categoryFilter = document.getElementById("categoryFilter");
const exportDataBtn = document.getElementById("exportData");
const exportPdfBtn = document.getElementById("exportPdf");
const expenseChart = document.getElementById("expenseChart");
const trendChart = document.getElementById("trendChart");
const receiptFile = document.getElementById("receiptFile");
const receiptPreview = document.getElementById("receiptPreview");
const receiptImage = document.getElementById("receiptImage");
const aiInsights = document.getElementById("aiInsights");
const aiInsightsCount = document.getElementById("aiInsightsCount");

// Initialize charts
let expenseDistributionChart;
let monthlyTrendChart;

// State
let expenses = [];
let monthlyLimit = 0;
const MONTHLY_LIMIT_KEY = 'monthlyLimit';

// API Helper Functions
async function apiCall(endpoint, options = {}) {
    const url = API_BASE_URL + endpoint;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        ...options
    };

    try {
        const response = await fetch(url, config);
        
        // Check if response has content before trying to parse JSON
        const contentType = response.headers.get('content-type');
        let data = null;
        
        if (contentType && contentType.includes('application/json')) {
            const text = await response.text();
            if (text) {
                try {
                    data = JSON.parse(text);
                } catch (parseError) {
                    console.error('JSON Parse Error:', parseError);
                    throw new Error('Invalid response from server');
                }
            }
        }
        
        if (!response.ok) {
            const errorMessage = data?.message || `Server error: ${response.status} ${response.statusText}`;
            throw new Error(errorMessage);
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        showNotification(error.message, 'error');
        throw error;
    }
}

// Authentication Functions
async function login(email, password) {
    try {
        const response = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        authToken = response.token;
        currentUser = response.user;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        showNotification('Login successful!', 'success');
        hideAuthModal();
        showMainApp();
        await loadUserData();
    } catch (error) {
        showNotification('Login failed: ' + error.message, 'error');
    }
}

async function register(userData) {
    try {
        const response = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });

        authToken = response.token;
        currentUser = response.user;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        showNotification('Registration successful!', 'success');
        hideAuthModal();
        showMainApp();
        await loadUserData();
    } catch (error) {
        showNotification('Registration failed: ' + error.message, 'error');
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    showAuthModal();
    hideMainApp();
    // Ensure all runtime state is reset
    setTimeout(() => {
        window.location.reload();
    }, 50);
}

// UI Functions
function showAuthModal() {
    authModal.style.display = 'block';
    mainApp.style.display = 'none';
}

function hideAuthModal() {
    authModal.style.display = 'none';
}

function showMainApp() {
    mainApp.style.display = 'block';
    authModal.style.display = 'none';
}

function hideMainApp() {
    mainApp.style.display = 'none';
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Style the notification
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '15px 20px',
        borderRadius: '8px',
        color: 'white',
        fontWeight: 'bold',
        zIndex: '10000',
        maxWidth: '300px',
        backgroundColor: type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'
    });
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Data Loading Functions
async function loadUserData() {
    try {
        // Load expenses
        const expensesResponse = await apiCall('/expenses');
        expenses = expensesResponse.data;
        
        // Load user info
        const userResponse = await apiCall('/auth/me');
        currentUser = userResponse.user;
        
        // Update UI
        updateLimitDisplay();
        updateExpensesList();
        updateCharts();
        updateUserInfo();
        
        // Load AI insights count
        await loadAIInsightsCount();
    } catch (error) {
        console.error('Failed to load user data:', error);
    }
}

async function loadExpenses() {
    try {
        const response = await apiCall('/expenses');
        expenses = response.data;
        updateExpensesList();
        updateCharts();
    } catch (error) {
        console.error('Failed to load expenses:', error);
    }
}

async function loadAIInsightsCount() {
    try {
        const response = await apiCall('/ai/insights?limit=1');
        aiInsightsCount.textContent = response.data.length;
    } catch (error) {
        console.error('Failed to load AI insights count:', error);
    }
}

// Expense Management Functions
async function addExpense() {
    const name = expenseName.value.trim();
    const amount = parseFloat(expenseAmount.value);
    const date = expenseDate.value;
    const category = expenseCategory.value;
    const notes = expenseNotes.value.trim();

    if (!name || !amount || !date) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    try {
        const response = await apiCall('/expenses', {
            method: 'POST',
            body: JSON.stringify({
                name,
                amount,
                date,
                category,
                notes
            })
        });

        expenses.unshift(response.data);
        updateLimitDisplay();
        updateExpensesList();
        updateCharts();
        clearForm();
        
        showNotification('Expense added successfully!', 'success');
        
        // Show AI categorization result
        if (response.aiCategorized) {
            showNotification(`AI categorized as: ${response.data.category} (${Math.round(response.confidenceScore * 100)}% confidence)`, 'info');
        }
        
        if (response.isAnomaly) {
            showNotification('⚠️ Unusual spending pattern detected!', 'error');
        }
    } catch (error) {
        showNotification('Failed to add expense: ' + error.message, 'error');
    }
}

async function deleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense?')) {
        return;
    }

    try {
        await apiCall(`/expenses/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });

        expenses = expenses.filter(expense => String(expense._id || expense.id) !== String(id));
        updateLimitDisplay();
        updateExpensesList();
        updateCharts();
        
        showNotification('Expense deleted successfully!', 'success');
    } catch (error) {
        showNotification('Failed to delete expense: ' + error.message, 'error');
    }
}

// Receipt OCR Functions
function handleReceiptUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = function(e) {
        receiptImage.src = e.target.result;
        receiptPreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

async function processReceipt() {
    const file = receiptFile.files[0];
    if (!file) {
        showNotification('Please select a receipt image first', 'error');
        return;
    }

    showNotification('Processing receipt with AI...', 'info');

    try {
        const formData = new FormData();
        formData.append('receipt', file);

        const response = await fetch(API_BASE_URL + '/expenses/upload-receipt', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });

        // Safely parse JSON if present
        const contentType = response.headers.get('content-type') || '';
        let data = {};
        if (contentType.includes('application/json')) {
            const text = await response.text();
            data = text ? JSON.parse(text) : {};
        }

        if (!response.ok) {
            throw new Error(data.message || 'Receipt processing failed');
        }

        // Auto-fill form with extracted data
        expenseName.value = data.ocrData.merchant || '';
        expenseAmount.value = data.ocrData.amount || '';
        expenseDate.value = data.ocrData.date || new Date().toISOString().split('T')[0];
        expenseNotes.value = data.ocrData.items ? data.ocrData.items.join(', ') : '';
        expenseCategory.value = 'auto';

        showNotification('Receipt processed successfully!', 'success');
        receiptPreview.style.display = 'none';
        receiptFile.value = '';

    } catch (error) {
        showNotification('Receipt processing failed: ' + error.message, 'error');
    }
}

// AI Functions
async function openAIModal() {
    document.getElementById('aiModal').style.display = 'block';
    loadAIChatHistory();
}

function closeAIModal() {
    document.getElementById('aiModal').style.display = 'none';
}

async function sendAIMessage() {
    const input = document.getElementById('aiMessageInput');
    const message = input.value.trim();
    
    if (!message) return;

    // Add user message to chat
    addAIMessage(message, 'user');
    input.value = '';

    try {
        const response = await apiCall('/ai/chat', {
            method: 'POST',
            body: JSON.stringify({ message })
        });

        addAIMessage(response.response, 'ai');
    } catch (error) {
        addAIMessage('Sorry, I encountered an error. Please try again.', 'ai');
    }
}

function addAIMessage(message, sender) {
    const messagesContainer = document.getElementById('aiMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-message ${sender}`;
    
    const icon = sender === 'user' ? 'fas fa-user' : 'fas fa-robot';
    messageDiv.innerHTML = `
        <div class="message-content">
            <i class="${icon}"></i>
            <span>${message}</span>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function loadAIChatHistory() {
    // This would load previous chat history if implemented
    const messagesContainer = document.getElementById('aiMessages');
    messagesContainer.innerHTML = '<div class="ai-message ai"><div class="message-content"><i class="fas fa-robot"></i><span>Hello! I\'m your AI financial assistant. Ask me anything about your expenses!</span></div></div>';
}

async function generateInsights() {
    showNotification('Generating AI insights...', 'info');
    
    try {
        const response = await apiCall('/ai/generate-insights', {
            method: 'POST'
        });
        const hasInsights = Array.isArray(response.insights) ? response.insights.length > 0 : !!response.insights;
        const insightsText = Array.isArray(response.insights) ? response.insights.join('\n') : (response.insights || '');
        const meta = response.metadata || { totalSpent: 0, avgDaily: 0, topCategory: 'other' };

        aiInsights.innerHTML = `
            <div class="insight-item">
                <div class="insight-card">
                    <div class="insight-header">
                        <div class="insight-icon"><i class="fas fa-brain"></i></div>
                        <div class="insight-title">AI Analysis</div>
                    </div>
                    <div class="insight-body">
                        <div class="insight-content collapsed">${hasInsights ? insightsText : (response.message || 'Not enough data for AI insights yet.')}</div>
                        <button class="insight-toggle">Show more</button>
                    </div>
                    <div class="insight-meta">
                        <span>Total Spent: ₹${Number(meta.totalSpent || 0).toFixed(2)}</span>
                        <span>Avg Daily: ₹${Number(meta.avgDaily || 0).toFixed(2)}</span>
                        <span>Top Category: ${meta.topCategory || 'other'}</span>
                    </div>
                </div>
            </div>
        `;
        
        showNotification('AI insights generated!', 'success');
        await loadAIInsightsCount();
    } catch (error) {
        showNotification('Failed to generate insights: ' + error.message, 'error');
    }
}

async function semanticSearch() {
    const query = prompt('Enter your search query (e.g., "dinner with client", "expensive purchases"):');
    if (!query) return;

    showNotification('Searching with AI...', 'info');
    
    try {
        const response = await apiCall('/ai/semantic-search', {
            method: 'POST',
            body: JSON.stringify({ query })
        });

        if (response.results.length === 0) {
            showNotification('No matching expenses found', 'info');
            return;
        }

        // Filter expenses list to show only search results
        const originalExpenses = [...expenses];
        expenses = response.results;
        updateExpensesList();
        
        showNotification(`Found ${response.results.length} matching expenses`, 'success');
        
        // Restore original list after 10 seconds
        setTimeout(() => {
            expenses = originalExpenses;
            updateExpensesList();
        }, 10000);
        
    } catch (error) {
        showNotification('Search failed: ' + error.message, 'error');
    }
}

// UI Update Functions
function updateUserInfo() {
    if (currentUser) {
        document.getElementById('userName').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    }
}

function updateLimitDisplay() {
    limitAmount.textContent = `₹${monthlyLimit.toFixed(2)}`;
    const total = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
    totalExpenses.textContent = `₹${total.toFixed(2)}`;
    remainingAmount.textContent = `₹${(monthlyLimit - total).toFixed(2)}`;
}

function updateExpensesList() {
    const searchTerm = searchExpense.value.toLowerCase();
    const categoryFilterValue = categoryFilter.value;

    const filteredExpenses = expenses.filter((expense) => {
        const matchesSearch =
            expense.name.toLowerCase().includes(searchTerm) ||
            (expense.notes && expense.notes.toLowerCase().includes(searchTerm));
        const matchesCategory =
            categoryFilterValue === "all" || expense.category === categoryFilterValue;
        return matchesSearch && matchesCategory;
    });

    expensesList.innerHTML = "";
    filteredExpenses.forEach((expense) => {
        const li = document.createElement("li");
        li.className = "expense-item";
        
        const aiBadge = (expense.aiCategorized || expense.ai_categorized) ? '<span class="ai-badge">AI</span>' : '';
        const anomalyBadge = (expense.isAnomaly || expense.is_anomaly) ? '<span class="anomaly-badge">⚠️</span>' : '';
        
        li.innerHTML = `
            <span>${expense.name} ${aiBadge} ${anomalyBadge}</span>
            <span>₹${parseFloat(expense.amount).toFixed(2)}</span>
            <span>${expense.category}</span>
            <span>${new Date(expense.date).toLocaleDateString()}</span>
            ${expense.notes ? `<div class="expense-notes">${expense.notes}</div>` : ""}
            <button class="delete-btn" data-id="${(expense._id || expense.id)}">
                <i class="fas fa-trash"></i>
            </button>
        `;
        expensesList.appendChild(li);
    });
}

function updateCharts() {
    updateExpenseDistributionChart();
    updateMonthlyTrendChart();
}

function updateExpenseDistributionChart() {
    const categoryData = {};
    expenses.forEach((expense) => {
        categoryData[expense.category] =
            (categoryData[expense.category] || 0) + parseFloat(expense.amount);
    });

    const ctx = expenseChart.getContext("2d");
    if (expenseDistributionChart) {
        expenseDistributionChart.destroy();
    }

    const gradientColors = [
        ctx.createLinearGradient(0, 0, 0, 400),
        ctx.createLinearGradient(0, 0, 0, 400),
        ctx.createLinearGradient(0, 0, 0, 400),
        ctx.createLinearGradient(0, 0, 0, 400),
        ctx.createLinearGradient(0, 0, 0, 400),
        ctx.createLinearGradient(0, 0, 0, 400),
    ];
    
    gradientColors[0].addColorStop(0, "#a084ee");
    gradientColors[0].addColorStop(1, "#7c3aed");
    gradientColors[1].addColorStop(0, "#00d4ff");
    gradientColors[1].addColorStop(1, "#18122b");
    gradientColors[2].addColorStop(0, "#ffe066");
    gradientColors[2].addColorStop(1, "#bfa100");
    gradientColors[3].addColorStop(0, "#ff7eb3");
    gradientColors[3].addColorStop(1, "#7c3aed");
    gradientColors[4].addColorStop(0, "#4facfe");
    gradientColors[4].addColorStop(1, "#00f2fe");
    gradientColors[5].addColorStop(0, "#607d8b");
    gradientColors[5].addColorStop(1, "#18122b");

    expenseDistributionChart = new Chart(ctx, {
        type: "pie",
        data: {
            labels: Object.keys(categoryData),
            datasets: [{
                data: Object.values(categoryData),
                backgroundColor: gradientColors,
                borderColor: "#18122b",
                borderWidth: 4,
                hoverOffset: 18,
                hoverBorderColor: "#fff",
                hoverBorderWidth: 3,
            }],
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "right",
                    labels: {
                        color: "#fff",
                        font: { weight: "bold", size: 16 },
                    },
                },
                tooltip: {
                    backgroundColor: "rgba(36,20,62,0.95)",
                    titleColor: "#ffe066",
                    bodyColor: "#fff",
                    borderColor: "#7c3aed",
                    borderWidth: 2,
                },
            },
            layout: {
                padding: 20,
            },
            animation: {
                animateRotate: true,
                animateScale: true,
            },
        },
    });
}

function updateMonthlyTrendChart() {
    const daywiseData = {};
    expenses.forEach((expense) => {
        const day = expense.date;
        daywiseData[day] = (daywiseData[day] || 0) + parseFloat(expense.amount);
    });

    const ctx = trendChart.getContext("2d");
    if (monthlyTrendChart) {
        monthlyTrendChart.destroy();
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, "#00d4ff");
    gradient.addColorStop(0.5, "#7c3aed");
    gradient.addColorStop(1, "#18122b");

    monthlyTrendChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: Object.keys(daywiseData),
            datasets: [{
                label: "Daily Expenses",
                data: Object.values(daywiseData),
                borderColor: gradient,
                borderWidth: 4,
                pointBackgroundColor: "#ffe066",
                pointBorderColor: "#7c3aed",
                pointRadius: 7,
                pointHoverRadius: 12,
                pointStyle: "circle",
                fill: true,
                backgroundColor: ctx.createLinearGradient(0, 0, 0, 400),
                tension: 0.45,
            }],
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: "#fff",
                        font: { weight: "bold", size: 16 },
                    },
                },
                tooltip: {
                    backgroundColor: "rgba(36,20,62,0.95)",
                    titleColor: "#ffe066",
                    bodyColor: "#fff",
                    borderColor: "#7c3aed",
                    borderWidth: 2,
                },
            },
            layout: {
                padding: 20,
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: "rgba(124,58,237,0.12)",
                        borderDash: [8, 4],
                    },
                    ticks: {
                        color: "#00d4ff",
                        font: { weight: "bold" },
                    },
                },
                x: {
                    grid: {
                        color: "rgba(124,58,237,0.08)",
                        borderDash: [8, 4],
                    },
                    ticks: {
                        color: "#ffe066",
                        font: { weight: "bold" },
                    },
                },
            },
            animation: {
                duration: 1800,
                easing: "easeInOutQuart",
            },
        },
    });
}

function clearForm() {
    expenseName.value = "";
    expenseAmount.value = "";
    expenseDate.value = "";
    expenseCategory.value = "auto";
    expenseNotes.value = "";
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    if (authToken) {
        showMainApp();
        loadUserData();
    } else {
        showAuthModal();
    }

    // Set default date to today
    expenseDate.value = new Date().toISOString().split('T')[0];

    // Load persisted monthly limit if available
    const savedLimit = localStorage.getItem(MONTHLY_LIMIT_KEY);
    if (savedLimit !== null && !isNaN(parseFloat(savedLimit))) {
        monthlyLimit = parseFloat(savedLimit);
        updateLimitDisplay();
    }

    // Robust logout binding in case inline handler is blocked
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
});

// Auth form handlers
document.getElementById('loginFormElement').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    await login(email, password);
});

document.getElementById('registerFormElement').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userData = {
        firstName: document.getElementById('registerFirstName').value,
        lastName: document.getElementById('registerLastName').value,
        email: document.getElementById('registerEmail').value,
        password: document.getElementById('registerPassword').value
    };
    await register(userData);
});

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        
        // Update active tab
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update active form
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        document.getElementById(tab + 'Form').classList.add('active');
    });
});

// AI message input
document.getElementById('aiMessageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendAIMessage();
    }
});

// Expense form handlers
addExpenseBtn.addEventListener("click", addExpense);
searchExpense.addEventListener("input", updateExpensesList);
categoryFilter.addEventListener("change", updateExpensesList);
// Delegated delete handler to ensure clicks always register
expensesList.addEventListener('click', (e) => {
    const btn = e.target.closest('.delete-btn');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (id) {
        deleteExpense(id);
    }
});

// Receipt upload
receiptFile.addEventListener('change', handleReceiptUpload);
// Ensure Scan Receipt button opens file picker (robust against inline handler issues)
const scanReceiptBtn = document.querySelector('.receipt-btn');
if (scanReceiptBtn && receiptFile) {
    scanReceiptBtn.addEventListener('click', () => {
        try {
            receiptFile.click();
        } catch (e) {
            console.error('Failed to open file picker:', e);
            showNotification('Unable to open file picker. Check browser permissions.', 'error');
        }
    });
}

// Backup listener for Extract Data button in case inline onclick is blocked
const extractBtn = document.querySelector('.process-btn');
if (extractBtn) {
    extractBtn.addEventListener('click', (e) => {
        e.preventDefault();
        processReceipt();
    });
}

// Backup listener for Get Insights button in case inline onclick is blocked
const getInsightsBtn = document.querySelector('button[onclick*="generate-insights"], button[onclick*="generateInsights"]');
if (getInsightsBtn) {
    getInsightsBtn.addEventListener('click', (e) => {
        try {
            e.preventDefault();
        } catch (_) {}
        generateInsights();
    });
}

// Backup listener for Ask AI button to open modal
const askAIBtn = document.querySelector('button[onclick*="openAIModal"], .ai-features-bar .ai-btn');
if (askAIBtn) {
    askAIBtn.addEventListener('click', (e) => {
        try { e.preventDefault(); } catch (_) {}
        openAIModal();
    });
}

// Backup listener for AI modal close (cancel) button
const aiCloseBtn = document.querySelector('#aiModal .close-btn');
if (aiCloseBtn) {
    aiCloseBtn.addEventListener('click', (e) => {
        try { e.preventDefault(); } catch (_) {}
        closeAIModal();
    });
}

// Backup listener for Smart Search button
const smartSearchBtn = document.querySelector('button[onclick*="semanticSearch"]');
if (smartSearchBtn) {
    smartSearchBtn.addEventListener('click', (e) => {
        try { e.preventDefault(); } catch (_) {}
        semanticSearch();
    });
}

// Toggle for AI insights expand/collapse
aiInsights.addEventListener('click', (e) => {
    const btn = e.target.closest('.insight-toggle');
    if (!btn) return;
    const content = aiInsights.querySelector('.insight-content');
    if (!content) return;
    const collapsed = content.classList.toggle('collapsed');
    btn.textContent = collapsed ? 'Show more' : 'Show less';
});

// Export handlers
exportDataBtn.addEventListener("click", () => {
    const data = {
        expenses,
        monthlyLimit,
        exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-expense-tracker-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

exportPdfBtn.addEventListener("click", () => {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        doc.setFontSize(20);
        doc.setTextColor(124, 58, 237);
        doc.text("AI Expense Tracker Report", pageWidth / 2, 20, { align: "center" });

        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, 30, { align: "center" });

        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text("Summary", 20, 45);

        const total = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        doc.setFontSize(12);
        doc.text(`Monthly Limit: ₹${monthlyLimit.toFixed(2)}`, 20, 55);
        doc.text(`Total Expenses: ₹${total.toFixed(2)}`, 20, 65);
        doc.text(`Remaining Amount: ₹${(monthlyLimit - total).toFixed(2)}`, 20, 75);

        doc.setFontSize(14);
        doc.text("Expense Details", 20, 95);

        const headers = [["Date", "Name", "Category", "Amount", "Notes"]];
        const tableData = expenses.map((expense) => [
            new Date(expense.date).toLocaleDateString(),
            expense.name,
            expense.category,
            `₹${parseFloat(expense.amount).toFixed(2)}`,
            expense.notes || "-",
        ]);

        doc.autoTable({
            head: headers,
            body: tableData,
            startY: 100,
            theme: "grid",
            styles: {
                fontSize: 10,
                cellPadding: 5,
            },
            headStyles: {
                fillColor: [124, 58, 237],
                textColor: 255,
                fontSize: 12,
                fontStyle: "bold",
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245],
            },
        });

        doc.save(`ai-expense-tracker-report-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
        showNotification("There was an error generating the PDF. Please try again.", "error");
    }
});

// Monthly limit handlers
setLimitBtn.addEventListener("click", () => {
    const limit = parseFloat(monthlyLimitInput.value);
    if (limit > 0) {
        monthlyLimit = limit;
        updateLimitDisplay();
        monthlyLimitInput.value = "";
        // Persist limit across reloads
        localStorage.setItem(MONTHLY_LIMIT_KEY, String(monthlyLimit));
        showNotification('Monthly limit set successfully!', 'success');
    }
});

document.getElementById("resetLimit").addEventListener("click", function () {
    monthlyLimit = 0;
    expenses = [];
    monthlyLimitInput.value = "";
    updateLimitDisplay();
    updateExpensesList();
    updateCharts();
    // Clear persisted limit on reset
    localStorage.removeItem(MONTHLY_LIMIT_KEY);
    showNotification('Data reset successfully!', 'success');
});
