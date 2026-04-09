/**
 * Switch between navigation tabs
 */
async function showTab(id, title, btn) {
    try {
        console.log('Switching to tab:', id);
        
        // Hide all sections
        const sections = document.querySelectorAll('.section');
        sections.forEach(s => s.classList.remove('active'));

        // Show selected section
        const activeSection = document.getElementById(id);
        if (activeSection) {
            activeSection.classList.add('active');
            _currentActiveTab = id;  // Track current tab
            console.log('Section made active:', id);
        } else {
            console.warn('Section not found:', id);
            return;  // Exit if section doesn't exist
        }

        // Update Nav Buttons
        const buttons = document.querySelectorAll('.nav-btn');
        buttons.forEach(b => b.classList.remove('active'));
        if (btn) {
            btn.classList.add('active');
        }

        // Update Header
        const headerTitle = document.getElementById('header-title');
        if (headerTitle) {
            headerTitle.innerText = title;
        }
        
        // Scroll to top of viewport
        const viewport = document.getElementById('viewport');
        if (viewport) {
            viewport.scrollTop = 0;
        }

        // Load dashboard data when navigating to dashboard tab
        if (id === 'dashboard' && typeof loadFarmerDashboard === 'function') {
            console.log('Loading dashboard...');
            loadFarmerDashboard(currentUserId);
        }

        // Init profile page when navigating to profile tab
        if (id === 'profile' && typeof initProfilePage === 'function') {
            console.log('Initializing profile page...');
            await initProfilePage();
            // Reassert profile tab is still active (in case of async issues)
            if (_currentActiveTab === 'profile') {
                const profileSection = document.getElementById('profile');
                if (profileSection && !profileSection.classList.contains('active')) {
                    profileSection.classList.add('active');
                    console.log('Reapplied active class to profile section');
                }
            }
            console.log('Profile page initialization complete');
        }
    } catch (e) {
        console.error('Error in showTab:', e);
        // Ensure the section stays visible even if initialization fails
        const activeSection = document.getElementById(id);
        if (activeSection) {
            activeSection.classList.add('active');
            _currentActiveTab = id;
        }
    }
}


/**
 * Search/Filter Fertilizer items
 */
function filterFertilizers() {
    const input = normalizeSearchText(document.getElementById('fertSearch').value);
    const items = document.getElementsByClassName('fert-item');
    
    Array.from(items).forEach(item => {
        const hay = item.dataset.search || normalizeSearchText(item.textContent || '');
        item.style.display = !input || hay.includes(input) ? "block" : "none";
    });
}

function filterMarketProducts() {
    const input = normalizeSearchText(document.getElementById('marketSearch').value);
    const items = document.querySelectorAll('.market-card-new');
    items.forEach(item => {
        const hay = item.dataset.search || normalizeSearchText(item.textContent || '');
        item.style.display = (!input || hay.includes(input)) ? '' : 'none';
    });
}

let _debounceTimers = {};
function debounce(fn, key, delay) {
    return function(...args) {
        clearTimeout(_debounceTimers[key]);
        _debounceTimers[key] = setTimeout(() => fn.apply(this, args), delay);
    };
}
const debouncedFilterFert = debounce(filterFertilizers, 'fert', 200);
const debouncedFilterMarket = debounce(filterMarketProducts, 'market', 200);

const MARKET_STORAGE_KEY = 'marketProducts';
const FERT_STORAGE_KEY = 'fertilizerProducts';
const AUTH_STORAGE_KEY = 'ffAuth';

const PROFILE_STORAGE_KEY = 'ffProfile';

// ===== IMAGE UPLOAD HELPERS =====
// Stores uploaded image URLs keyed by input ID
const _uploadedImages = {};

function handleImageUpload(fileInput, inputId, previewId) {
    const file = fileInput.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        alert('Image too large. Maximum 5MB.');
        return;
    }

    const previewEl = document.getElementById(previewId);
    previewEl.innerHTML = '<div class="upload-spinner"></div><p style="font-size:12px;color:#888;">Uploading...</p>';

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const url = await API.uploadImage(e.target.result);
            _uploadedImages[inputId] = url;
            previewEl.innerHTML = `
                <img src="${url}" alt="Preview">
                <button type="button" class="remove-preview" onclick="clearImagePreview('${inputId}', '${previewId}')">
                    <i class="fa-solid fa-trash"></i> Remove
                </button>`;
        } catch (err) {
            previewEl.innerHTML = '';
            alert('Upload failed: ' + err.message);
        }
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
}

function clearImagePreview(inputId, previewId) {
    delete _uploadedImages[inputId];
    document.getElementById(previewId).innerHTML = '';
    const urlInput = document.getElementById(inputId);
    if (urlInput) urlInput.value = '';
}

function toggleUrlInput(wrapperId) {
    const el = document.getElementById(wrapperId);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function getImageValue(inputId) {
    if (_uploadedImages[inputId]) return _uploadedImages[inputId];
    const el = document.getElementById(inputId);
    return el ? el.value.trim() : '';
}

// ===== LOCATION FILTER =====
const LOCATIONS = ['Coimbatore', 'Chennai', 'Madurai', 'Salem', 'Erode', 'Trichy', 'Thanjavur', 'Karnal'];

function buildLocationOptions() {
    return '<option value="">All Locations</option>' +
        LOCATIONS.map(l => `<option value="${l}">${l}</option>`).join('');
}

async function filterByLocation(section) {
    const el = document.getElementById(section + 'LocationFilter');
    const location = el ? el.value : '';

    if (section === 'market') {
        await fetchMarketProducts(location || undefined);
        renderMarketProducts();
    } else if (section === 'fert') {
        await fetchFertilizers(location || undefined);
        renderFertilizers();
    } else if (section === 'feed') {
        await fetchCattleFeeds(location || undefined);
        renderCattleFeeds();
    } else if (section === 'cattleProduct') {
        await fetchCattleProducts(location || undefined);
        renderCattleProducts();
    } else if (section === 'doctor') {
        await fetchDoctors(location || undefined);
        renderDoctorsFromDB();
    }
}

// In-memory caches (loaded from server on init)
let _marketProducts = [];
let _fertilizers = [];
let _cattleFeeds = [];
let _cattleProducts = [];
let _doctors = [];
let _cattleDiseases = {};
let _cart = [];
let _currentProfile = {};
let _cropCatalog = [];
const CART_STORAGE_KEY = 'farmersfront_cart';
let _lastCartOpenAt = 0;
let _currentActiveTab = 'home';  // Track the currently active tab to prevent unintended switches

function persistCartState() {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(_cart));
    } catch (err) {
        console.warn('Unable to persist cart state:', err.message);
    }
}

function hydrateCartState() {
    try {
        const raw = localStorage.getItem(CART_STORAGE_KEY);
        if (!raw) {
            _cart = [];
            return;
        }

        const parsed = JSON.parse(raw);
        _cart = Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.warn('Unable to restore cart state:', err.message);
        _cart = [];
    }
}

// ===== CART SYSTEM =====
function addToCart(item) {
    const existing = _cart.find(c => c.id === item.id && c.source === item.source);
    if (existing) {
        existing.qty = item.qty;
        existing.totalPrice = item.totalPrice;
    } else {
        _cart.push(item);
    }
    persistCartState();
    renderCartPanel();
    showCartNotification(item.name);
}

function removeFromCart(index) {
    _cart.splice(index, 1);
    persistCartState();
    renderCartPanel();
}

function getCartTotal() {
    return _cart.reduce((sum, item) => sum + Number(item.totalPrice), 0);
}

function formatTo2f(value) {
    return Number(value || 0).toFixed(2);
}

function openCartPanel() {
    const panel = document.getElementById('cartPanel');
    const overlay = document.getElementById('cartOverlay');
    if (!panel) return;
    panel.classList.add('cart-open');
    if (overlay) overlay.classList.add('cart-overlay-show');
    _lastCartOpenAt = Date.now();
    renderCartPanel();
}

function closeCartPanel() {
    const panel = document.getElementById('cartPanel');
    const overlay = document.getElementById('cartOverlay');
    if (panel) panel.classList.remove('cart-open');
    if (overlay) overlay.classList.remove('cart-overlay-show');
}

function closeCartPanelFromOverlay() {
    if (Date.now() - _lastCartOpenAt < 250) return;
    closeCartPanel();
}

function toggleCartPanel() {
    const panel = document.getElementById('cartPanel');
    if (!panel) return;
    if (panel.classList.contains('cart-open')) {
        closeCartPanel();
    } else {
        openCartPanel();
    }
}

function showCartNotification(name) {
    const badge = document.getElementById('cartBadge');
    if (badge) {
        badge.textContent = _cart.length;
        badge.style.display = _cart.length > 0 ? 'flex' : 'none';
    }
}

function renderCartPanel() {
    const list = document.getElementById('cartItemsList');
    const totalEl = document.getElementById('cartTotalPrice');
    const badge = document.getElementById('cartBadge');
    const emptyMsg = document.getElementById('cartEmpty');
    const cartFooter = document.getElementById('cartFooter');
    if (!list) return;

    if (badge) {
        badge.textContent = _cart.length;
        badge.style.display = _cart.length > 0 ? 'flex' : 'none';
    }

    if (_cart.length === 0) {
        list.innerHTML = '';
        if (emptyMsg) emptyMsg.style.display = 'block';
        if (cartFooter) cartFooter.style.display = 'none';
        return;
    }
    if (emptyMsg) emptyMsg.style.display = 'none';
    if (cartFooter) cartFooter.style.display = 'block';

    list.innerHTML = _cart.map((item, i) => `
        <div class="cart-item">
            <img src="${item.image}" class="cart-item-img" loading="lazy" onerror="this.src='image/seeds.jpg'">
            <div class="cart-item-info">
                <strong>${item.name}</strong>
                <small>${item.qtyLabel}</small>
                <span class="cart-item-price">₹${formatTo2f(item.totalPrice)}</span>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart(${i})" title="Remove">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `).join('');

    if (totalEl) totalEl.textContent = getCartTotal();
}

function showPaymentUI() {
    const panel = document.getElementById('cartPaymentSection');
    const itemsSection = document.getElementById('cartItemsSection');
    if (!panel || !itemsSection) return;
    itemsSection.style.display = 'none';
    panel.style.display = 'block';

    const total = getCartTotal();
    document.getElementById('payAmount').textContent = total;
    document.getElementById('payItemCount').textContent = _cart.length;

    // Build order summary
    const summaryEl = document.getElementById('payOrderSummary');
    if (summaryEl) {
        summaryEl.innerHTML = _cart.map(item => `
            <div class="pay-summary-row">
                <span>${item.name} (${item.qtyLabel})</span>
                <span>₹${formatTo2f(item.totalPrice)}</span>
            </div>
        `).join('');
    }
}

function cancelPayment() {
    const panel = document.getElementById('cartPaymentSection');
    const itemsSection = document.getElementById('cartItemsSection');
    if (panel) panel.style.display = 'none';
    if (itemsSection) itemsSection.style.display = 'block';
}

async function processPayment() {
    const method = document.querySelector('input[name="payMethod"]:checked');
    if (!method) { alert('Please select a payment method.'); return; }

    const total = getCartTotal();
    const methodLabel = method.parentElement.textContent.trim();
    const transactionId = `TXN${Date.now()}`;
    const orderNumber = `ORD${Math.floor(100000 + Math.random() * 900000)}`;
    const orderItems = JSON.parse(JSON.stringify(_cart)); // Save cart items before clearing

    // Simulate payment
    const payBtn = document.getElementById('payNowBtn');
    if (payBtn) {
        payBtn.disabled = true;
        payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    }

    setTimeout(async () => {
        try {
            // Update stock for each product in cart
            const products = loadMarketProducts();
            
            for (const cartItem of orderItems) {
                if (cartItem.source === 'market') {
                    const product = products.find(p => p.id === cartItem.id);
                    if (product) {
                        // Calculate quantity in packs (cartItem.qty is in grams, we need to calculate packs)
                        const baseQty = Number(product.minQuantity || 100);
                        const packsSold = Math.ceil(cartItem.qty / baseQty);
                        
                        // Reduce stock
                        const newStock = Math.max(0, product.stock - packsSold);
                        
                        // Update via API
                        await API.updateMarketProduct(product.id, { stock: newStock });
                    }
                }
            }
            
            // Reload products to reflect stock changes
            await fetchMarketProducts();
            
        } catch (err) {
            console.error('Error updating stock:', err);
            // Continue with payment success even if stock update fails
        }

        // Build order summary using saved cart items
        const orderSummaryHTML = orderItems.map(item => `
            <div class="success-order-item">
                <div class="success-item-details">
                    <strong>${item.name}</strong>
                    <span class="success-item-qty">${item.qtyLabel}</span>
                </div>
                <div class="success-item-price">₹${formatTo2f(item.totalPrice)}</div>
            </div>
        `).join('');

        // Show success
        const panel = document.getElementById('cartPaymentSection');
        if (panel) {
            panel.innerHTML = `
                <div class="payment-success">
                    <i class="fa-solid fa-circle-check" style="font-size:60px; color:var(--btn-green);"></i>
                    <h2>Payment Successful!</h2>
                    
                    <div class="success-transaction-info">
                        <div class="success-info-row">
                            <span class="success-label">Order Number:</span>
                            <span class="success-value">${orderNumber}</span>
                        </div>
                        <div class="success-info-row">
                            <span class="success-label">Transaction ID:</span>
                            <span class="success-value success-txn-id">${transactionId}</span>
                        </div>
                        <div class="success-info-row">
                            <span class="success-label">Payment Method:</span>
                            <span class="success-value">${methodLabel}</span>
                        </div>
                        <div class="success-info-row">
                            <span class="success-label">Date & Time:</span>
                            <span class="success-value">${new Date().toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <div class="success-items-summary">
                        <h4>Order Items</h4>
                        ${orderSummaryHTML}
                    </div>
                    
                    <div class="success-final-total">
                        <strong>Total Amount:</strong>
                        <strong class="success-total-amount">₹${formatTo2f(total)}</strong>
                    </div>
                    
                    <p style="color:#666; font-size:13px; text-align:center; margin-top:12px;">
                        <i class="fa-solid fa-check-circle" style="color:var(--btn-green);"></i>
                        Your order has been placed successfully.
                    </p>
                    
                    <button class="verify-btn" style="background:var(--btn-green); margin-top:15px; width:100%;" onclick="closePaymentSuccess()">
                        <i class="fa-solid fa-check"></i> Done
                    </button>
                </div>
            `;
        }
    }, 1500);
}

function closePaymentSuccess() {
    const panel = document.getElementById('cartPaymentSection');
    const itemsSection = document.getElementById('cartItemsSection');
    if (panel) {
        panel.style.display = 'none';
        panel.innerHTML = '';
    }
    if (itemsSection) itemsSection.style.display = 'block';
    
    // Clear cart only when user explicitly closes the success page
    _cart = [];
    persistCartState();
    renderCartPanel();
    
    toggleCartPanel();
}

const auth = getAuth();
const currentUserId = auth?.userId || '';
const currentRole = auth?.role || '';
const isAdmin = currentRole === 'admin';
const isSeller = currentRole === 'seller';
const isUser = currentRole === 'user';

// Show Dashboard nav button for seller/admin role
if (isSeller || isAdmin) {
    const dashBtn = document.getElementById('dashboardNavBtn');
    if (dashBtn) dashBtn.style.display = '';
}

const undoState = {
    product: null,
    timer: null
};
function getAuth() {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch (error) {
        return null;
    }
}

function setAuth(payload) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
}

function requireAuth() {
    if (!auth) {
        window.location.href = 'login.html';
    }
}

function switchAuthTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const subtitle = document.getElementById('authSubtitle');
    const tabs = document.querySelectorAll('.auth-tab');

    tabs.forEach(t => t.classList.remove('active'));

    if (tab === 'register') {
        loginForm.style.display = 'none';
        registerForm.style.display = 'flex';
        subtitle.textContent = 'Create a new account';
        tabs[1].classList.add('active');
    } else {
        loginForm.style.display = 'flex';
        registerForm.style.display = 'none';
        subtitle.textContent = 'Login to continue';
        tabs[0].classList.add('active');
    }
}

function initApiBaseConfig() {
    const baseInput = document.getElementById('apiBaseInput');
    const saveBtn = document.getElementById('saveApiBaseBtn');
    const testBtn = document.getElementById('testApiBaseBtn');
    const clearBtn = document.getElementById('clearApiBaseBtn');
    const statusEl = document.getElementById('apiConfigStatus');
    if (!baseInput || !saveBtn || !testBtn || !clearBtn || !statusEl) return;

    const current = API.getBaseUrl();
    baseInput.value = current || '';
    statusEl.textContent = current
        ? `Current backend: ${current}`
        : 'Using auto-detected backend.';

    const getInput = () => (baseInput.value || '').trim().replace(/\/+$/, '');
    const setStatus = (message, isError = false) => {
        statusEl.textContent = message;
        statusEl.classList.toggle('error', isError);
    };

    saveBtn.addEventListener('click', () => {
        const value = getInput();
        if (!/^https?:\/\//i.test(value)) {
            setStatus('Enter a valid URL (http:// or https://).', true);
            return;
        }
        API.setBaseUrl(value);
        setStatus(`Saved backend: ${API.getBaseUrl()}`);
    });

    testBtn.addEventListener('click', async () => {
        const value = getInput();
        if (!/^https?:\/\//i.test(value)) {
            setStatus('Enter a valid URL (http:// or https://).', true);
            return;
        }

        API.setBaseUrl(value);
        setStatus('Testing backend connection...');
        try {
            const result = await API.healthCheck();
            if (result && result.ok) {
                setStatus(`Connected successfully: ${API.getBaseUrl()}`);
                return;
            }
            setStatus(`Connected with warning at ${API.getBaseUrl()}.`, false);
        } catch (err) {
            setStatus(`Connection failed: ${err.message}`, true);
        }
    });

    clearBtn.addEventListener('click', () => {
        API.setBaseUrl('');
        baseInput.value = API.getBaseUrl() || '';
        setStatus(baseInput.value
            ? `Using auto backend: ${baseInput.value}`
            : 'Using auto-detected backend.');
    });
}

function initLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (!loginForm) return;

    initApiBaseConfig();

    // Login handler — calls server API
    loginForm.addEventListener('submit', async event => {
        event.preventDefault();
        const userId = document.getElementById('loginId')?.value.trim();
        const password = document.getElementById('loginPassword')?.value.trim();

        if (!userId) { alert('Please enter your User ID.'); return; }
        if (!password) { alert('Please enter your password.'); return; }

        try {
            const user = await API.login(userId, password);
            setAuth({ role: user.role, userId: user.userId, name: user.name });
            window.location.href = 'index.html';
        } catch (err) {
            alert(err.message);
        }
    });

    // Registration handler — calls server API
    if (registerForm) {
        registerForm.addEventListener('submit', async event => {
            event.preventDefault();
            const role = document.getElementById('regRole')?.value;
            const name = document.getElementById('regName')?.value.trim();
            const email = document.getElementById('regEmail')?.value.trim();
            const userId = document.getElementById('regId')?.value.trim();
            const password = document.getElementById('regPassword')?.value.trim();
            const confirmPassword = document.getElementById('regConfirmPassword')?.value.trim();

            if (!role || !name || !email || !userId || !password || !confirmPassword) {
                alert('Please fill all fields.');
                return;
            }

            if (password.length < 4) {
                alert('Password must be at least 4 characters.');
                return;
            }

            if (password !== confirmPassword) {
                alert('Passwords do not match.');
                return;
            }

            try {
                await API.register({ userId, name, email, role, password });
                alert('Registration successful! You can now login.');
                registerForm.reset();
                switchAuthTab('login');
            } catch (err) {
                alert(err.message);
            }
        });
    }
}

function downloadUsersAsExcel() {
    window.open(API.exportUsersUrl(), '_blank');
}

function logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.href = 'login.html';
}

function getProfileKey() {
    return `${PROFILE_STORAGE_KEY}_${auth?.userId || 'guest'}`;
}

function getAverageRating(product) {
    const buys = Number(product.buys || 0);
    if (buys === 0) return { average: 'New', count: 0, numeric: 0 };
    const rating = Math.min(5, 3 + Math.log10(buys + 1) * 1.5);
    return { average: rating.toFixed(1), count: buys, numeric: rating };
}

function loadMarketProducts() {
    return _marketProducts;
}

function saveMarketProducts(products) {
    _marketProducts = products;
}

async function fetchMarketProducts(location) {
    _marketProducts = await API.getMarketProducts(location);
    return _marketProducts;
}

function loadFertilizers() {
    return _fertilizers;
}

function saveFertilizers(items) {
    _fertilizers = items;
}

async function fetchFertilizers(location) {
    _fertilizers = await API.getFertilizers(location);
    return _fertilizers;
}

function loadCropCatalog() {
    return _cropCatalog;
}

async function fetchCrops() {
    _cropCatalog = await API.getCrops();
    return _cropCatalog;
}

function toggleProductForm() {
    const form = document.getElementById('marketForm');
    if (!form) return;
    form.classList.toggle('hidden-form');
}

function resolveProductImage(input) {
    if (!input) return 'image/seeds.jpg';
    if (/^https?:\/\//i.test(input)) return input;
    if (input.startsWith('image/')) return input;
    return `image/${input}`;
}

function canAddProducts() {
    return isAdmin || isSeller;
}

function canBuyProducts() {
    return isAdmin || isUser;
}

function getHolderId(product) {
    if (product.holderId) return product.holderId;
    const match = String(product.holderName || '').match(/F\d+/i);
    return match ? match[0] : '';
}

function isOwnerOfProduct(product) {
    return getHolderId(product) === currentUserId;
}

function canRemoveProduct(product) {
    return isAdmin || (isSeller && isOwnerOfProduct(product));
}

function renderMarketProducts() {
    const list = document.getElementById('marketProductList');
    if (!list) return;

    const products = loadMarketProducts();
    list.innerHTML = '';

    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'market-card-new';
        card.dataset.search = buildProductSearchText(product, [product.holderName, product.holderPhone]);
        const ratingData = getAverageRating(product);
        const aliasHint = getProductAliasHint(product.name);
        const removeButton = canRemoveProduct(product)
            ? `<button class="market-remove-btn" onclick="removeMarketProduct('${product.id}', event)"><i class="fa-solid fa-trash"></i></button>`
            : '';
        const safeImage = resolveProductImage(product.image);
        const stars = renderStars(Number(ratingData.average));
        const unit = product.packUnit || product.unit || 'g';
        const qtyId = `mkQty_${product.id}`;
        const qtyLabelId = `mkQtyLabel_${product.id}`;
        const qtyWrapId = `mkImgQty_${product.id}`;
        const stock = product.stock !== undefined ? Number(product.stock) : null;
        const isSoldOut = stock !== null && stock <= 0;
        const priceLabel = product.packPrice
            ? `₹${product.packPrice}<small>/${product.packWeight || product.minQuantity}${unit}</small>`
            : `₹${product.pricePer100g}<small>/100g</small>`;
        const addBtn = canBuyProducts() && !isSoldOut
            ? `<button class="market-card-cart-btn" onclick="quickAddToCart('${product.id}', event)"><i class="fa-solid fa-cart-plus"></i> Add</button>`
            : isSoldOut ? `<button class="market-card-cart-btn sold-out-btn" disabled>Sold Out</button>` : '';

        card.innerHTML = `
            ${removeButton}
            <div class="market-card-img-wrap${isSoldOut ? ' sold-out-wrap' : ''}" onclick="openProductDetails('${product.id}')">
                <img src="${safeImage}" alt="${product.name}" loading="lazy" onerror="this.src='image/seeds.jpg'">
                ${isSoldOut ? '<div class="sold-out-badge"><span>SOLD OUT</span></div>' : ''}
                ${stock !== null && !isSoldOut ? `<span class="stock-badge">${stock} left</span>` : ''}
                <span class="market-card-badge">${product.packWeight || product.minQuantity}${unit}/pack</span>
                ${canBuyProducts() && !isSoldOut ? `
                <div id="${qtyWrapId}" class="img-qty img-qty-collapsed market-img-qty">
                    <button class="img-qty-launch" onclick="toggleCardImageQty('mk', '${product.id}', event)">+</button>
                    <div class="img-qty-controls">
                        <button class="img-qty-btn" onclick="changeCardImageQty('mk', '${product.id}', -1, event)">-</button>
                        <span id="${qtyLabelId}" class="img-qty-count">0</span>
                        <button class="img-qty-btn" onclick="changeCardImageQty('mk', '${product.id}', 1, event)">+</button>
                    </div>
                    <input id="${qtyId}" type="hidden" value="0">
                </div>` : ''}
            </div>
            <div class="market-card-body" onclick="openProductDetails('${product.id}')">
                <h3 class="market-card-title">${product.name}${product.variety ? ` <small class="variety-tag">${product.variety}</small>` : ''}</h3>
                ${aliasHint ? `<small class="market-card-aliases">${aliasHint}</small>` : ''}
                <p class="market-card-info">${product.info || ''}</p>
                <div class="market-card-meta">
                    <span class="market-card-rating">${stars} <small>(${ratingData.count})</small></span>
                    <span class="market-card-views"><i class="fa-solid fa-eye"></i> ${product.views || 0}</span>
                </div>
                <div class="market-card-seller"><i class="fa-solid fa-user-tag"></i> ${product.holderName}</div>
                ${product.location ? `<div class="market-card-seller" style="color:#1976d2;"><i class="fa-solid fa-location-dot"></i> ${product.location}</div>` : ''}
            </div>
            <div class="market-card-footer">
                <span class="market-card-price">${priceLabel}</span>
                ${addBtn}
            </div>
        `;

        list.appendChild(card);
    });
}


function renderStars(rating) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '<span class="star-icons">' +
        '<i class="fa-solid fa-star"></i>'.repeat(full) +
        (half ? '<i class="fa-solid fa-star-half-stroke"></i>' : '') +
        '<i class="fa-regular fa-star"></i>'.repeat(empty) +
        '</span>';
}

function quickAddToCart(productId, event) {
    if (event) event.stopPropagation();
    if (!canBuyProducts()) { alert('Only users can buy products.'); return; }

    const products = loadMarketProducts();
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Check stock availability
    if (product.stock !== undefined && product.stock <= 0) {
        alert('This product is out of stock.');
        return;
    }

    const qtyInput = document.getElementById(`mkQty_${productId}`);
    const selectedQty = Math.max(0, Number(qtyInput?.value || 0));
    if (selectedQty <= 0) {
        alert('Tap + on the product image to select quantity.');
        return;
    }

    // Validate requested quantity against available stock
    if (product.stock !== undefined && selectedQty > product.stock) {
        alert(`Only ${product.stock} pack(s) available. Please reduce quantity.`);
        return;
    }

    const unit = product.unit || 'g';
    const baseQty = Number(product.minQuantity || 100);
    const qty = selectedQty * baseQty;
    const basePrice = (convertToGrams(baseQty, unit) / 100) * Number(product.pricePer100g);
    const totalPrice = selectedQty * basePrice;

    addToCart({
        id: product.id,
        source: 'market',
        name: product.name,
        image: resolveProductImage(product.image),
        qty: qty,
        qtyLabel: `${selectedQty} x ${baseQty}${unit}`,
        unitPrice: product.pricePer100g,
        totalPrice: totalPrice
    });
}

async function addMarketProduct() {
    const name       = document.getElementById('productName')?.value.trim();
    const info       = document.getElementById('productInfo')?.value.trim();
    const variety    = document.getElementById('productVariety')?.value.trim() || '';
    const packWeight = document.getElementById('packWeight')?.value.trim();
    const packUnit   = document.getElementById('packUnit')?.value || 'g';
    const packPrice  = document.getElementById('packPrice')?.value.trim();
    const stockSize  = document.getElementById('stockSize')?.value.trim();
    const holderName = document.getElementById('holderName')?.value.trim();
    const holderPhone= document.getElementById('holderPhone')?.value.trim();
    const imageInput = getImageValue('productImage');

    if (!canAddProducts()) {
        alert('Only sellers or admins can add products.');
        return;
    }

    if (!name || !info || !holderName || !holderPhone || !imageInput || !packWeight || !packPrice || !stockSize) {
        alert('Please fill all required fields (marked with *).');
        return;
    }

    // Compute pricePer100g for display compatibility on product cards
    let pricePer100g = Number(packPrice);
    const weightNum = Number(packWeight);
    if (packUnit === 'g' && weightNum > 0) {
        pricePer100g = Math.round((Number(packPrice) / weightNum) * 100);
    } else if (packUnit === 'kg' && weightNum > 0) {
        pricePer100g = Math.round((Number(packPrice) / (weightNum * 1000)) * 100);
    }

    const gpsLat = parseFloat(document.getElementById('productLat')?.value);
    const gpsLng = parseFloat(document.getElementById('productLng')?.value);

    const newProduct = {
        name,
        info,
        variety,
        packWeight: weightNum,
        packUnit,
        packPrice: Number(packPrice),
        stock: Number(stockSize),
        holderName,
        holderId: currentUserId,
        holderPhone,
        location: document.getElementById('productLocation')?.value.trim() || '',
        image: resolveProductImage(imageInput),
        pricePer100g,
        minQuantity: weightNum,
        unit: packUnit,
        views: 0,
        buys: 0,
        coords: (Number.isFinite(gpsLat) && Number.isFinite(gpsLng))
            ? { lat: gpsLat, lng: gpsLng }
            : undefined
    };

    await API.addMarketProduct(newProduct);
    await fetchMarketProducts();
    renderMarketProducts();

    // Reset form
    ['productName','productInfo','productVariety','packWeight','packPrice',
     'stockSize','holderName','holderPhone','productLocation'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('packUnit').value = 'g';
    clearImagePreview('productImage', 'productImagePreview');
    const urlWrap = document.getElementById('productImageUrlWrap');
    if (urlWrap) urlWrap.style.display = 'none';

    const form = document.getElementById('marketForm');
    if (form && !form.classList.contains('hidden-form')) {
        form.classList.add('hidden-form');
    }

    alert('Product listed successfully!');
}

// ===== GEOLOCATION & NEARBY BUYER MATCHING =====

let _nearbyMode = false;
let _nearbyUserLat = null;
let _nearbyUserLng = null;

/**
 * Haversine distance between two lat/lng points (in km)
 */
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estimate transport cost (₹) based on distance
 */
function estimateTransport(km) {
    if (km <= 0) return 0;
    if (km < 2) return Math.round(km * 15);
    return Math.round(km * 8);
}

/**
 * Capture user GPS for adding a product listing
 */
function captureProductLocation() {
    const btn = document.getElementById('captureGpsBtn');
    const statusEl = document.getElementById('gpsCaptureStatus');
    if (!navigator.geolocation) {
        if (statusEl) statusEl.textContent = '❌ GPS not supported on this device.';
        return;
    }
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Detecting...';
    }
    if (statusEl) statusEl.textContent = '';

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const latEl = document.getElementById('productLat');
            const lngEl = document.getElementById('productLng');
            if (latEl) latEl.value = lat;
            if (lngEl) lngEl.value = lng;
            if (statusEl) {
                statusEl.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--btn-green)"></i> GPS captured: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            }
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Recapture GPS';
            }
        },
        (err) => {
            if (statusEl) statusEl.textContent = '❌ Could not get location: ' + err.message;
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Use My GPS Location';
            }
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

/**
 * Enable nearby buyer matching mode
 */
function enableNearbyMode() {
    const statusEl = document.getElementById('nearbyStatusText');
    const enableBtn = document.getElementById('enableNearbyBtn');
    const controls = document.getElementById('nearbyControls');

    if (!navigator.geolocation) {
        if (statusEl) statusEl.textContent = '❌ GPS not supported on this device.';
        return;
    }

    if (enableBtn) {
        enableBtn.classList.add('nearby-locating');
        enableBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Detecting location...</span>';
        enableBtn.disabled = true;
    }
    if (statusEl) statusEl.textContent = '';

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            _nearbyUserLat = pos.coords.latitude;
            _nearbyUserLng = pos.coords.longitude;
            _nearbyMode = true;

            if (enableBtn) {
                enableBtn.classList.remove('nearby-locating');
                enableBtn.classList.add('nearby-active-btn');
                enableBtn.innerHTML = '<i class="fa-solid fa-circle-dot nearby-active-dot"></i><span>Nearby Mode ON</span>';
                enableBtn.disabled = true;
            }
            if (controls) controls.style.display = 'flex';

            await fetchNearbyProducts();
        },
        (err) => {
            if (enableBtn) {
                enableBtn.classList.remove('nearby-locating');
                enableBtn.disabled = false;
                enableBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs nearby-pulse-icon"></i><span>Find Nearby Buyers</span>';
            }
            if (statusEl) statusEl.textContent = '❌ Location denied: ' + err.message;
        },
        { enableHighAccuracy: true, timeout: 12000 }
    );
}

/**
 * Clear nearby mode and revert to default listing
 */
async function clearNearbyMode() {
    _nearbyMode = false;
    _nearbyUserLat = null;
    _nearbyUserLng = null;

    const enableBtn = document.getElementById('enableNearbyBtn');
    const controls = document.getElementById('nearbyControls');
    const statusEl = document.getElementById('nearbyStatusText');

    if (enableBtn) {
        enableBtn.classList.remove('nearby-active-btn', 'nearby-locating');
        enableBtn.disabled = false;
        enableBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs nearby-pulse-icon"></i><span>Find Nearby Buyers</span>';
    }
    if (controls) controls.style.display = 'none';
    if (statusEl) statusEl.textContent = '';

    await fetchMarketProducts();
    renderMarketProducts();
}

/**
 * Re-fetch nearby products when radius or sort changes
 */
async function refreshNearbyMode() {
    if (!_nearbyMode || _nearbyUserLat === null) return;
    await fetchNearbyProducts();
}

/**
 * Fetch nearby products from API and render them
 */
async function fetchNearbyProducts() {
    if (!_nearbyMode || _nearbyUserLat === null) return;

    const radiusKm = parseInt(document.getElementById('nearbyRadiusSelect')?.value || '50');
    const sortBy = document.getElementById('nearbySortSelect')?.value || 'nearest';
    const statusEl = document.getElementById('nearbyStatusText');
    const list = document.getElementById('marketProductList');

    if (statusEl) statusEl.textContent = 'Loading...';
    if (list) list.innerHTML = '<div class="nearby-loading"><i class="fa-solid fa-spinner fa-spin"></i> Finding nearby sellers...</div>';

    try {
        const products = await API.getNearbyProducts(_nearbyUserLat, _nearbyUserLng, radiusKm, sortBy);
        if (statusEl) {
            statusEl.textContent = products.length
                ? `${products.length} seller${products.length !== 1 ? 's' : ''} within ${radiusKm} km`
                : `No sellers found within ${radiusKm} km`;
        }
        renderNearbyMarketProducts(products);
    } catch (err) {
        if (statusEl) statusEl.textContent = '❌ ' + err.message;
        if (list) list.innerHTML = '<p style="text-align:center;color:#888;">Could not load nearby products.</p>';
    }
}

/**
 * Render nearby product cards (with distance + transport badges, contact button)
 */
function renderNearbyMarketProducts(products) {
    const list = document.getElementById('marketProductList');
    if (!list) return;
    list.innerHTML = '';

    if (!products.length) {
        list.innerHTML = `
            <div class="nearby-empty">
                <i class="fa-solid fa-location-dot" style="font-size:40px;color:#ccc;"></i>
                <p>No sellers found nearby. Try increasing the radius.</p>
            </div>`;
        return;
    }

    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'market-card-new nearby-card';
        card.dataset.search = buildProductSearchText(product, [product.holderName, product.holderPhone]);
        const ratingData = getAverageRating(product);
        const aliasHint = getProductAliasHint(product.name);
        const removeButton = canRemoveProduct(product)
            ? `<button class="market-remove-btn" onclick="removeMarketProduct('${product.id}', event)"><i class="fa-solid fa-trash"></i></button>`
            : '';
        const safeImage = resolveProductImage(product.image);
        const stars = renderStars(Number(ratingData.average));
        const unit = product.packUnit || product.unit || 'g';
        const stock = product.stock !== undefined ? Number(product.stock) : null;
        const isSoldOut = stock !== null && stock <= 0;
        const distKm = product.distanceKm;
        const transportRs = product.transportEstimateRs;
        const priceLabel = product.packPrice
            ? `₹${product.packPrice}<small>/${product.packWeight || product.minQuantity}${unit}</small>`
            : `₹${product.pricePer100g}<small>/100g</small>`;
        const addBtn = canBuyProducts() && !isSoldOut
            ? `<button class="market-card-cart-btn" onclick="quickAddToCart('${product.id}', event)"><i class="fa-solid fa-cart-plus"></i> Add</button>`
            : isSoldOut ? `<button class="market-card-cart-btn sold-out-btn" disabled>Sold Out</button>` : '';
        const contactBtn = product.holderPhone
            ? `<a href="tel:${product.holderPhone}" class="contact-buyer-btn"><i class="fa-solid fa-phone"></i> Contact Seller</a>`
            : '';

        card.innerHTML = `
            ${removeButton}
            <div class="market-card-img-wrap${isSoldOut ? ' sold-out-wrap' : ''}" onclick="openProductDetails('${product.id}')">
                <img src="${safeImage}" alt="${product.name}" loading="lazy" onerror="this.src='image/seeds.jpg'">
                ${isSoldOut ? '<div class="sold-out-badge"><span>SOLD OUT</span></div>' : ''}
                ${stock !== null && !isSoldOut ? `<span class="stock-badge">${stock} left</span>` : ''}
                <span class="market-card-badge">${product.packWeight || product.minQuantity}${unit}/pack</span>
                ${distKm !== undefined ? `<span class="nearby-distance-badge"><i class="fa-solid fa-location-dot"></i> ${distKm} km</span>` : ''}
                ${canBuyProducts() && !isSoldOut ? `
                <div id="mkImgQty_${product.id}" class="img-qty img-qty-collapsed market-img-qty">
                    <button class="img-qty-launch" onclick="toggleCardImageQty('mk', '${product.id}', event)">+</button>
                    <div class="img-qty-controls">
                        <button class="img-qty-btn" onclick="changeCardImageQty('mk', '${product.id}', -1, event)">-</button>
                        <span id="mkQtyLabel_${product.id}" class="img-qty-count">0</span>
                        <button class="img-qty-btn" onclick="changeCardImageQty('mk', '${product.id}', 1, event)">+</button>
                    </div>
                    <input id="mkQty_${product.id}" type="hidden" value="0">
                </div>` : ''}
            </div>
            <div class="market-card-body" onclick="openProductDetails('${product.id}')">
                <h3 class="market-card-title">${product.name}${product.variety ? ` <small class="variety-tag">${product.variety}</small>` : ''}</h3>
                ${aliasHint ? `<small class="market-card-aliases">${aliasHint}</small>` : ''}
                <p class="market-card-info">${product.info || ''}</p>
                <div class="market-card-meta">
                    <span class="market-card-rating">${stars} <small>(${ratingData.count})</small></span>
                    <span class="market-card-views"><i class="fa-solid fa-eye"></i> ${product.views || 0}</span>
                </div>
                <div class="market-card-seller"><i class="fa-solid fa-user-tag"></i> ${product.holderName}</div>
                ${product.location ? `<div class="market-card-seller" style="color:#1976d2;"><i class="fa-solid fa-location-dot"></i> ${product.location}</div>` : ''}
                ${transportRs > 0 ? `<div class="nearby-transport-badge"><i class="fa-solid fa-truck"></i> Est. transport: ~₹${transportRs}</div>` : ''}
            </div>
            <div class="market-card-footer nearby-card-footer">
                <span class="market-card-price">${priceLabel}</span>
                ${addBtn}
            </div>
            ${contactBtn ? `<div class="contact-buyer-row">${contactBtn}</div>` : ''}
        `;
        list.appendChild(card);
    });
}


function openProductDetails(productId) {
    window.location.href = `product-details.html?id=${encodeURIComponent(productId)}`;
}

async function loadProductDetailsPage() {
    const detailsContainer = document.getElementById('productDetailsContainer');
    if (!detailsContainer) return;

    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');
    await fetchMarketProducts();
    const products = loadMarketProducts();
    const product = products.find(item => item.id === productId);

    if (!product) {
        detailsContainer.innerHTML = '<p>Product not found.</p>';
        return;
    }

    trackProductView(product.id);

    const ratingData = getAverageRating(product);
    const unit = product.unit || 'g';
    const baseWeight = Number(product.minQuantity || 100);
    const basePrice = Number(product.pricePer100g);
    const stepWeight = unit === 'kg' ? 0.05 : 50;
    const baseTotal = (convertToGrams(baseWeight, unit) / 100) * basePrice;

    const buyButton = canBuyProducts()
        ? `<button class="verify-btn details-cart-btn" onclick="addToCartWithQuantity('${product.id}')">Add to Cart</button>`
        : `<button class="verify-btn details-cart-btn" disabled>Only users can buy</button>`;

    detailsContainer.innerHTML = `
        <div class="details-card">
            <img src="${resolveProductImage(product.image)}" class="details-image" alt="${product.name}" loading="lazy" onerror="this.src='image/seeds.jpg'">
            <div class="details-content">
                <h2>${product.name}</h2>
                <p><strong>Product information:</strong> ${product.info}</p>
                <p><strong>Product holder:</strong> ${product.holderName}</p>
                <p><strong>Phone number:</strong> ${product.holderPhone}</p>
                <p><strong>Rating:</strong> ⭐ ${ratingData.average}${ratingData.count ? ` (${ratingData.count} purchases)` : ''}</p>
                <p class="details-price"><strong>Price (minimum ${formatTo2f(baseWeight)}${unit}):</strong> ₹${formatTo2f(product.pricePer100g)}/100g</p>
                <div class="details-qty-box">
                    <p><strong>Required quantity (${unit}):</strong></p>
                    <div class="qty-controls">
                        <button class="verify-btn qty-btn" onclick="changeRequiredWeight(-${stepWeight}, ${basePrice}, ${baseWeight}, '${unit}')">-</button>
                        <input id="requiredWeight" class="market-input qty-input" type="number" value="${formatTo2f(baseWeight)}" min="${baseWeight}" step="${stepWeight}" readonly>
                        <button class="verify-btn qty-btn" onclick="changeRequiredWeight(${stepWeight}, ${basePrice}, ${baseWeight}, '${unit}')">+</button>
                    </div>
                    <p id="totalPriceDisplay" class="details-total-price"><strong>Total Price:</strong> ₹${formatTo2f(baseTotal)}</p>
                </div>

                ${buyButton}
            </div>
        </div>
    `;
}

async function trackProductView(productId) {
    if (!productId) return;
    const viewKey = `viewed_${productId}`;
    if (sessionStorage.getItem(viewKey)) return;

    const products = loadMarketProducts();
    const product = products.find(item => item.id === productId);
    if (!product) return;

    product.views = Number(product.views || 0) + 1;
    await API.updateMarketProduct(productId, { views: product.views });
    sessionStorage.setItem(viewKey, '1');
}

function changeRequiredWeight(change, pricePer100g, minWeight, unit) {
    const weightInput = document.getElementById('requiredWeight');
    const totalDisplay = document.getElementById('totalPriceDisplay');
    if (!weightInput || !totalDisplay) return;

    const currentWeight = Number(weightInput.value || minWeight);
    const updatedWeight = Math.max(minWeight, currentWeight + change);
    weightInput.value = formatTo2f(updatedWeight);

    const totalPrice = (convertToGrams(updatedWeight, unit) / 100) * Number(pricePer100g);
    totalDisplay.innerHTML = `<strong>Total Price:</strong> ₹${formatTo2f(totalPrice)}`;
}

async function addToCartWithQuantity(productId) {
    if (!canBuyProducts()) {
        alert('Only users can buy products.');
        return;
    }

    const weightInput = document.getElementById('requiredWeight');
    const products = loadMarketProducts();
    const product = products.find(item => item.id === productId);

    if (!weightInput || !product) {
        alert('Unable to add this product now.');
        return;
    }

    // Check stock availability
    if (product.stock !== undefined && product.stock <= 0) {
        alert('This product is out of stock.');
        return;
    }

    const unit = product.unit || 'g';
    const requiredWeight = Number(weightInput.value || 100);
    const minQuantity = Number(product.minQuantity || 100);
    
    // Calculate how many packs are needed
    const packsNeeded = Math.ceil(requiredWeight / minQuantity);
    
    // Validate against available stock
    if (product.stock !== undefined && packsNeeded > product.stock) {
        alert(`Only ${product.stock} pack(s) available (${product.stock * minQuantity}${unit} max). Please reduce quantity.`);
        return;
    }

    const totalPrice = (convertToGrams(requiredWeight, unit) / 100) * Number(product.pricePer100g);
    
    product.buys = Number(product.buys || 0) + 1;
    await API.updateMarketProduct(productId, { buys: product.buys });

    addToCart({
        id: product.id,
        source: 'market',
        name: product.name,
        image: resolveProductImage(product.image),
        qty: requiredWeight,
        qtyLabel: `${formatTo2f(requiredWeight)}${unit}`,
        unitPrice: product.pricePer100g,
        totalPrice: Number(totalPrice.toFixed(2))
    });
}

function convertToGrams(quantity, unit) {
    return unit === 'kg' ? Number(quantity) * 1000 : Number(quantity);
}

function renderFertilizers() {
    const grid = document.getElementById('fertGrid');
    if (!grid) return;

    const fertilizers = loadFertilizers();
    grid.innerHTML = '';

    fertilizers.forEach(item => {
        const card = document.createElement('div');
        card.className = 'product-card fert-item';
        const buttonText = canBuyProducts() ? 'Add to Cart' : 'Users Only';
        const buttonDisabled = canBuyProducts() ? '' : 'disabled';
        const qtyId = `fertQty_${item.id}`;
        const totalId = `fertTotal_${item.id}`;

        card.innerHTML = `
            <img src="${resolveProductImage(item.image)}" class="product-img" alt="${item.name}" loading="lazy" onerror="this.src='image/seeds.jpg'">
            <span class="prod-name">${item.name}</span>
            <span class="prod-price">₹${item.price}</span>
            <small>${item.type} | ${item.brand}</small>
            <div class="qty-controls fert-qty">
                <button class="verify-btn qty-btn" onclick="changeFertilizerQty('${item.id}', -1)">-</button>
                <input id="${qtyId}" class="market-input qty-input" type="number" value="1" min="1" step="1" readonly>
                <button class="verify-btn qty-btn" onclick="changeFertilizerQty('${item.id}', 1)">+</button>
            </div>
            <p id="${totalId}" class="details-total-price"><strong>Total Price:</strong> ₹${item.price}</p>
            <button class="verify-btn" style="background:var(--lab-blue); width:100%; margin-top:5px;" ${buttonDisabled} onclick="addFertilizerToCart('${item.id}')">${buttonText}</button>
        `;

        grid.appendChild(card);
    });
}

function changeFertilizerQty(itemId, delta) {
    const qtyInput = document.getElementById(`fertQty_${itemId}`);
    const totalDisplay = document.getElementById(`fertTotal_${itemId}`);
    if (!qtyInput || !totalDisplay) return;

    const fertilizers = loadFertilizers();
    const item = fertilizers.find(fert => fert.id === itemId);
    if (!item) return;

    const currentQty = Number(qtyInput.value || 1);
    const updatedQty = Math.max(1, currentQty + delta);
    qtyInput.value = String(updatedQty);
    const totalPrice = updatedQty * Number(item.price);
    totalDisplay.innerHTML = `<strong>Total Price:</strong> ₹${totalPrice}`;
}



async function removeMarketProduct(productId, event) {
    if (event) event.stopPropagation();

    // Search in main list first, then in currently displayed nearby cards
    let product = loadMarketProducts().find(item => item.id === productId);
    if (!product) {
        // Nearby mode: product may only be in the rendered list, not _marketProducts
        const cards = document.querySelectorAll('.market-card-new');
        product = Array.from(cards)
            .map(c => c.dataset)
            .find(d => d && d.productId === productId);
        // Fall back: try fetching all products to find it
        if (!product) {
            const all = await API.getMarketProducts();
            product = all.find(p => p.id === productId);
        }
    }

    if (!product) {
        alert('Product not found.');
        return;
    }

    if (!canRemoveProduct(product)) {
        alert('You do not have permission to remove this listing.');
        return;
    }

    const confirmed = confirm('Remove this product from the market?');
    if (!confirmed) return;

    try {
        await API.deleteMarketProduct(productId);
    } catch (err) {
        alert('Delete failed: ' + err.message);
        return;
    }

    // Re-render appropriately based on current mode
    if (_nearbyMode && _nearbyUserLat !== null) {
        await fetchNearbyProducts();
    } else {
        await fetchMarketProducts();
        renderMarketProducts();
    }

    if (isAdmin) {
        queueUndoRemoval(product);
    }
}

function queueUndoRemoval(product) {
    undoState.product = product;
    if (undoState.timer) {
        clearTimeout(undoState.timer);
        undoState.timer = null;
    }

    renderUndoBanner(product.name);
    undoState.timer = setTimeout(() => {
        clearUndoBanner();
        undoState.product = null;
    }, 8000);
}

function renderUndoBanner(productName) {
    let banner = document.getElementById('undoBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'undoBanner';
        banner.className = 'undo-banner';
        document.body.appendChild(banner);
    }

    banner.innerHTML = `
        <span>Removed "${productName}".</span>
        <button class="verify-btn" onclick="undoRemoveProduct()">Undo</button>
    `;
}

function clearUndoBanner() {
    const banner = document.getElementById('undoBanner');
    if (banner) {
        banner.remove();
    }
}

async function undoRemoveProduct() {
    if (!isAdmin || !undoState.product) return;
    await API.addMarketProduct(undoState.product);
    await fetchMarketProducts();
    renderMarketProducts();
    clearUndoBanner();
    undoState.product = null;
    if (undoState.timer) {
        clearTimeout(undoState.timer);
        undoState.timer = null;
    }
}

function setOwnerControlsVisibility() {
    const addButton = document.getElementById('marketAddButton');
    const form = document.getElementById('marketForm');
    if (!addButton || !form) return;

    if (canAddProducts()) {
        addButton.style.display = 'inline-flex';
    } else {
        addButton.style.display = 'none';
        form.classList.add('hidden-form');
    }
}

function setFertilizerControlsVisibility() {
    const addButton = document.getElementById('fertAddButton');
    const form = document.getElementById('fertForm');
    if (!addButton || !form) return;

    if (isAdmin || isSeller) {
        addButton.style.display = 'inline-flex';
    } else {
        addButton.style.display = 'none';
        form.classList.add('hidden-form');
    }
}

function toggleFertilizerForm() {
    const form = document.getElementById('fertForm');
    if (!form) return;
    form.classList.toggle('hidden-form');
}

async function addFertilizer() {
    if (!isAdmin && !isSeller) {
        alert('Only admin or sellers can add fertilizers.');
        return;
    }

    const name       = document.getElementById('fertName')?.value.trim();
    const type       = document.getElementById('fertType')?.value.trim();
    const brand      = document.getElementById('fertBrand')?.value.trim();
    const packWeight = document.getElementById('fertPackWeight')?.value.trim();
    const packUnit   = document.getElementById('fertPackUnit')?.value || 'kg';
    const price      = document.getElementById('fertPrice')?.value.trim();
    const stock      = document.getElementById('fertStock')?.value.trim();
    const imageInput = getImageValue('fertImage');

    if (!name || !type || !brand || !packWeight || !price || !stock || !imageInput) {
        alert('Please fill all required fields (marked with *).');
        return;
    }

    await API.addFertilizer({
        name, type, brand,
        packWeight: Number(packWeight),
        packUnit,
        price,
        stock: Number(stock),
        image: resolveProductImage(imageInput),
        location: document.getElementById('fertLocation')?.value.trim() || ''
    });
    await fetchFertilizers();
    renderFertilizers();

    ['fertName','fertType','fertBrand','fertPackWeight','fertPrice','fertStock','fertLocation'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('fertPackUnit').value = 'kg';
    clearImagePreview('fertImage', 'fertImagePreview');
    const fertUrlWrap = document.getElementById('fertImageUrlWrap');
    if (fertUrlWrap) fertUrlWrap.style.display = 'none';

    const form = document.getElementById('fertForm');
    if (form && !form.classList.contains('hidden-form')) form.classList.add('hidden-form');
    alert('Fertilizer listed successfully!');
}


function renderFertilizers() {
    const grid = document.getElementById('fertGrid');
    if (!grid) return;

    const fertilizers = loadFertilizers();
    grid.innerHTML = '';

    fertilizers.forEach(item => {
        const card = document.createElement('div');
        card.className = 'product-card fert-item';
        card.dataset.search = buildProductSearchText(item);
        const aliasHint = getProductAliasHint(item.name);
        const qtyId = `fertQty_${item.id}`;
        const qtyLabelId = `fertQtyLabel_${item.id}`;
        const qtyWrapId = `fertImgQty_${item.id}`;
        const totalId = `fertTotal_${item.id}`;
        const stock = item.stock !== undefined ? Number(item.stock) : null;
        const isSoldOut = stock !== null && stock <= 0;
        const packLabel = item.packWeight ? `${item.packWeight}${item.packUnit || 'kg'}/pack` : '';

        card.innerHTML = `
            <div class="product-img-wrap${isSoldOut ? ' sold-out-wrap' : ''}">
                <img src="${resolveProductImage(item.image)}" class="product-img" alt="${item.name}" loading="lazy" onerror="this.src='image/seeds.jpg'">
                ${isSoldOut ? '<div class="sold-out-badge"><span>SOLD OUT</span></div>' : ''}
                ${stock !== null && !isSoldOut ? `<span class="stock-badge">${stock} left</span>` : ''}
                ${canBuyProducts() && !isSoldOut ? `
                <div id="${qtyWrapId}" class="img-qty img-qty-collapsed">
                    <button class="img-qty-launch" onclick="toggleCardImageQty('fert', '${item.id}', event)">+</button>
                    <div class="img-qty-controls">
                        <button class="img-qty-btn" onclick="changeCardImageQty('fert', '${item.id}', -1, event)">-</button>
                        <span id="${qtyLabelId}" class="img-qty-count">0</span>
                        <button class="img-qty-btn" onclick="changeCardImageQty('fert', '${item.id}', 1, event)">+</button>
                    </div>
                    <input id="${qtyId}" type="hidden" value="0">
                </div>` : ''}
            </div>
            <span class="prod-name">${item.name}</span>
            ${aliasHint ? `<small class="product-aliases">${aliasHint}</small>` : ''}
            <span class="prod-price">₹${item.price}${packLabel ? `<small> / ${packLabel}</small>` : ''}</span>
            <small>${item.type} | ${item.brand}</small>
            <p id="${totalId}" class="details-total-price card-inline-total"><strong>Total:</strong> ₹0.00</p>
            ${item.location ? `<small style="color:#1976d2;"><i class="fa-solid fa-location-dot"></i> ${item.location}</small>` : ''}
            ${isSoldOut
                ? `<button class="verify-btn card-action-btn sold-out-btn" disabled>Sold Out</button>`
                : canBuyProducts()
                    ? `<button class="verify-btn card-action-btn card-action-btn-blue" onclick="addFertilizerToCart('${item.id}')">Add</button>`
                    : `<button class="verify-btn card-action-btn" disabled>Users Only</button>`
            }
        `;

        grid.appendChild(card);
    });
}


function toggleCardImageQty(prefix, itemId, event) {
    if (event) event.stopPropagation();
    const wrap = document.getElementById(`${prefix}ImgQty_${itemId}`);
    if (!wrap) return;
    wrap.classList.remove('img-qty-collapsed');

    const qtyInput = document.getElementById(`${prefix}Qty_${itemId}`);
    const qtyLabel = document.getElementById(`${prefix}QtyLabel_${itemId}`);
    if (!qtyInput || !qtyLabel) return;

    const currentQty = Number(qtyInput.value || 0);
    if (currentQty > 0) return;

    qtyInput.value = '1';
    qtyLabel.textContent = '1';

    if (prefix === 'fert') {
        const totalDisplay = document.getElementById(`fertTotal_${itemId}`);
        const fertilizers = loadFertilizers();
        const item = fertilizers.find(fert => fert.id === itemId);
        if (totalDisplay && item) {
            totalDisplay.innerHTML = `<strong>Total:</strong> ₹${formatTo2f(Number(item.price || 0))}`;
        }
    }

    if (prefix === 'feed') {
        const totalDisplay = document.getElementById(`feedTotal_${itemId}`);
        const feeds = loadCattleFeeds();
        const item = feeds.find(feed => feed.id === itemId);
        if (totalDisplay && item) {
            totalDisplay.innerHTML = `<strong>Total:</strong> ₹${formatTo2f(Number(item.price || 0))}`;
        }
    }
}

function changeCardImageQty(prefix, itemId, delta, event) {
    if (event) event.stopPropagation();

    const wrap = document.getElementById(`${prefix}ImgQty_${itemId}`);
    if (wrap && delta > 0) wrap.classList.remove('img-qty-collapsed');

    const qtyInput = document.getElementById(`${prefix}Qty_${itemId}`);
    const qtyLabel = document.getElementById(`${prefix}QtyLabel_${itemId}`);
    if (!qtyInput || !qtyLabel) return;

    const currentQty = Number(qtyInput.value || 0);
    let updatedQty = Math.max(0, currentQty + delta);
    
    // Check stock limit for market products
    if (prefix === 'mk') {
        const products = loadMarketProducts();
        const product = products.find(p => p.id === itemId);
        if (product && product.stock !== undefined) {
            updatedQty = Math.min(updatedQty, product.stock);
            if (updatedQty > product.stock && delta > 0) {
                // Silently cap at max stock, no alert needed on each click
            }
        }
    }
    
    qtyInput.value = String(updatedQty);
    qtyLabel.textContent = String(updatedQty);

    if (wrap) {
        if (updatedQty === 0) {
            wrap.classList.add('img-qty-collapsed');
        } else {
            wrap.classList.remove('img-qty-collapsed');
        }
    }

    if (prefix === 'fert') {
        const totalDisplay = document.getElementById(`fertTotal_${itemId}`);
        const fertilizers = loadFertilizers();
        const item = fertilizers.find(fert => fert.id === itemId);
        if (totalDisplay && item) {
            const totalPrice = updatedQty * Number(item.price || 0);
            totalDisplay.innerHTML = `<strong>Total:</strong> ₹${formatTo2f(totalPrice)}`;
        }
    }

    if (prefix === 'feed') {
        const totalDisplay = document.getElementById(`feedTotal_${itemId}`);
        const feeds = loadCattleFeeds();
        const item = feeds.find(feed => feed.id === itemId);
        if (totalDisplay && item) {
            const totalPrice = updatedQty * Number(item.price || 0);
            totalDisplay.innerHTML = `<strong>Total:</strong> ₹${formatTo2f(totalPrice)}`;
        }
    }
}

function addFertilizerToCart(itemId) {
    if (!canBuyProducts()) {
        alert('Only users can buy fertilizers.');
        return;
    }
    const fertilizers = loadFertilizers();
    const item = fertilizers.find(fert => fert.id === itemId);
    if (!item) {
        alert('Fertilizer not found.');
        return;
    }
    const qtyInput = document.getElementById(`fertQty_${itemId}`);
    const qty = Number(qtyInput?.value || 0);
    if (qty <= 0) {
        alert('Tap + on the product image to select quantity.');
        return;
    }
    const totalPrice = qty * Number(item.price);

    addToCart({
        id: item.id,
        source: 'fertilizer',
        name: item.name,
        image: resolveProductImage(item.image),
        qty: qty,
        qtyLabel: `${qty} unit(s)`,
        unitPrice: item.price,
        totalPrice: totalPrice
    });
}

// ===== HOME PAGE: LIVE CROP RATES =====
// ===== STANDARD CROP RATES (MSP + Market, per quintal) =====
const STANDARD_CROP_RATES = [
    { name: 'Paddy (Common)',         category: 'Cereals',     price: 2300,   unit: 'Quintal', icon: '🌾' },
    { name: 'Paddy (Grade A)',         category: 'Cereals',     price: 2320,   unit: 'Quintal', icon: '🌾' },
    { name: 'Wheat',                   category: 'Cereals',     price: 2275,   unit: 'Quintal', icon: '🌾' },
    { name: 'Maize',                   category: 'Cereals',     price: 2090,   unit: 'Quintal', icon: '🌽' },
    { name: 'Jowar (Hybrid)',          category: 'Cereals',     price: 3371,   unit: 'Quintal', icon: '🌾' },
    { name: 'Jowar (Maldandi)',        category: 'Cereals',     price: 3421,   unit: 'Quintal', icon: '🌾' },
    { name: 'Bajra',                   category: 'Cereals',     price: 2625,   unit: 'Quintal', icon: '🌾' },
    { name: 'Barley',                  category: 'Cereals',     price: 1735,   unit: 'Quintal', icon: '🌾' },
    { name: 'Ragi',                    category: 'Cereals',     price: 4290,   unit: 'Quintal', icon: '🌾' },
    { name: 'Tur / Arhar Dal',         category: 'Pulses',      price: 7550,   unit: 'Quintal', icon: '🫘' },
    { name: 'Moong (Green Gram)',      category: 'Pulses',      price: 8682,   unit: 'Quintal', icon: '🫘' },
    { name: 'Urad (Black Gram)',       category: 'Pulses',      price: 7400,   unit: 'Quintal', icon: '🫘' },
    { name: 'Masur (Lentil)',          category: 'Pulses',      price: 6425,   unit: 'Quintal', icon: '🫘' },
    { name: 'Gram (Chickpea)',         category: 'Pulses',      price: 5440,   unit: 'Quintal', icon: '🫘' },
    { name: 'Groundnut',               category: 'Oilseeds',    price: 6783,   unit: 'Quintal', icon: '🥜' },
    { name: 'Sunflower Seed',          category: 'Oilseeds',    price: 7280,   unit: 'Quintal', icon: '🌻' },
    { name: 'Soyabean (Yellow)',       category: 'Oilseeds',    price: 4892,   unit: 'Quintal', icon: '🌱' },
    { name: 'Sesame / Til',            category: 'Oilseeds',    price: 9267,   unit: 'Quintal', icon: '🌱' },
    { name: 'Rapeseed / Mustard',      category: 'Oilseeds',    price: 5950,   unit: 'Quintal', icon: '🌿' },
    { name: 'Safflower',               category: 'Oilseeds',    price: 5800,   unit: 'Quintal', icon: '🌼' },
    { name: 'Niger Seed',              category: 'Oilseeds',    price: 7734,   unit: 'Quintal', icon: '🌱' },
    { name: 'Cotton (Medium Staple)', category: 'Cash Crops',   price: 7121,   unit: 'Quintal', icon: '🪴' },
    { name: 'Cotton (Long Staple)',   category: 'Cash Crops',   price: 7521,   unit: 'Quintal', icon: '🪴' },
    { name: 'Sugarcane',               category: 'Cash Crops',  price: 3400,   unit: 'Quintal', icon: '🍬' },
    { name: 'Jute',                    category: 'Cash Crops',  price: 5050,   unit: 'Quintal', icon: '🪢' },
    { name: 'Copra (Milling)',         category: 'Cash Crops',  price: 11160,  unit: 'Quintal', icon: '🥥' },
    { name: 'Copra (Ball)',            category: 'Cash Crops',  price: 12000,  unit: 'Quintal', icon: '🥥' },
    { name: 'Tomato',                  category: 'Vegetables',  price: 1200,   unit: 'Quintal', icon: '🍅' },
    { name: 'Onion',                   category: 'Vegetables',  price: 800,    unit: 'Quintal', icon: '🧅' },
    { name: 'Potato',                  category: 'Vegetables',  price: 700,    unit: 'Quintal', icon: '🥔' },
    { name: 'Tapioca',                 category: 'Vegetables',  price: 900,    unit: 'Quintal', icon: '🥔' },
    { name: 'Brinjal',                 category: 'Vegetables',  price: 1100,   unit: 'Quintal', icon: '🍆' },
    { name: 'Cauliflower',             category: 'Vegetables',  price: 1500,   unit: 'Quintal', icon: '🥦' },
    { name: 'Cabbage',                 category: 'Vegetables',  price: 600,    unit: 'Quintal', icon: '🥬' },
    { name: 'Green Chilli',            category: 'Vegetables',  price: 3500,   unit: 'Quintal', icon: '🌶️' },
    { name: 'Banana',                  category: 'Fruits',      price: 2500,   unit: 'Quintal', icon: '🍌' },
    { name: 'Mango',                   category: 'Fruits',      price: 4000,   unit: 'Quintal', icon: '🥭' },
    { name: 'Coconut',                 category: 'Fruits',      price: 3200,   unit: 'Quintal', icon: '🥥' },
    { name: 'Turmeric',                category: 'Spices',      price: 15000,  unit: 'Quintal', icon: '🟡' },
    { name: 'Ginger',                  category: 'Spices',      price: 12000,  unit: 'Quintal', icon: '🫚' },
    { name: 'Pepper (Black)',          category: 'Spices',      price: 40000,  unit: 'Quintal', icon: '⚫' },
    { name: 'Cardamom',                category: 'Spices',      price: 120000, unit: 'Quintal', icon: '🌿' },
];

// Tamil aliases for search in crop rates panel
const CROP_TAMIL_ALIASES = {
    'Paddy (Common)': ['நெல்', 'சாதாரண நெல்', 'பச்சரிசி நெல்'],
    'Paddy (Grade A)': ['நெல்', 'உயர்தர நெல்'],
    'Wheat': ['கோதுமை'],
    'Maize': ['மக்காச்சோளம்', 'சோளம் மக்கா'],
    'Jowar (Hybrid)': ['சோளம்'],
    'Jowar (Maldandi)': ['சோளம்'],
    'Bajra': ['கம்பு'],
    'Barley': ['பார்லி'],
    'Ragi': ['ராகி', 'கேழ்வரகு'],
    'Tur / Arhar Dal': ['துவரம்', 'துவரை'],
    'Moong (Green Gram)': ['பாசிப்பருப்பு', 'பாசிப்பயறு'],
    'Urad (Black Gram)': ['உளுந்து'],
    'Masur (Lentil)': ['மசூர் பருப்பு'],
    'Gram (Chickpea)': ['கொண்டைக்கடலை'],
    'Groundnut': ['நிலக்கடலை'],
    'Sunflower Seed': ['சூரியகாந்தி விதை'],
    'Soyabean (Yellow)': ['சோயாபீன்'],
    'Sesame / Til': ['எள்'],
    'Rapeseed / Mustard': ['கடுகு'],
    'Safflower': ['குசும்பு'],
    'Niger Seed': ['உக்கிரி விதை'],
    'Cotton (Medium Staple)': ['பருத்தி'],
    'Cotton (Long Staple)': ['பருத்தி'],
    'Sugarcane': ['கரும்பு'],
    'Jute': ['சணல்'],
    'Copra (Milling)': ['உலர் தேங்காய்', 'கோப்ரா'],
    'Copra (Ball)': ['உலர் தேங்காய்', 'கோப்ரா'],
    'Tomato': ['தக்காளி'],
    'Onion': ['வெங்காயம்'],
    'Potato': ['உருளைக்கிழங்கு'],
    'Tapioca': ['மரவள்ளிக்கிழங்கு'],
    'Brinjal': ['கத்தரிக்காய்'],
    'Cauliflower': ['பூக்கோசு'],
    'Cabbage': ['முட்டைக்கோசு'],
    'Green Chilli': ['பச்சை மிளகாய்'],
    'Banana': ['வாழை', 'வாழைப்பழம்'],
    'Mango': ['மாம்பழம்'],
    'Coconut': ['தேங்காய்'],
    'Turmeric': ['மஞ்சள்'],
    'Ginger': ['இஞ்சி'],
    'Pepper (Black)': ['மிளகு'],
    'Cardamom': ['ஏலக்காய்']
};

// Tanglish aliases and common spellings/typos
const CROP_TANGLISH_ALIASES = {
    'Paddy (Common)': ['nel', 'nellu', 'nel arisi', 'paddy'],
    'Paddy (Grade A)': ['nel', 'nellu', 'high grade nel'],
    'Wheat': ['kothumai', 'godhumai'],
    'Maize': ['makkacholam', 'maka cholam', 'cholam makka'],
    'Jowar (Hybrid)': ['cholam', 'solam'],
    'Jowar (Maldandi)': ['cholam', 'solam'],
    'Bajra': ['kambu'],
    'Barley': ['barli'],
    'Ragi': ['ragi', 'kelvaragu', 'kezhvaragu'],
    'Tur / Arhar Dal': ['thuvaram', 'thuvarai', 'toor dal'],
    'Moong (Green Gram)': ['pasi payaru', 'pasi paruppu', 'moong'],
    'Urad (Black Gram)': ['ulundhu', 'ulunthu'],
    'Masur (Lentil)': ['masoor', 'masur paruppu'],
    'Gram (Chickpea)': ['kondakadalai', 'konda kadalai', 'channa'],
    'Groundnut': ['nilakadalai', 'verkadalai', 'ground nut'],
    'Sunflower Seed': ['suriyakanti vithai', 'surya kanthi vithai', 'suryai kanthi vethi', 'sun flower seed'],
    'Soyabean (Yellow)': ['soya bean', 'soyabean'],
    'Sesame / Til': ['ellu', 'til'],
    'Rapeseed / Mustard': ['kadugu', 'mustard'],
    'Safflower': ['kusumbu', 'kusumbhu'],
    'Niger Seed': ['niger vithai'],
    'Cotton (Medium Staple)': ['paruthi', 'cotton'],
    'Cotton (Long Staple)': ['paruthi', 'cotton'],
    'Sugarcane': ['karumbu'],
    'Jute': ['sanal'],
    'Copra (Milling)': ['copra', 'ular thengai', 'kopra'],
    'Copra (Ball)': ['copra', 'ular thengai', 'kopra'],
    'Tomato': ['thakkali', 'thakali'],
    'Onion': ['vengayam', 'venkayam'],
    'Potato': ['urulai kizhangu', 'urulaikilangu', 'potato'],
    'Tapioca': ['maravalli kizhangu', 'maravallikilangu', 'kuchi kizhangu', 'tapioca'],
    'Brinjal': ['katharikai', 'kathirikkai'],
    'Cauliflower': ['poo kosu', 'pookosu'],
    'Cabbage': ['muttai kosu', 'mootaikose'],
    'Green Chilli': ['pachai milagai', 'green milagai'],
    'Banana': ['vazhai', 'vazhaipazham'],
    'Mango': ['maambazham', 'mampazham'],
    'Coconut': ['thengai', 'coconut'],
    'Turmeric': ['manjal'],
    'Ginger': ['inji'],
    'Pepper (Black)': ['milagu', 'black pepper'],
    'Cardamom': ['elakkai', 'yelakkai']
};

function normalizeSearchText(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\u0B80-\u0BFF]+/g, ' ')
        .trim();
}

function findDefaultCropRateByName(name) {
    const normalized = normalizeSearchText(name);
    return STANDARD_CROP_RATES.find(item => {
        const candidates = [
            item.name,
            item.name.replace(/\s*\(.*?\)/g, ''),
            item.name.replace(/\s*\/.*$/g, '')
        ];
        return candidates.some(candidate => {
            const value = normalizeSearchText(candidate);
            return value && (value === normalized || value.includes(normalized) || normalized.includes(value));
        });
    }) || null;
}

function getCropCatalogRecordByName(name) {
    const normalized = normalizeSearchText(name);
    return loadCropCatalog().find(item => {
        const candidates = [item.englishName, item.tamilTranslit];
        return candidates.some(candidate => {
            const value = normalizeSearchText(candidate);
            return value && (value === normalized || value.includes(normalized) || normalized.includes(value));
        });
    }) || null;
}

function getCatalogCropEntries(options = {}) {
    const { onlyWithRate = false } = options;

    if (!loadCropCatalog().length) {
        const fallbackEntries = STANDARD_CROP_RATES.map(item => ({
            name: item.name,
            nameEn: item.name,
            nameTa: item.name,
            tamilTranslit: '',
            category: item.category,
            price: Number(item.price || 0),
            unit: item.unit || 'Quintal',
            icon: item.icon || '🌾'
        }));
        return onlyWithRate ? fallbackEntries.filter(item => item.price > 0) : fallbackEntries;
    }

    const entries = loadCropCatalog().map(item => {
        const defaultRate = findDefaultCropRateByName(item.englishName);
        return {
            name: item.englishName,
            nameEn: item.englishName,
            nameTa: item.tamilTranslit || item.englishName,
            tamilTranslit: item.tamilTranslit || '',
            category: item.category || defaultRate?.category || 'Crop',
            price: Number(item.defaultRate || defaultRate?.price || 0),
            unit: item.unit || defaultRate?.unit || 'Quintal',
            icon: item.icon || defaultRate?.icon || '🌾'
        };
    });

    return onlyWithRate ? entries.filter(item => item.price > 0) : entries;
}

function getTamilAliasesByName(name) {
    const key = Object.keys(CROP_TAMIL_ALIASES).find(k => {
        const a = k.toLowerCase();
        const b = String(name || '').toLowerCase();
        return a === b || a.includes(b) || b.includes(a);
    });
    return key ? CROP_TAMIL_ALIASES[key] : [];
}

function getTanglishAliasesByName(name) {
    const key = Object.keys(CROP_TANGLISH_ALIASES).find(k => {
        const a = k.toLowerCase();
        const b = String(name || '').toLowerCase();
        return a === b || a.includes(b) || b.includes(a);
    });
    return key ? CROP_TANGLISH_ALIASES[key] : [];
}

function cropMatchesQuery(cropLike, query) {
    if (!query) return true;
    const tamilAliases = cropLike.tamil || getTamilAliasesByName(cropLike.name);
    const tanglishAliases = cropLike.tanglish || getTanglishAliasesByName(cropLike.name);
    const normalizedQuery = normalizeSearchText(query);
    const haystack = [
        cropLike.name || '',
        cropLike.category || '',
        ...(Array.isArray(tamilAliases) ? tamilAliases : []),
        ...(Array.isArray(tanglishAliases) ? tanglishAliases : [])
    ];

    return haystack.some(item => normalizeSearchText(item).includes(normalizedQuery));
}

function getCropAliasHint(name) {
    const tamil = getTamilAliasesByName(name).slice(0, 2);
    const tanglish = getTanglishAliasesByName(name).slice(0, 3);
    const parts = [];

    if (tamil.length) {
        parts.push(`TA: ${tamil.join(', ')}`);
    }
    if (tanglish.length) {
        parts.push(`TG: ${tanglish.join(', ')}`);
    }

    return parts.join(' | ');
}

function getProductAliasHint(name) {
    const tamil = getTamilAliasesByName(name).slice(0, 2);
    const tanglish = getTanglishAliasesByName(name).slice(0, 3);
    const hints = [];
    if (tamil.length) hints.push(`TA: ${tamil.join(', ')}`);
    if (tanglish.length) hints.push(`TG: ${tanglish.join(', ')}`);
    return hints.join(' | ');
}

function buildProductSearchText(item, extraFields = []) {
    const tamil = getTamilAliasesByName(item?.name || '');
    const tanglish = getTanglishAliasesByName(item?.name || '');
    return normalizeSearchText([
        item?.name || '',
        item?.info || '',
        item?.type || '',
        item?.brand || '',
        item?.category || '',
        item?.seller || '',
        item?.location || '',
        ...(Array.isArray(tamil) ? tamil : []),
        ...(Array.isArray(tanglish) ? tanglish : []),
        ...(Array.isArray(extraFields) ? extraFields : [])
    ].join(' '));
}

const DEFAULT_CROP_DETAIL_META = {
    about: 'This crop is currently listed based on today\'s available market rate data for your selected location. Rate changes depend on quality, arrivals, demand, and mandi activity.',
    quality: 'Standard market quality'
};

// ===== HOME PAGE: SINGLE ROTATING CROP RATE =====
let _cropRateRotateIdx = 0;
let _cropRateTimer = null;
let _homeLiveRate = null;
let _homeFeaturedCrop = null;
let _currentCropRateRows = [];

function getBrokerIdForCrop(rate) {
    if (!rate) return 'BRK-TN-001';
    const marketText = String(rate.market || '');
    const holderMatch = marketText.match(/F\d+/i);
    if (holderMatch) return holderMatch[0].toUpperCase();
    const loc = String(rate.location || 'TN').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'TN';
    return `BRK-${loc}-001`;
}

function openCropDetail(crop) {
    const panel = document.getElementById('cropDetailPanel');
    const overlay = document.getElementById('cropDetailOverlay');
    const content = document.getElementById('cropDetailContent');
    if (!panel || !overlay || !content || !crop) return;

    const meta = DEFAULT_CROP_DETAIL_META;
    const brokerId = getBrokerIdForCrop(crop);
    const brokerPhone = crop.brokerPhone || crop.holderPhone || 'Not available';
    const phoneHref = brokerPhone !== 'Not available'
        ? `<a href="tel:${String(brokerPhone).replace(/[^\d+]/g, '')}" class="crop-contact-link">${brokerPhone}</a>`
        : 'Not available';
    const quality = crop.quality || meta.quality;
    const rateLabel = Number(crop.price || 0) <= 0
        ? 'Rate update pending'
        : crop.unit === '100g'
        ? `₹${Number(crop.price || 0).toLocaleString('en-IN')} / 100g`
        : `₹${Number(crop.price || 0).toLocaleString('en-IN')} / குவின்டால்`;

    content.innerHTML = `
        <h2 class="crop-detail-title">${crop.nameTa || crop.name || 'பயிர்'}</h2>
        <div class="crop-detail-subtitle">${crop.nameEn || crop.name || ''}</div>
        <div class="crop-detail-about">${meta.about}</div>
        <div class="crop-detail-grid">
            <div class="crop-detail-stat">
                <label>Today Rate</label>
                <strong>${rateLabel}</strong>
            </div>
            <div class="crop-detail-stat">
                <label>Location</label>
                <strong>${crop.location || 'Tamil Nadu'}</strong>
            </div>
            <div class="crop-detail-stat">
                <label>Quality</label>
                <strong>${quality}</strong>
            </div>
            <div class="crop-detail-stat">
                <label>Updated Date</label>
                <strong>${crop.date || new Date().toLocaleDateString('en-IN')}</strong>
            </div>
            <div class="crop-detail-stat">
                <label>Market</label>
                <strong>${crop.market || 'Local Market'}</strong>
            </div>
            <div class="crop-detail-stat">
                <label>Broker ID</label>
                <strong>${brokerId}</strong>
            </div>
            <div class="crop-detail-stat">
                <label>Contact No</label>
                <strong>${phoneHref}</strong>
            </div>
        </div>
        <div class="crop-detail-broker">
            <div style="font-size:12px;color:#6d6d6d;margin-bottom:6px;">Suggested Broker Reference</div>
            <code>${brokerId}</code>
        </div>
    `;

    panel.classList.add('crop-detail-open');
    overlay.classList.add('cart-overlay-show');
}

function showHomeCropDetail(event) {
    if (event) event.stopPropagation();
    openCropDetail(_homeFeaturedCrop || _homeLiveRate);
}

function showCropRateDetailByIndex(index) {
    const crop = _currentCropRateRows[index];
    if (!crop) return;
    openCropDetail(crop);
}

function closeHomeCropDetail() {
    const panel = document.getElementById('cropDetailPanel');
    const overlay = document.getElementById('cropDetailOverlay');
    if (panel) panel.classList.remove('crop-detail-open');
    if (overlay) overlay.classList.remove('cart-overlay-show');
}

function getTamilNameForDisplay(englishName) {
    const aliases = getTamilAliasesByName(englishName);
    if (aliases.length) return aliases[0];

    const cropRecord = getCropCatalogRecordByName(englishName);
    if (cropRecord?.tamilTranslit) return cropRecord.tamilTranslit;

    const raw = String(englishName || '').toLowerCase();
    if (raw.includes('paddy') || raw.includes('dhan') || raw.includes('rice')) return 'நெல்';
    if (raw.includes('wheat')) return 'கோதுமை';
    if (raw.includes('maize') || raw.includes('corn')) return 'மக்காச்சோளம்';
    if (raw.includes('sunflower')) return 'சூரியகாந்தி விதை';
    if (raw.includes('potato')) return 'உருளைக்கிழங்கு';
    if (raw.includes('tapioca') || raw.includes('cassava')) return 'மரவள்ளிக்கிழங்கு';
    if (raw.includes('groundnut') || raw.includes('peanut')) return 'நிலக்கடலை';
    if (raw.includes('turmeric')) return 'மஞ்சள்';
    return englishName || 'பயிர்';
}

async function loadHomeLiveCropRate() {
    const location = (_currentProfile?.location || '').trim();

    try {
        const live = await API.getLiveCropRates(location || undefined);
        const top = live?.topRate;
        if (!top) throw new Error('No live top rate found');

        _homeLiveRate = {
            nameEn: top.commodity,
            nameTa: getTamilNameForDisplay(top.commodity),
            price: Number(top.modalPrice || 0),
            unit: top.unit || 'Quintal',
            location: live.location || location || 'Tamil Nadu',
            market: top.market || '',
            date: top.date || '',
            quality: top.quality || '',
            brokerPhone: top.brokerPhone || ''
        };
    } catch (err) {
        console.warn('Live crop rate unavailable, using fallback:', err.message);
        _homeLiveRate = null;
    }

    renderHomeCropRates();
}

function getHomeCropRotationItems() {
    const items = [];

    if (_homeLiveRate && (_homeLiveRate.nameEn || _homeLiveRate.nameTa)) {
        items.push({
            ..._homeLiveRate,
            isLive: true
        });
    }

    getCatalogCropEntries().forEach(c => {
        items.push({
            nameEn: c.nameEn,
            nameTa: getTamilNameForDisplay(c.nameEn),
            price: Number(c.price || 0),
            unit: c.unit || 'Quintal',
            location: _currentProfile?.location || 'Tamil Nadu',
            market: 'Standard Market Rate',
            date: new Date().toLocaleDateString('en-IN'),
            quality: DEFAULT_CROP_DETAIL_META.quality,
            icon: c.icon || '🌾',
            isLive: false
        });
    });

    if (!items.length) {
        _marketProducts.forEach(p => {
            items.push({
                nameEn: p.name,
                nameTa: getTamilNameForDisplay(p.name),
                price: Number(p.pricePer100g || 0),
                unit: '100g',
                location: p.location || _currentProfile?.location || 'Tamil Nadu',
                market: p.holderName || 'Nature Market',
                date: new Date().toLocaleDateString('en-IN'),
                quality: 'Current local market quality',
                isLive: false
            });
        });
    }

    const seen = new Set();
    return items.filter(item => {
        const key = String(item.nameEn || item.nameTa || '').trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function renderHomeCropRates() {
    const nameEl = document.getElementById('homeSingleCropName');
    const priceEl = document.getElementById('homeSingleCropPrice');
    if (!nameEl || !priceEl) return;

    const all = getHomeCropRotationItems();
    if (all.length === 0) return;

    _cropRateRotateIdx = _cropRateRotateIdx % all.length;
    const featured = all[_cropRateRotateIdx];
    _homeFeaturedCrop = { ...featured };
    nameEl.textContent = (featured.nameTa || getTamilNameForDisplay(featured.nameEn) || featured.nameEn || 'பயிர்').toUpperCase();

    if (featured.price > 0) {
        const priceText = featured.unit === '100g'
            ? `\u20b9${featured.price.toLocaleString('en-IN')} / 100g`
            : `\u20b9${featured.price.toLocaleString('en-IN')} / குவின்டால்`;
        const loc = featured.isLive && featured.location ? ` (${featured.location})` : '';
        priceEl.textContent = priceText + loc;
    } else {
        priceEl.textContent = 'Rate update pending';
    }

    clearTimeout(_cropRateTimer);
    _cropRateTimer = setTimeout(() => {
        _cropRateRotateIdx = (_cropRateRotateIdx + 1) % all.length;
        renderHomeCropRates();
    }, 5000);
}

function showCropRatesPanel() {
    const panel = document.getElementById('cropRatesPanel');
    const overlay = document.getElementById('cropRatesOverlay');
    if (!panel) return;

    const locEl = document.getElementById('cropRatesLocationFilter');
    if (locEl) {
        locEl.innerHTML = buildLocationOptions();
        if (_currentProfile && _currentProfile.location) {
            const opt = Array.from(locEl.options).find(o => o.value === _currentProfile.location);
            if (opt) locEl.value = _currentProfile.location;
        }
    }
    const searchEl = document.getElementById('cropRatesSearch');
    if (searchEl) searchEl.value = '';

    panel.classList.add('crop-rates-open');
    if (overlay) overlay.classList.add('cart-overlay-show');
    renderCropRatesPanel();
}

function closeCropRatesPanel() {
    const panel = document.getElementById('cropRatesPanel');
    const overlay = document.getElementById('cropRatesOverlay');
    if (panel) panel.classList.remove('crop-rates-open');
    if (overlay) overlay.classList.remove('cart-overlay-show');
}

function renderCropRatesPanel() {
    const list = document.getElementById('cropRatesList');
    const locEl = document.getElementById('cropRatesLocationFilter');
    const searchEl = document.getElementById('cropRatesSearch');
    if (!list) return;

    const query = searchEl ? searchEl.value.trim().toLowerCase() : '';
    const location = locEl ? locEl.value : '';
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    let rows = [];
    _currentCropRateRows = [];

    // Crop database entries from PDF + default rate map
    getCatalogCropEntries().forEach(c => {
        const cropLike = {
            name: c.nameEn,
            category: c.category,
            tamil: [...getTamilAliasesByName(c.nameEn), c.tamilTranslit].filter(Boolean),
            tanglish: [...getTanglishAliasesByName(c.nameEn), c.tamilTranslit].filter(Boolean)
        };
        if (!cropMatchesQuery(cropLike, query)) return;
        const aliasHint = getCropAliasHint(c.nameEn) || (c.tamilTranslit ? `PDF: ${c.tamilTranslit}` : '');
        const rowIndex = _currentCropRateRows.push({
            nameEn: c.nameEn,
            nameTa: getTamilNameForDisplay(c.nameEn),
            price: Number(c.price || 0),
            unit: c.unit || 'Quintal',
            location: location || _currentProfile?.location || 'Tamil Nadu',
            market: 'MSP / Standard Market',
            date: today,
            quality: DEFAULT_CROP_DETAIL_META.quality,
            brokerPhone: ''
        }) - 1;
        rows.push(`
            <div class="crop-rate-row" onclick="showCropRateDetailByIndex(${rowIndex})">
                <div class="crop-rate-icon">${c.icon}</div>
                <div class="crop-rate-info">
                    <strong>${c.nameEn}</strong>
                    <small class="crop-rate-category">${c.category} &middot; ${c.price > 0 ? 'Rate Available' : 'Rate Update Pending'}</small>
                    ${aliasHint ? `<small class="crop-rate-aliases">${aliasHint}</small>` : ''}
                </div>
                <div class="crop-rate-price">
                    <span>${c.price > 0 ? `\u20b9${c.price.toLocaleString('en-IN')}` : '--'}</span>
                    <small>${c.price > 0 ? `per ${c.unit}` : 'rate pending'}</small>
                </div>
            </div>`);
    });

    // Market products from DB (location-filtered)
    const dbProducts = location
        ? _marketProducts.filter(p => p.location === location)
        : _marketProducts;
    dbProducts.forEach(p => {
        if (!cropMatchesQuery(p, query)) return;
        const aliasHint = getCropAliasHint(p.name);
        const rowIndex = _currentCropRateRows.push({
            nameEn: p.name,
            nameTa: getTamilNameForDisplay(p.name),
            price: Number(p.pricePer100g || 0),
            unit: '100g',
            location: p.location || location || 'Tamil Nadu',
            market: p.holderName || 'Local Market',
            date: today,
            quality: 'Current local market quality',
            brokerPhone: p.holderPhone || ''
        }) - 1;
        rows.push(`
            <div class="crop-rate-row" onclick="showCropRateDetailByIndex(${rowIndex})">
                <img src="${p.image || 'image/seeds.jpg'}" class="crop-rate-img" onerror="this.src='image/seeds.jpg'" loading="lazy">
                <div class="crop-rate-info">
                    <strong>${p.name}</strong>
                    <small><i class="fa-solid fa-location-dot"></i> ${p.location || 'All'} &middot; Market Rate</small>
                    ${aliasHint ? `<small class="crop-rate-aliases">${aliasHint}</small>` : ''}
                </div>
                <div class="crop-rate-price">
                    <span>\u20b9${p.pricePer100g}</span>
                    <small>per 100g</small>
                </div>
            </div>`);
    });

    if (rows.length === 0) {
        list.innerHTML = `<div class="crop-rates-empty">
            <i class="fa-solid fa-seedling" style="font-size:40px;color:#ccc;"></i>
            <p>No crops found${query ? ' for &ldquo;' + query + '&rdquo;' : ''}.</p>
        </div>`;
        return;
    }

    list.innerHTML = `<div class="crop-rates-date"><i class="fa-solid fa-calendar-day"></i> Rates as of ${today} &nbsp;&middot;&nbsp; ${rows.length} crops listed</div>` + rows.join('');
}

function renderBestSellingProducts() {
    const container = document.getElementById('bestSellingList');
    if (!container) return;

    const products = loadMarketProducts();
    const sorted = [...products].sort((a, b) => {
        const ratingA = Number(getAverageRating(a).average) || 0;
        const ratingB = Number(getAverageRating(b).average) || 0;
        const scoreA = ratingA * 10 + Number(a.views || 0) * 0.5 + Number(a.buys || 0) * 2;
        const scoreB = ratingB * 10 + Number(b.views || 0) * 0.5 + Number(b.buys || 0) * 2;
        return scoreB - scoreA;
    });

    container.innerHTML = '';

    sorted.slice(0, 3).forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card market-product-card';
        card.onclick = () => openProductDetails(product.id);
        const ratingData = getAverageRating(product);

        card.innerHTML = `
            <img src="${resolveProductImage(product.image)}" class="product-img" alt="${product.name}" loading="lazy" onerror="this.src='image/seeds.jpg'">
            <span class="prod-name">${product.name}</span>
            <span class="prod-price">₹${product.pricePer100g}/100g</span>
            <small>⭐ ${ratingData.average}${ratingData.count ? ` (${ratingData.count} buys)` : ''}</small>
        `;

        container.appendChild(card);
    });
}

async function loadProfile() {
    const userId = auth?.userId || 'guest';
    try {
        const profile = await API.getProfile(userId);
        // Make sure profile has all required fields
        if (profile && typeof profile === 'object') {
            return {
                name: profile.name || auth?.name || auth?.userId || 'User',
                phone: profile.phone || '',
                location: profile.location || '',
                acres: profile.acres || '0',
                sales: profile.sales || '0',
                revenue: profile.revenue || '₹0',
                profileImage: profile.profileImage || '',
                ...profile
            };
        }
    } catch (e) {
        console.error('Error loading profile:', e);
    }
    // Return default profile with user info
    return {
        name: auth?.name || auth?.userId || 'User',
        phone: '',
        location: '',
        acres: '0',
        sales: '0',
        revenue: '₹0',
        profileImage: ''
    };
}

async function saveProfile(partial) {
    const userId = auth?.userId || 'guest';
    const current = await loadProfile();
    const updated = { ...current, ...partial };
    await API.saveProfile(userId, updated);
    _currentProfile = updated;
    applyProfileToUI(updated);
}

function applyProfileToUI(profile) {
    const nameEl = document.getElementById('profileName');
    const idEl = document.getElementById('profileId');
    const roleEl = document.getElementById('profileRole');
    const acresEl = document.getElementById('profileAcres');
    const salesEl = document.getElementById('profileSales');
    const revenueEl = document.getElementById('profileRevenue');
    const acresLabel = document.getElementById('profileAcresLabel');
    const salesLabel = document.getElementById('profileSalesLabel');
    const revenueLabel = document.getElementById('profileRevenueLabel');
    const phoneEl = document.getElementById('profilePhone');
    const locationEl = document.getElementById('profileLocation');
    const userBlock = document.getElementById('userProfileBlock');
    const sellerBlock = document.getElementById('sellerProfileBlock');
    const adminBlock = document.getElementById('adminProfileBlock');
    const userViewed = document.getElementById('userViewedCount');
    const userPurchases = document.getElementById('userPurchaseCount');
    const sellerListings = document.getElementById('sellerListingCount');
    const sellerOrders = document.getElementById('sellerOrderCount');
    const sellerAvg = document.getElementById('sellerAvgRating');
    const adminListings = document.getElementById('adminListingCount');
    const adminFerts = document.getElementById('adminFertCount');
    const adminUserCount = document.getElementById('adminUserCount');

    if (nameEl) nameEl.textContent = profile.name || 'User';
    if (idEl) idEl.textContent = `ID: ${auth?.userId || '-'}`;

    // Profile image
    const avatarImg = document.getElementById('profileAvatarImg');
    const avatarIcon = document.getElementById('profileAvatarIcon');
    if (avatarImg && avatarIcon) {
        if (profile.profileImage) {
            avatarImg.src = profile.profileImage;
            avatarImg.style.display = 'block';
            avatarIcon.style.display = 'none';
        } else {
            avatarImg.style.display = 'none';
            avatarIcon.style.display = '';
        }
    }
    // Header profile image
    const headerImg = document.getElementById('headerProfileImg');
    const headerIcon = document.getElementById('headerProfileIcon');
    if (headerImg && headerIcon) {
        if (profile.profileImage) {
            headerImg.src = profile.profileImage;
            headerImg.style.display = 'block';
            headerIcon.style.display = 'none';
        } else {
            headerImg.style.display = 'none';
            headerIcon.style.display = '';
        }
    }

    if (roleEl) {
        const roleLabel = currentRole === 'seller' ? '🌾 Product Seller' : currentRole === 'admin' ? '🛡 Admin' : '👤 Buyer';
        roleEl.textContent = roleLabel;
    }
    if (acresEl) acresEl.textContent = profile.acres || '0';
    if (salesEl) salesEl.textContent = profile.sales || '0';
    if (revenueEl) revenueEl.textContent = profile.revenue || '₹0';
        if (acresLabel) acresLabel.textContent = currentRole === 'user' ? 'Acres' : 'Stock';
        if (salesLabel) salesLabel.textContent = currentRole === 'seller' ? 'Orders' : 'Sales';
        if (revenueLabel) revenueLabel.textContent = currentRole === 'user' ? 'Spending' : 'Revenue';
    if (phoneEl) phoneEl.textContent = profile.phone || '-';
    if (locationEl) locationEl.textContent = profile.location || '-';

    if (userBlock) userBlock.style.display = currentRole === 'user' ? 'block' : 'none';
    if (sellerBlock) sellerBlock.style.display = currentRole === 'seller' ? 'block' : 'none';
    if (adminBlock) adminBlock.style.display = currentRole === 'admin' ? 'block' : 'none';

    if (currentRole === 'user') {
        const viewedCount = Object.keys(sessionStorage).filter(key => key.startsWith('viewed_')).length;
        if (userViewed) userViewed.textContent = String(viewedCount);
        if (userPurchases) userPurchases.textContent = profile.sales || '0';
    }

    if (currentRole === 'seller') {
        const products = loadMarketProducts();
        const owned = products.filter(product => getHolderId(product) === currentUserId);
        const totalOrders = owned.reduce((sum, product) => sum + Number(product.buys || 0), 0);
        const ratingTotals = owned.reduce(
            (sum, product) => sum + (Number(getAverageRating(product).average) || 0),
            0
        );
        const avgRating = owned.length ? (ratingTotals / owned.length).toFixed(1) : '0';

        if (sellerListings) sellerListings.textContent = String(owned.length);
        if (sellerOrders) sellerOrders.textContent = String(totalOrders);
        if (sellerAvg) sellerAvg.textContent = avgRating;
    }

    if (currentRole === 'admin') {
        if (adminListings) adminListings.textContent = String(loadMarketProducts().length);
        if (adminFerts) adminFerts.textContent = String(loadFertilizers().length);
        if (adminUserCount) {
            API.getUsers().then(users => {
                adminUserCount.textContent = String(users.length);
            }).catch(() => {});
        }
    }

    const nameInput = document.getElementById('profileNameInput');
    const phoneInput = document.getElementById('profilePhoneInput');
    const locationInput = document.getElementById('profileLocationInput');
    const acresInput = document.getElementById('profileAcresInput');

    if (nameInput) nameInput.value = profile.name || '';
    if (phoneInput) phoneInput.value = profile.phone || '';
    if (locationInput) locationInput.value = profile.location || '';
    if (acresInput) acresInput.value = profile.acres || '';
}

async function initProfile() {
    try {
        // Check if profileName element exists (we're on a page that has the profile)
        const profileNameEl = document.getElementById('profileName');
        if (!profileNameEl) {
            console.log('Profile elements not found on this page, skipping initProfile');
            return;
        }
        
        console.log('Loading profile data...');
        const profile = await loadProfile();
        if (!profile) {
            console.warn('No profile data returned from loadProfile()');
            return;
        }
        
        console.log('Profile data loaded:', profile);
        _currentProfile = profile || {};
        applyProfileToUI(profile);
        console.log('Profile UI updated');
        
        // Load live crop rates if available
        if (typeof loadHomeLiveCropRate === 'function') {
            try {
                await loadHomeLiveCropRate();
            } catch (e) {
                console.warn('Could not load crop rates:', e);
            }
        }
    } catch (e) {
        console.error('Error in initProfile:', e);
        throw e; // Re-throw so caller can handle
    }
}

async function saveProfileFromForm() {
    const nameInput     = document.getElementById('profileNameInput');
    const phoneInput    = document.getElementById('profilePhoneInput');
    const locationInput = document.getElementById('profileLocationInput');
    const acresInput    = document.getElementById('profileAcresInput');

    await saveProfile({
        name:     nameInput?.value.trim()     || 'User',
        phone:    phoneInput?.value.trim()    || '',
        location: locationInput?.value.trim() || '',
        acres:    acresInput?.value.trim()    || '0'
    });
    await loadHomeLiveCropRate();
    if (typeof showProfileToast === 'function') {
        showProfileToast('Profile updated ✓', 'success');
    } else {
        alert('Profile updated!');
    }
}

async function uploadProfileImage(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image.'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Image too large. Max 5MB.'); return; }

    const avatarImg = document.getElementById('profileAvatarImg');
    const avatarIcon = document.getElementById('profileAvatarIcon');

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const url = await API.uploadImage(e.target.result);
            await saveProfile({ profileImage: url });
            if (avatarImg) { avatarImg.src = url; avatarImg.style.display = 'block'; }
            if (avatarIcon) avatarIcon.style.display = 'none';
        } catch (err) {
            alert('Upload failed: ' + err.message);
        }
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
}

// Debug helper function - call from console if profile isn't working
window.debugProfile = function() {
    const checks = {
        currentActiveTab: _currentActiveTab,
        profileSectionExists: !!document.getElementById('profile'),
        profileSectionVisible: document.getElementById('profile')?.classList.contains('active'),
        profileNameElement: !!document.getElementById('profileName'),
        profilePhoneElement: !!document.getElementById('profilePhone'),
        profileLocationElement: !!document.getElementById('profileLocation'),
        currentProfile: _currentProfile,
        authData: JSON.parse(localStorage.getItem('ffAuth') || '{}'),
    };
    console.table(checks);
    return checks;
};

document.addEventListener('DOMContentLoaded', async () => {
    if (document.getElementById('loginForm')) {
        initLoginPage();
        return;
    }

    requireAuth();
    hydrateCartState();

    // Fetch all data from server in parallel
    try {
        await API.healthCheck();
        await Promise.all([
            fetchCrops(),
            fetchMarketProducts(),
            fetchFertilizers(),
            fetchCattleFeeds(),
            fetchCattleProducts(),
            fetchDoctors(),
            fetchCattleDiseases()
        ]);
    } catch (err) {
        console.error('Failed to load data:', err.message);
        alert(`Database loading failed. ${err.message}`);
    }

    setOwnerControlsVisibility();
    setFertilizerControlsVisibility();
    renderCartPanel();
    showCartNotification('');

    // Populate location filter dropdowns
    const locationOpts = buildLocationOptions();
    ['marketLocationFilter', 'fertLocationFilter', 'feedLocationFilter', 'cattleProductLocationFilter', 'doctorLocationFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = locationOpts;
    });

    renderMarketProducts();
    renderBestSellingProducts();
    renderFertilizers();
    loadProductDetailsPage();
    await initProfile();
    renderHomeCropRates();
    renderCattleFeeds();
    renderCattleProducts();
    setCattleControlsVisibility();
    renderDoctorsFromDB();
    showCattleDiseases();
});

// ===== CATTLE PAGE: SUB-TAB NAVIGATION =====

function showCattleSubTab(tabId, btn) {
    document.querySelectorAll('.cattle-sub').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.cattle-tab').forEach(b => b.classList.remove('active'));
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');
    if (btn) btn.classList.add('active');
}

// ===== CATTLE PAGE: DOCTOR CONSULT =====

function startDoctorConsult(doctorName, type) {
    const method = type === 'video' ? 'Video Call' : 'Chat';
    alert(`Starting ${method} with ${doctorName}...\n\nThis feature connects you to a live veterinary doctor. In a production app, this would open a ${method.toLowerCase()} interface.`);
}

// ===== CATTLE PAGE: AI DOCTOR (Chatbot) =====

let _aiKnowledgeBase = null;

async function loadAIKnowledge() {
    if (_aiKnowledgeBase) return _aiKnowledgeBase;
    _aiKnowledgeBase = await API.getAIKnowledge();
    return _aiKnowledgeBase;
}

function showTypingIndicator() {
    const chatBox = document.getElementById('aiChatBox');
    if (!chatBox) return;
    const existing = document.getElementById('aiTyping');
    if (existing) existing.remove();
    const typing = document.createElement('div');
    typing.id = 'aiTyping';
    typing.className = 'ai-message bot';
    typing.innerHTML = `
        <i class="fa-solid fa-robot ai-msg-icon"></i>
        <div class="ai-typing-dots"><span></span><span></span><span></span></div>
    `;
    chatBox.appendChild(typing);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function hideTypingIndicator() {
    const el = document.getElementById('aiTyping');
    if (el) el.remove();
}

function extractPointName(pointHtml) {
    const match = pointHtml.match(/<b>([^<:]+)/);
    return match ? match[1].trim() : '';
}

const AI_TOPIC_LABELS = {
    disease: 'diseases', feeding: 'feeding', maintenance: 'care & maintenance',
    breeding: 'breeding', vaccination: 'vaccination', milk: 'milk/egg production'
};

const AI_TOPIC_ICONS = {
    disease: 'fa-virus', feeding: 'fa-bowl-food', maintenance: 'fa-shield-heart',
    breeding: 'fa-heart', vaccination: 'fa-syringe', milk: 'fa-glass-water'
};

const AI_TOPIC_KEYWORDS = {
    disease: ['disease', 'sick', 'fever', 'symptom', 'infection', 'treatment', 'cure', 'medicine', 'swelling', 'bloat', 'diarrhea', 'cough', 'lameness', 'wound', 'pain', 'dying', 'dead', 'ill', 'pox', 'flu'],
    feeding: ['feed', 'food', 'diet', 'nutrition', 'fodder', 'hay', 'grain', 'silage', 'mineral', 'supplement', 'eating', 'hungry', 'weight', 'pellet', 'bran'],
    maintenance: ['care', 'maintain', 'housing', 'shelter', 'clean', 'hygiene', 'manage', 'routine', 'daily', 'shed', 'floor', 'shearing', 'litter'],
    breeding: ['breed', 'mating', 'pregnant', 'pregnancy', 'calving', 'heat', 'insemination', 'reproduction', 'fertility', 'birth', 'kidding', 'lambing'],
    vaccination: ['vaccine', 'vaccination', 'inject', 'deworm', 'schedule', 'booster', 'immunity', 'deworming'],
    milk: ['milk', 'milking', 'udder', 'lactation', 'yield', 'production', 'egg', 'laying', 'ghee', 'curd', 'cheese']
};

async function askAIDoctor(topic) {
    const cattleType = document.getElementById('aiCattleType')?.value || 'cow';
    addAIMessage('user', `Tell me about ${AI_TOPIC_LABELS[topic] || topic} for ${cattleType}`);
    showTypingIndicator();

    const kb = await loadAIKnowledge();
    hideTypingIndicator();

    const data = kb[topic]?.[cattleType];
    if (!data) {
        addAIMessage('bot', "I don't have information on that yet. Try another animal type.");
        return;
    }

    // Show sub-topic chips so user picks exactly what they want
    const chips = data.points.map((p, i) => {
        const name = extractPointName(p);
        if (!name) return '';
        return `<button class="ai-chip" onclick="showSpecificPoint('${topic}','${cattleType}',${i})">${name}</button>`;
    }).filter(Boolean).join('');

    addAIMessage('bot', `Here are <b>${AI_TOPIC_LABELS[topic]}</b> topics for <b>${cattleType}</b>. Pick one:<div class="ai-chips">${chips}</div>`);
}

async function showSpecificPoint(topic, animal, index) {
    const kb = await loadAIKnowledge();
    const data = kb[topic]?.[animal];
    if (!data) return;
    const point = data.points[index];
    if (!point) return;

    const name = extractPointName(point);
    addAIMessage('user', name || 'Tell me more');
    showTypingIndicator();

    setTimeout(() => {
        hideTypingIndicator();
        addAIMessage('bot', point);

        // Show related items as follow-up chips
        const others = data.points
            .map((p, i) => ({ name: extractPointName(p), i }))
            .filter(item => item.i !== index && item.name)
            .slice(0, 4);

        if (others.length) {
            const followChips = others.map(item =>
                `<button class="ai-chip" onclick="showSpecificPoint('${topic}','${animal}',${item.i})">${item.name}</button>`
            ).join('');
            addAIMessage('bot', `<span class="ai-followup-label">Related topics:</span><div class="ai-chips">${followChips}</div>`);
        }
    }, 500);
}

async function sendAIQuestion() {
    const input = document.getElementById('aiQuestion');
    const question = input?.value.trim();
    if (!question) return;

    const cattleType = document.getElementById('aiCattleType')?.value || 'cow';
    addAIMessage('user', question);
    input.value = '';
    showTypingIndicator();

    const kb = await loadAIKnowledge();
    const lowerQ = question.toLowerCase();
    const words = lowerQ.split(/\s+/).filter(w => w.length >= 3);

    // Score every individual point across all topics for this animal
    let bestMatch = null;
    let bestScore = 0;

    for (const [topic, animals] of Object.entries(kb)) {
        const data = animals[cattleType];
        if (!data) continue;

        for (let i = 0; i < data.points.length; i++) {
            const point = data.points[i];
            const name = extractPointName(point).toLowerCase();
            const plain = point.replace(/<[^>]+>/g, '').toLowerCase();

            let score = 0;
            for (const word of words) {
                if (name.includes(word)) score += 3;
                else if (plain.includes(word)) score += 1;
            }
            // Boost from topic keyword match
            const tKws = AI_TOPIC_KEYWORDS[topic] || [];
            for (const word of words) {
                if (tKws.includes(word)) score += 0.5;
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = { topic, index: i, point, data };
            }
        }
    }

    setTimeout(() => {
        hideTypingIndicator();

        if (bestMatch && bestScore >= 2) {
            addAIMessage('bot', bestMatch.point);

            // Related follow-ups
            const others = bestMatch.data.points
                .map((p, i) => ({ name: extractPointName(p), i }))
                .filter(item => item.i !== bestMatch.index && item.name)
                .slice(0, 3);

            if (others.length) {
                const chips = others.map(item =>
                    `<button class="ai-chip" onclick="showSpecificPoint('${bestMatch.topic}','${cattleType}',${item.i})">${item.name}</button>`
                ).join('');
                addAIMessage('bot', `<span class="ai-followup-label">You might also want to know:</span><div class="ai-chips">${chips}</div>`);
            }
        } else {
            // No specific match — offer topic chips
            const topicChips = Object.keys(AI_TOPIC_LABELS).map(t =>
                `<button class="ai-chip" onclick="askAIDoctor('${t}')"><i class="fa-solid ${AI_TOPIC_ICONS[t]}"></i> ${AI_TOPIC_LABELS[t]}</button>`
            ).join('');

            addAIMessage('bot', `I couldn't find a specific match for "<b>${question}</b>" for <b>${cattleType}</b>. Try a topic:<div class="ai-chips">${topicChips}</div><p class="ai-emergency-note"><i class="fa-solid fa-triangle-exclamation"></i> For emergencies, consult a licensed veterinarian.</p>`);
        }
    }, 600);
}

function clearAIChat() {
    const chatBox = document.getElementById('aiChatBox');
    if (!chatBox) return;
    chatBox.innerHTML = `
        <div class="ai-message bot">
            <i class="fa-solid fa-robot ai-msg-icon"></i>
            <div class="ai-msg-bubble">Hello! I'm your AI Cattle Doctor. Select a topic or describe your animal's symptoms below.</div>
        </div>
    `;
}

function addAIMessage(sender, content) {
    const chatBox = document.getElementById('aiChatBox');
    if (!chatBox) return;

    const icon = sender === 'bot' ? 'fa-robot' : 'fa-user';
    const msg = document.createElement('div');
    msg.className = `ai-message ${sender}`;
    msg.innerHTML = `
        <i class="fa-solid ${icon} ai-msg-icon"></i>
        <div class="ai-msg-bubble">${content}</div>
    `;
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// ===== CATTLE PAGE: FEEDS =====

const FEED_STORAGE_KEY = 'cattleFeeds';

function loadCattleFeeds() {
    return _cattleFeeds;
}

function saveCattleFeeds(feeds) {
    _cattleFeeds = feeds;
}

async function fetchCattleFeeds(location) {
    _cattleFeeds = await API.getCattleFeeds(location);
    return _cattleFeeds;
}

function renderCattleFeeds() {
    const grid = document.getElementById('feedGrid');
    if (!grid) return;

    const feeds = loadCattleFeeds();
    grid.innerHTML = '';

    feeds.forEach(item => {
        const card = document.createElement('div');
        card.className = 'product-card feed-card feed-item';
        card.dataset.search = buildProductSearchText(item, [item.weight]);
        const qtyId = `feedQty_${item.id}`;
        const qtyLabelId = `feedQtyLabel_${item.id}`;
        const qtyWrapId = `feedImgQty_${item.id}`;
        const totalId = `feedTotal_${item.id}`;
        const aliasHint = getProductAliasHint(item.name);
        const stock = item.stock !== undefined ? Number(item.stock) : null;
        const isSoldOut = stock !== null && stock <= 0;
        const weightLabel = `${item.weight}${item.weightUnit || 'kg'}/pack`;

        card.innerHTML = `
            <span class="feed-type-badge">${item.type}</span>
            <div class="product-img-wrap${isSoldOut ? ' sold-out-wrap' : ''}">
                <img src="${resolveProductImage(item.image)}" class="product-img" alt="${item.name}" loading="lazy" onerror="this.src='image/seeds.jpg'">
                ${isSoldOut ? '<div class="sold-out-badge"><span>SOLD OUT</span></div>' : ''}
                ${stock !== null && !isSoldOut ? `<span class="stock-badge">${stock} left</span>` : ''}
                ${canBuyProducts() && !isSoldOut ? `
                <div id="${qtyWrapId}" class="img-qty img-qty-collapsed">
                    <button class="img-qty-launch" onclick="toggleCardImageQty('feed', '${item.id}', event)">+</button>
                    <div class="img-qty-controls">
                        <button class="img-qty-btn" onclick="changeCardImageQty('feed', '${item.id}', -1, event)">-</button>
                        <span id="${qtyLabelId}" class="img-qty-count">0</span>
                        <button class="img-qty-btn" onclick="changeCardImageQty('feed', '${item.id}', 1, event)">+</button>
                    </div>
                    <input id="${qtyId}" type="hidden" value="0">
                </div>` : ''}
            </div>
            <span class="prod-name">${item.name}</span>
            ${aliasHint ? `<small class="product-aliases">${aliasHint}</small>` : ''}
            <span class="prod-price">₹${item.price} <small>${weightLabel}</small></span>
            <small>${item.brand}</small>
            <p id="${totalId}" class="details-total-price card-inline-total"><strong>Total:</strong> ₹0.00</p>
            ${item.location ? `<small style="color:#1976d2;"><i class="fa-solid fa-location-dot"></i> ${item.location}</small>` : ''}
            ${isSoldOut
                ? `<button class="verify-btn card-action-btn sold-out-btn" disabled>Sold Out</button>`
                : canBuyProducts()
                    ? `<button class="verify-btn card-action-btn card-action-btn-green" onclick="buyCattleFeed('${item.id}')">Add</button>`
                    : `<button class="verify-btn card-action-btn" disabled>Users Only</button>`
            }
        `;
        grid.appendChild(card);
    });
}


function filterCattleFeeds() {
    const input = normalizeSearchText(document.getElementById('feedSearch').value);
    const items = document.querySelectorAll('.feed-item');
    items.forEach(item => {
        const hay = item.dataset.search || normalizeSearchText(item.textContent || '');
        item.style.display = (!input || hay.includes(input)) ? '' : 'none';
    });
}

function toggleFeedForm() {
    const form = document.getElementById('feedForm');
    if (form) form.classList.toggle('hidden-form');
}

async function addCattleFeed() {
    if (!canAddProducts()) { alert('Only sellers or admins can add feeds.'); return; }

    const name      = document.getElementById('feedName')?.value.trim();
    const type      = document.getElementById('feedType')?.value;
    const brand     = document.getElementById('feedBrand')?.value.trim();
    const weight    = document.getElementById('feedWeight')?.value.trim();
    const weightUnit= document.getElementById('feedWeightUnit')?.value || 'kg';
    const price     = document.getElementById('feedPrice')?.value.trim();
    const stock     = document.getElementById('feedStock')?.value.trim();
    const image     = getImageValue('feedImage');

    if (!name || !brand || !weight || !price || !stock) { alert('Please fill all required fields.'); return; }

    await API.addCattleFeed({
        name, type, brand,
        weight, weightUnit,
        price, stock: Number(stock),
        location: document.getElementById('feedLocation')?.value.trim() || '',
        image: resolveProductImage(image)
    });
    await fetchCattleFeeds();
    renderCattleFeeds();

    ['feedName','feedBrand','feedWeight','feedPrice','feedStock','feedLocation'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('feedWeightUnit').value = 'kg';
    clearImagePreview('feedImage', 'feedImagePreview');
    const feedUrlWrap = document.getElementById('feedImageUrlWrap');
    if (feedUrlWrap) feedUrlWrap.style.display = 'none';
    toggleFeedForm();
    alert('Feed listed successfully!');
}


function buyCattleFeed(feedId) {
    if (!canBuyProducts()) { alert('Only users can buy.'); return; }
    const feeds = loadCattleFeeds();
    const item = feeds.find(f => f.id === feedId);
    if (!item) { alert('Feed not found.'); return; }
    const qtyInput = document.getElementById(`feedQty_${feedId}`);
    const qty = Math.max(0, Number(qtyInput?.value || 0));
    if (qty <= 0) {
        alert('Tap + on the product image to select quantity.');
        return;
    }
    const price = Number(item.price || 0);

    addToCart({
        id: item.id,
        source: 'cattle-feed',
        name: item.name,
        image: resolveProductImage(item.image),
        qty,
        qtyLabel: `${qty} unit(s) (${item.weight} kg each)`,
        unitPrice: price,
        totalPrice: Number((qty * price).toFixed(2))
    });
}

// ===== CATTLE PAGE: CATTLE PRODUCTS (MILK, MEAT, EGGS) =====

const CATTLE_PRODUCT_KEY = 'cattleProducts';

function loadCattleProducts() {
    return _cattleProducts;
}

function saveCattleProducts(products) {
    _cattleProducts = products;
}

async function fetchCattleProducts(location) {
    _cattleProducts = await API.getCattleProducts(location);
    return _cattleProducts;
}

let currentCPCategory = 'all';

function renderCattleProducts() {
    const grid = document.getElementById('cattleProductGrid');
    if (!grid) return;

    const products = loadCattleProducts();
    grid.innerHTML = '';

    const filtered = currentCPCategory === 'all'
        ? products
        : products.filter(p => p.category === currentCPCategory);

    filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = 'product-card cattle-product-card cp-item';
        card.dataset.search = buildProductSearchText(item, [item.unit, item.phone]);
        const qtyId = `cpQty_${item.id}`;
        const qtyLabelId = `cpQtyLabel_${item.id}`;
        const qtyWrapId = `cpImgQty_${item.id}`;
        const aliasHint = getProductAliasHint(item.name);
        const stock = item.stock !== undefined ? Number(item.stock) : null;
        const isSoldOut = stock !== null && stock <= 0;
        const packLabel = item.packSize ? `${item.packSize}${item.packSizeUnit || ''}/pack` : '';

        card.innerHTML = `
            <span class="cp-badge">${item.category}</span>
            <div class="product-img-wrap${isSoldOut ? ' sold-out-wrap' : ''}">
                <img src="${resolveProductImage(item.image)}" class="product-img" alt="${item.name}" loading="lazy" onerror="this.src='image/seeds.jpg'">
                ${isSoldOut ? '<div class="sold-out-badge"><span>SOLD OUT</span></div>' : ''}
                ${stock !== null && !isSoldOut ? `<span class="stock-badge">${stock} left</span>` : ''}
                ${canBuyProducts() && !isSoldOut ? `
                <div id="${qtyWrapId}" class="img-qty img-qty-collapsed">
                    <button class="img-qty-launch" onclick="toggleCardImageQty('cp', '${item.id}', event)">+</button>
                    <div class="img-qty-controls">
                        <button class="img-qty-btn" onclick="changeCardImageQty('cp', '${item.id}', -1, event)">-</button>
                        <span id="${qtyLabelId}" class="img-qty-count">0</span>
                        <button class="img-qty-btn" onclick="changeCardImageQty('cp', '${item.id}', 1, event)">+</button>
                    </div>
                    <input id="${qtyId}" type="hidden" value="0">
                </div>` : ''}
            </div>
            <span class="prod-name">${item.name}</span>
            ${aliasHint ? `<small class="product-aliases">${aliasHint}</small>` : ''}
            <span class="prod-price">₹${item.price} <small>${packLabel || item.unit}</small></span>
            <small>${item.info}</small>
            <small style="color:#888;">Seller: ${item.seller}</small>
            ${item.location ? `<small style="color:#1976d2;"><i class="fa-solid fa-location-dot"></i> ${item.location}</small>` : ''}
            ${isSoldOut
                ? `<button class="verify-btn card-action-btn sold-out-btn" disabled>Sold Out</button>`
                : canBuyProducts()
                    ? `<button class="verify-btn card-action-btn card-action-btn-brown" onclick="buyCattleProduct('${item.id}')">Add</button>`
                    : `<button class="verify-btn card-action-btn" disabled>Users Only</button>`
            }
        `;
        grid.appendChild(card);
    });
}


function changeCattleProductQty(productId, delta) {
    const qtyInput = document.getElementById(`cpQty_${productId}`);
    if (!qtyInput) return;

    const currentQty = Number(qtyInput.value || 1);
    const updatedQty = Math.max(1, currentQty + delta);
    qtyInput.value = String(updatedQty);
}

function filterCattleProducts() {
    const input = normalizeSearchText(document.getElementById('cattleProductSearch').value);
    const items = document.querySelectorAll('.cp-item');
    items.forEach(item => {
        const hay = item.dataset.search || normalizeSearchText(item.textContent || '');
        item.style.display = (!input || hay.includes(input)) ? '' : 'none';
    });
}

function filterCattleProductsByCategory(category, btn) {
    currentCPCategory = category;
    document.querySelectorAll('.cp-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderCattleProducts();
}

function toggleCattleProductForm() {
    const form = document.getElementById('cattleProductForm');
    if (form) form.classList.toggle('hidden-form');
}

async function addCattleProduct() {
    if (!canAddProducts()) { alert('Only sellers or admins can list products.'); return; }

    const name      = document.getElementById('cpName')?.value.trim();
    const category  = document.getElementById('cpCategory')?.value;
    const info      = document.getElementById('cpInfo')?.value.trim();
    const seller    = document.getElementById('cpSeller')?.value.trim();
    const phone     = document.getElementById('cpPhone')?.value.trim();
    const packSize  = document.getElementById('cpPackSize')?.value.trim();
    const packSzUnit= document.getElementById('cpPackSizeUnit')?.value || 'L';
    const price     = document.getElementById('cpPrice')?.value.trim();
    const stock     = document.getElementById('cpStock')?.value.trim();
    const unit      = document.getElementById('cpUnit')?.value;
    const image     = getImageValue('cpImage');

    if (!name || !info || !seller || !phone || !price || !stock) { alert('Please fill all required fields.'); return; }

    await API.addCattleProduct({
        name, category, info, seller, phone,
        packSize: Number(packSize) || 1, packSizeUnit: packSzUnit,
        price, unit,
        stock: Number(stock),
        location: document.getElementById('cpLocation')?.value.trim() || '',
        image: resolveProductImage(image)
    });
    await fetchCattleProducts();
    renderCattleProducts();

    ['cpName','cpInfo','cpSeller','cpPhone','cpPackSize','cpPrice','cpStock','cpLocation'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    clearImagePreview('cpImage', 'cpImagePreview');
    const cpUrlWrap = document.getElementById('cpImageUrlWrap');
    if (cpUrlWrap) cpUrlWrap.style.display = 'none';
    toggleCattleProductForm();
    alert('Product listed successfully!');
}


function buyCattleProduct(productId) {
    if (!canBuyProducts()) { alert('Only users can buy.'); return; }
    const products = loadCattleProducts();
    const item = products.find(p => p.id === productId);
    if (!item) { alert('Product not found.'); return; }
    const qtyInput = document.getElementById(`cpQty_${productId}`);
    const qty = Math.max(0, Number(qtyInput?.value || 0));
    if (qty <= 0) {
        alert('Tap + on the product image to select quantity.');
        return;
    }
    const price = Number(item.price || 0);
    const unitText = String(item.unit || 'unit').replace(/^per\s+/i, '').trim();

    addToCart({
        id: item.id,
        source: 'cattle-product',
        name: item.name,
        image: resolveProductImage(item.image),
        qty,
        qtyLabel: `${qty} ${unitText}`,
        unitPrice: price,
        totalPrice: Number((qty * price).toFixed(2))
    });
}

function setCattleControlsVisibility() {
    const feedBtn = document.getElementById('feedAddButton');
    const cpBtn = document.getElementById('cattleProductAddBtn');
    if (feedBtn) feedBtn.style.display = canAddProducts() ? 'inline-flex' : 'none';
    if (cpBtn) cpBtn.style.display = canAddProducts() ? 'inline-flex' : 'none';
}

// ===== GLOBAL DATA: DOCTORS & CATTLE DISEASES (from server) =====

async function fetchDoctors(location) {
    _doctors = await API.getDoctors(location);
    return _doctors;
}

async function fetchCattleDiseases() {
    _cattleDiseases = await API.getCattleDiseases();
    return _cattleDiseases;
}

function renderDoctorsFromDB() {
    const container = document.getElementById('doctorListFromDB');
    if (!container || !_doctors.length) return;

    container.innerHTML = '';
    _doctors.forEach(doc => {
        const availBadge = doc.available
            ? '<span style="color:green;font-weight:600;">● Available</span>'
            : '<span style="color:#999;">● Unavailable</span>';
        const card = document.createElement('div');
        card.className = 'doctor-db-card';
        card.innerHTML = `
            <img src="${doc.image}" class="doctor-db-img" alt="${doc.name}" loading="lazy" onerror="this.src='image/seeds.jpg'">
            <div class="doctor-db-info">
                <h4>${doc.name}</h4>
                <p><strong>${doc.specialization}</strong> · ${doc.experience}</p>
                <p>${doc.qualification}</p>
                <p><i class="fa-solid fa-hospital"></i> ${doc.hospital}</p>
                <p><i class="fa-solid fa-location-dot" style="color:#1976d2;"></i> ${doc.location || 'N/A'}</p>
                <p>⭐ ${doc.rating} · ${doc.totalConsultations} consultations</p>
                <p>Fee: ₹${doc.consultationFee} ${availBadge}</p>
                <p><small>Services: ${doc.services.join(', ')}</small></p>
                <div class="doctor-db-actions">
                    <button class="verify-btn" style="background:var(--card-green);" onclick="startDoctorConsult('${doc.name}', 'video')" ${doc.available ? '' : 'disabled'}>
                        <i class="fa-solid fa-video"></i> Video Call
                    </button>
                    <button class="verify-btn" style="background:var(--lab-blue);" onclick="startDoctorConsult('${doc.name}', 'chat')" ${doc.available ? '' : 'disabled'}>
                        <i class="fa-solid fa-comment-dots"></i> Chat
                    </button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function showCattleDiseases() {
    const animalType = document.getElementById('diseaseAnimalType')?.value || 'cow';
    const container = document.getElementById('diseaseListFromDB');
    if (!container) return;

    const diseases = _cattleDiseases[animalType] || [];
    if (!diseases.length) {
        container.innerHTML = '<p>No disease data available for this animal.</p>';
        return;
    }

    container.innerHTML = '';
    diseases.forEach(d => {
        const severityColor = d.severity === 'Critical' ? '#d32f2f' : d.severity === 'High' ? '#e65100' : d.severity === 'Medium' ? '#f9a825' : '#4caf50';
        const card = document.createElement('div');
        card.className = 'disease-db-card';
        card.innerHTML = `
            <div class="disease-db-header">
                <h4>${d.name}</h4>
                <span class="severity-badge" style="background:${severityColor};">${d.severity}</span>
            </div>
            <p><strong>Symptoms:</strong> ${d.symptoms}</p>
            <p><strong>Treatment:</strong> ${d.treatment}</p>
            <p><strong>Prevention:</strong> ${d.prevention}</p>
            <p><small><i class="fa-solid fa-calendar"></i> Common Season: ${d.commonSeason}</small></p>
        `;
        container.appendChild(card);
    });
}
