// Configuration
const CONFIG = {
    API_BASE_URL: 'https://subscription-tracker-4pfv.onrender.com/api/v1',
    // For local development: 'http://localhost:3000/api/v1'
};

// Global state
let currentUser = null;
let subscriptions = [];
let isEditMode = false;
let currentSubscriptionId = null;

// DOM Elements
const elements = {
    loading: document.getElementById('loading'),
    authContainer: document.getElementById('auth-container'),
    appContainer: document.getElementById('app-container'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    showRegister: document.getElementById('show-register'),
    showLogin: document.getElementById('show-login'),
    userName: document.getElementById('user-name'),
    logoutBtn: document.getElementById('logout-btn'),
    totalSubscriptions: document.getElementById('total-subscriptions'),
    monthlyCost: document.getElementById('monthly-cost'),
    upcomingRenewals: document.getElementById('upcoming-renewals'),
    yearlyCost: document.getElementById('yearly-cost'),
    subscriptionsGrid: document.getElementById('subscriptions-grid'),
    addSubscriptionBtn: document.getElementById('add-subscription-btn'),
    subscriptionModal: document.getElementById('subscription-modal'),
    subscriptionForm: document.getElementById('subscription-form'),
    modalTitle: document.getElementById('modal-title'),
    toastContainer: document.getElementById('toast-container')
};

// Utility Functions
class Utils {
    static showLoading(show = true) {
        elements.loading.style.display = show ? 'flex' : 'none';
    }

    static showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    static formatCurrency(amount, currency = 'USD') {
        try {
            const numAmount = parseFloat(amount) || 0;
            return new window.Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency || 'USD'
            }).format(numAmount);
        } catch (error) {
            console.warn('Error formatting currency, using fallback:', error);

            // Fallback currency formatting
            const symbols = {
                'USD': '$',
                'EUR': '€',
                'GBP': '£',
                'INR': '₹'
            };
            const symbol = symbols[currency] || currency;
            return `${symbol}${parseFloat(amount) || 0}`;
        }
    }

    static formatDate(date) {
        try {
            // Use the global Intl object explicitly
            return new window.Intl.DateFormat('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }).format(new Date(date));
        } catch (error) {
            console.warn('Error with Intl.DateFormat, using fallback:', error);

            // Fallback to basic date formatting
            const dateObj = new Date(date);
            const months = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];

            return `${months[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;
        }
    }

    static calculateDaysUntil(date) {
        const today = new Date();
        const targetDate = new Date(date);
        const diffTime = targetDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    static getCategoryIcon(category) {
        const icons = {
            entertainment: 'fas fa-tv',
            productivity: 'fas fa-briefcase',
            education: 'fas fa-graduation-cap',
            fitness: 'fas fa-dumbbell',
            music: 'fas fa-music',
            cloud: 'fas fa-cloud',
            other: 'fas fa-circle'
        };
        return icons[category] || icons.other;
    }
}

// API Service
class ApiService {
    static async makeRequest(endpoint, options = {}) {
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers
        };

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Auth endpoints
    static async signUp(userData) {
        return this.makeRequest('/auth/sign-up', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    static async signIn(credentials) {
        return this.makeRequest('/auth/sign-in', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
    }

    // Subscription endpoints
    static async getSubscriptions() {
        return this.makeRequest('/subscriptions');
    }


    static async createSubscription(subscriptionData) {
        return this.makeRequest('/subscriptions', {
            method: 'POST',
            body: JSON.stringify(subscriptionData)
        });
    }

    static async updateSubscription(id, subscriptionData) {
        return this.makeRequest(`/subscriptions/${id}`, {
            method: 'PUT',
            body: JSON.stringify(subscriptionData)
        });
    }

    static async deleteSubscription(id) {
        return this.makeRequest(`/subscriptions/${id}`, {
            method: 'DELETE'
        });
    }

    static async triggerReminders(subscriptionId) {
        return this.makeRequest('/subscriptions/reminders', {
            method: 'POST',
            body: JSON.stringify({ subscriptionId })
        });
    }
}

// Auth Management
// Auth Management
class AuthManager {
    static init() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');

        if (token && user && user !== 'undefined' && user !== 'null') {
            try {
                currentUser = JSON.parse(user);

                // Validate that currentUser has required properties
                if (currentUser && typeof currentUser === 'object') {
                    this.showApp();
                } else {
                    throw new Error('Invalid user data structure');
                }
            } catch (error) {
                console.error('Error parsing user data:', error);
                this.clearAuthData();
                this.showAuth();
            }
        } else {
            this.clearAuthData();
            this.showAuth();
        }
    }

    static showAuth() {
        elements.authContainer.classList.remove('hidden');
        elements.appContainer.classList.add('hidden');
        Utils.showLoading(false);
    }

    static showApp() {
        elements.authContainer.classList.add('hidden');
        elements.appContainer.classList.remove('hidden');

        // Now we know the user object has a 'name' property
        const displayName = currentUser?.name || 'User';
        elements.userName.textContent = `Welcome, ${displayName}`;

        Utils.showLoading(false);
        SubscriptionManager.loadSubscriptions();
    }

    static clearAuthData() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        currentUser = null;
    }

    static async signUp(formData) {
        try {
            Utils.showLoading(true);
            const response = await ApiService.signUp(formData);

            console.log('Sign-up response:', response);

            // Handle the nested response structure
            const { data } = response;
            if (data && data.token && data.user) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                currentUser = data.user;

                Utils.showToast('Account created successfully!');
                this.showApp();
            } else {
                throw new Error('Invalid response from server - missing token or user data');
            }
        } catch (error) {
            Utils.showToast(error.message, 'error');
            console.error('Sign up error:', error);
        } finally {
            Utils.showLoading(false);
        }
    }

    static async signIn(credentials) {
        try {
            Utils.showLoading(true);
            const response = await ApiService.signIn(credentials);

            console.log('Sign-in response:', response);

            // Handle the nested response structure
            const { data } = response;
            if (data && data.token && data.user) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                currentUser = data.user;

                Utils.showToast('Welcome back!');
                this.showApp();
            } else {
                throw new Error('Invalid response from server - missing token or user data');
            }
        } catch (error) {
            Utils.showToast(error.message, 'error');
            console.error('Sign in error:', error);
        } finally {
            Utils.showLoading(false);
        }
    }

    static logout() {
        this.clearAuthData();
        subscriptions = [];
        this.showAuth();
        Utils.showToast('Logged out successfully');
    }
}


// Subscription Management
class SubscriptionManager {
    static async loadSubscriptions() {
        try {
            Utils.showLoading(true);
            const response = await ApiService.getSubscriptions();

            console.log(response);


            subscriptions = response.data || response.subscriptions || [];
            this.renderSubscriptions();
            this.updateStats();
        } catch (error) {
            Utils.showToast('Failed to load subscriptions', 'error');
            this.renderEmptyState();
        } finally {
            Utils.showLoading(false);
        }
    }

    static renderSubscriptions() {
        console.log('renderSubscriptions called with:', subscriptions);

        if (!subscriptions || subscriptions.length === 0) {
            console.log('No subscriptions found, rendering empty state');
            this.renderEmptyState();
            return;
        }

        try {
            const subscriptionsHTML = subscriptions.map((subscription, index) => {
                console.log(`Rendering subscription ${index}:`, subscription);

                // Safe property access with fallbacks - handle both field names
                const name = subscription.name || subscription.serviceName || 'Unknown Service';
                const serviceName = subscription.serviceName || subscription.name || 'Unknown Service';
                const price = subscription.price || 0;
                const currency = subscription.currency || 'USD';
                const frequency = subscription.frequency || 'monthly';
                const category = subscription.category || 'entertainment';
                const status = subscription.status || 'active';
                const paymentMethod = subscription.paymentMethod || '';
                const planName = subscription.planName || 'Standard Plan';

                // Handle renewal date safely
                let renewalDateText = 'No renewal date set';
                let daysUntilRenewal = 0;
                let isUpcoming = false;

                if (subscription.renewalDate) {
                    try {
                        const renewalDate = new Date(subscription.renewalDate);
                        if (!isNaN(renewalDate.getTime())) {
                            renewalDateText = `Renews ${Utils.formatDate(renewalDate)}`;
                            daysUntilRenewal = Utils.calculateDaysUntil(subscription.renewalDate);
                            isUpcoming = daysUntilRenewal <= 7 && daysUntilRenewal >= 0;

                            if (isUpcoming) {
                                renewalDateText += ` (${daysUntilRenewal} days)`;
                            }
                        }
                    } catch (dateError) {
                        console.warn('Error parsing renewal date for subscription:', subscription._id, dateError);
                    }
                }

                return `
                <div class="subscription-card ${isUpcoming ? 'upcoming-renewal' : ''}">
                    <div class="subscription-header">
                        <div class="service-info">
                            <h3>${serviceName}</h3>
                            <p>${planName}</p>
                        </div>
                        <div class="subscription-actions">
                            <button class="btn-icon btn-edit" onclick="SubscriptionManager.editSubscription('${subscription._id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon btn-delete" onclick="SubscriptionManager.deleteSubscription('${subscription._id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="subscription-details">
                        <div class="price-info">
                            <span class="price">${Utils.formatCurrency(price, currency)}</span>
                            <span class="frequency">/${frequency}</span>
                        </div>
                        <div class="renewal-info">
                            <i class="fas fa-calendar-alt"></i>
                            <span>${renewalDateText}</span>
                        </div>
                        ${paymentMethod ? `
                            <div class="renewal-info">
                                <i class="fas fa-credit-card"></i>
                                <span>${paymentMethod}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px;">
                        <span class="category-tag">
                            <i class="${Utils.getCategoryIcon(category)}"></i>
                            ${category}
                        </span>
                        <span class="status-badge status-${status}">
                            ${status}
                        </span>
                    </div>
                </div>
            `;
            }).join('');

            console.log('Generated HTML length:', subscriptionsHTML.length);

            if (elements.subscriptionsGrid) {
                elements.subscriptionsGrid.innerHTML = subscriptionsHTML;
                console.log('HTML inserted into grid');
            } else {
                console.error('subscriptionsGrid element not found!');
            }

        } catch (renderError) {
            console.error('Error in renderSubscriptions:', renderError);
            console.error('Error stack:', renderError.stack);
            Utils.showToast('Error displaying subscriptions', 'error');
            this.renderEmptyState();
        }
    }



    static renderEmptyState() {
        elements.subscriptionsGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-credit-card"></i>
                <h3>No subscriptions yet</h3>
                <p>Start tracking your subscriptions to get insights and reminders</p>
                <button class="btn-primary" onclick="ModalManager.showSubscriptionModal()">
                    <i class="fas fa-plus"></i> Add Your First Subscription
                </button>
            </div>
        `;
    }

    static updateStats() {
        const totalSubs = subscriptions.length;

        const monthlyCost = subscriptions.reduce((total, sub) => {
            const price = parseFloat(sub.price) || 0;
            if (sub.frequency === 'monthly') return total + price;
            if (sub.frequency === 'yearly') return total + (price / 12);
            if (sub.frequency === 'weekly') return total + (price * 4.33);
            return total;
        }, 0);

        const yearlyCost = monthlyCost * 12;

        const upcomingRenewals = subscriptions.filter(sub => {
            if (!sub.renewalDate) return false;
            const daysUntil = Utils.calculateDaysUntil(sub.renewalDate);
            return daysUntil >= 0 && daysUntil <= 7;
        }).length;

        elements.totalSubscriptions.textContent = totalSubs;
        elements.monthlyCost.textContent = Utils.formatCurrency(monthlyCost);
        elements.yearlyCost.textContent = Utils.formatCurrency(yearlyCost);
        elements.upcomingRenewals.textContent = upcomingRenewals;
    }


    static editSubscription(id) {
        const subscription = subscriptions.find(sub => sub._id === id);
        if (subscription) {
            isEditMode = true;
            currentSubscriptionId = id;
            ModalManager.showSubscriptionModal(subscription);
        }
    }

    static async deleteSubscription(id) {
        if (!confirm('Are you sure you want to delete this subscription?')) return;

        try {
            Utils.showLoading(true);
            await ApiService.deleteSubscription(id);
            Utils.showToast('Subscription deleted successfully');
            await this.loadSubscriptions();
        } catch (error) {
            Utils.showToast('Failed to delete subscription', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    static async saveSubscription(formData) {
        try {
            Utils.showLoading(true);

            if (isEditMode && currentSubscriptionId) {
                await ApiService.updateSubscription(currentSubscriptionId, formData);
                Utils.showToast('Subscription updated successfully');
            } else {
                await ApiService.createSubscription(formData);
                Utils.showToast('Subscription added successfully');
            }

            ModalManager.hideSubscriptionModal();
            await this.loadSubscriptions();
        } catch (error) {
            Utils.showToast(error.message, 'error');
        } finally {
            Utils.showLoading(false);
        }
    }
}

// Modal Management
class ModalManager {
    // In ModalManager class
    // In ModalManager class
    static showSubscriptionModal(subscription = null) {
        isEditMode = !!subscription;
        currentSubscriptionId = subscription ? subscription._id : null;

        elements.modalTitle.textContent = isEditMode ? 'Edit Subscription' : 'Add New Subscription';

        if (subscription) {
            // Map the data fields correctly
            document.getElementById('service-name').value = subscription.name || subscription.serviceName || '';
            document.getElementById('plan-name').value = subscription.planName || '';
            document.getElementById('price').value = subscription.price || '';
            document.getElementById('currency').value = subscription.currency || 'USD';
            document.getElementById('frequency').value = subscription.frequency || 'monthly';
            document.getElementById('category').value = subscription.category || 'entertainment';
            document.getElementById('payment-method').value = subscription.paymentMethod || '';

            // Format start date for input
            if (subscription.startDate) {
                const date = new Date(subscription.startDate);
                document.getElementById('start-date').value = date.toISOString().split('T')[0];
            }
        } else {
            elements.subscriptionForm.reset();
            // Set default start date to today for new subscriptions
            const today = new Date();
            document.getElementById('start-date').value = today.toISOString().split('T')[0];
        }

        elements.subscriptionModal.classList.add('active');
    }



    static hideSubscriptionModal() {
        elements.subscriptionModal.classList.remove('active');
        elements.subscriptionForm.reset();
        isEditMode = false;
        currentSubscriptionId = null;
    }
}

// Event Listeners
function initEventListeners() {
    // Auth form toggles
    elements.showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        elements.loginForm.classList.add('hidden');
        elements.registerForm.classList.remove('hidden');
    });

    elements.showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        elements.registerForm.classList.add('hidden');
        elements.loginForm.classList.remove('hidden');
    });

    // Form submissions
    elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        await AuthManager.signIn({
            email: formData.get('email') || document.getElementById('login-email').value,
            password: formData.get('password') || document.getElementById('login-password').value
        });
    });

    elements.registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        await AuthManager.signUp({
            name: formData.get('name') || document.getElementById('register-name').value,
            email: formData.get('email') || document.getElementById('register-email').value,
            password: formData.get('password') || document.getElementById('register-password').value
        });
    });

    // App navigation
    elements.logoutBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
            AuthManager.logout();
        }
    });

    // Subscription management
    elements.addSubscriptionBtn.addEventListener('click', () => {
        ModalManager.showSubscriptionModal();
    });

    // Update the subscription form submission
    elements.subscriptionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        // Format data with user-provided start date
        const subscriptionData = {
            name: formData.get('service-name') || document.getElementById('service-name').value,
            price: parseFloat(formData.get('price') || document.getElementById('price').value),
            currency: formData.get('currency') || document.getElementById('currency').value,
            frequency: formData.get('frequency') || document.getElementById('frequency').value,
            category: formData.get('category') || document.getElementById('category').value,
            paymentMethod: formData.get('payment-method') || document.getElementById('payment-method').value,
            status: "active",
            startDate: new Date(formData.get('start-date') || document.getElementById('start-date').value).toISOString(),
            planName: formData.get('plan-name') || document.getElementById('plan-name').value,
            serviceName: formData.get('service-name') || document.getElementById('service-name').value
        };

        console.log('Subscription data being sent:', subscriptionData);

        await SubscriptionManager.saveSubscription(subscriptionData);
    });



    // Modal controls
    document.querySelector('.close-modal').addEventListener('click', ModalManager.hideSubscriptionModal);
    document.querySelector('.cancel-btn').addEventListener('click', ModalManager.hideSubscriptionModal);

    elements.subscriptionModal.addEventListener('click', (e) => {
        if (e.target === elements.subscriptionModal) {
            ModalManager.hideSubscriptionModal();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            ModalManager.hideSubscriptionModal();
        }
    });
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    AuthManager.init();
});

// Global functions for onclick handlers
window.SubscriptionManager = SubscriptionManager;
window.ModalManager = ModalManager;
