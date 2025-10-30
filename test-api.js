// test-api.js
// Node.js script to test main API routes for EXPENSE_TRACKER
// Run: node test-api.js

const fetch = require('node-fetch'); // You may need to run: npm install node-fetch@2

const BASE_URL = 'http://localhost:3000/api';
const userData = {
    email: 'apitestuser@example.com',
    password: 'TestPass123!',
    firstName: 'API',
    lastName: 'Test'
};

let authToken = '';
let expenseId = '';

async function apiCall(endpoint, options = {}) {
    try {
        const res = await fetch(BASE_URL + endpoint, options);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${data.message || JSON.stringify(data)}`);
        return data;
    } catch (e) {
        console.error(`[ERROR][${endpoint}]`, e.message);
        return null;
    }
}

(async () => {
    console.log('--- 1. Health check ---');
    let res = await apiCall('/health');
    console.log(res);

    console.log('\n--- 2. Register user ---');
    res = await apiCall('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
    });
    if (!res || !res.token) {
        console.log('Register error, trying login...');
        res = await apiCall('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userData.email, password: userData.password })
        });
    }
    if (!res || !res.token) throw new Error('Auth failed');
    authToken = res.token;
    console.log('Authenticated, token (truncated):', authToken.substring(0, 24) + '...');

    console.log('\n--- 3. Get user profile ---');
    res = await apiCall('/auth/me', { headers: { Authorization: 'Bearer ' + authToken } });
    console.log(res);

    console.log('\n--- 4. Add new expense (AI category) ---');
    res = await apiCall('/expenses', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + authToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: 'Coffee at Starbucks',
            amount: 5.75,
            category: 'auto',
            date: new Date().toISOString().split('T')[0],
            notes: 'Morning coffee'
        })
    });
    console.log(res);
    expenseId = res && res.data && res.data._id ? res.data._id : '';

    console.log('\n--- 5. List expenses ---');
    res = await apiCall('/expenses', {
        headers: { Authorization: 'Bearer ' + authToken }
    });
    console.log(res && res.data ? res.data.slice(0, 1) : res);

    if (expenseId) {
        console.log(`\n--- 6. Update expense (${expenseId}) ---`);
        res = await apiCall(`/expenses/${expenseId}`, {
            method: 'PUT',
            headers: {
                Authorization: 'Bearer ' + authToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'Updated Coffee',
                amount: 6.50,
                category: 'food',
                date: new Date().toISOString().split('T')[0],
                notes: 'Afternoon update'
            })
        });
        console.log(res);
    }

    console.log('\n--- 7. Get expense stats ---');
    res = await apiCall('/expenses/stats', {
        headers: { Authorization: 'Bearer ' + authToken }
    });
    console.log(res);

    console.log('\n--- 8. AI Chat ---');
    res = await apiCall('/ai/chat', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + authToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'How much did I spend on food?' })
    });
    console.log(res);

    console.log('\n--- 9. Get AI Insights ---');
    res = await apiCall('/ai/insights', { headers: { Authorization: 'Bearer ' + authToken } });
    console.log(res);

    console.log('\n--- 10. Semantic search for "coffee" ---');
    res = await apiCall('/ai/semantic-search', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + authToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: 'coffee' })
    });
    console.log(res);

    if (expenseId) {
        console.log(`\n--- 11. Delete test expense (${expenseId}) ---`);
        res = await apiCall(`/expenses/${expenseId}`, {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + authToken }
        });
        console.log(res);
    }

    console.log('\nAll route tests complete. If all above steps were successful, routes are working!');
})();

