/**
 * profile.js — Complete Profile Page Module
 * Handles: My Transactions, Change Password, App Settings (Dark Mode),
 *           Land Records, live stats, menu navigation, and full UI.
 */

/* =====================================================================
   HOIST PANELS — move fixed overlays to <body> so position:fixed works
   (parent overflow/transform can block fixed positioning in some browsers)
===================================================================== */
function hoistProfilePanels() {
    const panelIds = ['panelTransactions','panelLandRecords','panelChangePass','panelSettings','profilePanelBackdrop'];
    panelIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.parentElement !== document.body) {
            document.body.appendChild(el);
        }
    });
}

/* =====================================================================
   DARK MODE
===================================================================== */
const DARK_MODE_KEY = 'ff_dark_mode';

function isDarkMode() {
    return localStorage.getItem(DARK_MODE_KEY) === '1';
}

function applyDarkMode(enabled) {
    document.body.classList.toggle('dark-mode', enabled);
    localStorage.setItem(DARK_MODE_KEY, enabled ? '1' : '0');
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) toggle.checked = enabled;
}

function initDarkMode() {
    applyDarkMode(isDarkMode());
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) {
        toggle.addEventListener('change', () => applyDarkMode(toggle.checked));
    }
}

/* =====================================================================
   PANEL SYSTEM — slide-in overlay panels for menu items
===================================================================== */
function openProfilePanel(id) {
    document.querySelectorAll('.profile-panel').forEach(p => p.classList.remove('open'));
    const panel = document.getElementById(id);
    if (panel) panel.classList.add('open');

    // Show backdrop
    const backdrop = document.getElementById('profilePanelBackdrop');
    if (backdrop) backdrop.classList.add('visible');

    // Render content lazily
    if (id === 'panelTransactions') renderTransactionPanel();
    if (id === 'panelLandRecords')   renderLandRecordsPanel();
    if (id === 'panelSettings')      renderSettingsPanel();
    if (id === 'panelChangePass')    renderChangePasswordPanel();
}

function closeProfilePanel() {
    document.querySelectorAll('.profile-panel').forEach(p => p.classList.remove('open'));
    const backdrop = document.getElementById('profilePanelBackdrop');
    if (backdrop) backdrop.classList.remove('visible');
}

/* =====================================================================
   MY TRANSACTIONS PANEL
===================================================================== */
async function renderTransactionPanel() {
    const body = document.getElementById('transactionBody');
    if (!body) return;
    body.innerHTML = '<div class="pp-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading orders…</div>';

    try {
        const auth   = JSON.parse(localStorage.getItem('ffAuth') || '{}');
        const userId = auth.userId || '';
        const role   = auth.role   || '';

        let allOrders = await API.getOrders();

        // Filter: buyers see their purchases; sellers see their sales; admin sees all
        let orders = allOrders;
        if (role === 'user') {
            orders = allOrders.filter(o => o.buyerUserId === userId || o.userId === userId);
        } else if (role === 'seller') {
            orders = allOrders.filter(o =>
                o.sellerUserId === userId ||
                o.holderId     === userId ||
                o.sellerId     === userId
            );
        }

        if (!orders.length) {
            body.innerHTML = `
                <div class="pp-empty">
                    <i class="fa-solid fa-receipt" style="font-size:36px;color:#ccc;margin-bottom:10px;"></i>
                    <p>No transactions found yet.</p>
                </div>`;
            return;
        }

        // Sort newest first
        orders = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Update live stats in the transaction panel header
        const totalSpend   = orders.filter(o => o.status === 'completed').reduce((s, o) => s + Number(o.totalPrice || 0), 0);
        const pendingCount = orders.filter(o => o.status === 'pending').length;

        const summaryEl = document.getElementById('txSummary');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="tx-stat"><i class="fa-solid fa-bag-shopping"></i><span>${orders.length}</span><small>Total</small></div>
                <div class="tx-stat tx-green"><i class="fa-solid fa-check-circle"></i><span>₹${totalSpend.toLocaleString('en-IN')}</span><small>${role === 'seller' ? 'Earned' : 'Spent'}</small></div>
                <div class="tx-stat tx-orange"><i class="fa-solid fa-hourglass-half"></i><span>${pendingCount}</span><small>Pending</small></div>
            `;
        }

        body.innerHTML = orders.map(o => {
            const statusColor = o.status === 'completed' ? '#43a047' : o.status === 'cancelled' ? '#e53935' : '#fb8c00';
            const statusIcon  = o.status === 'completed' ? 'fa-check-circle' : o.status === 'cancelled' ? 'fa-times-circle' : 'fa-hourglass-half';
            const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
            return `
            <div class="tx-card">
                <div class="tx-card-left">
                    <div class="tx-product">${o.productName || 'Product'}</div>
                    <div class="tx-meta">
                        <span><i class="fa-solid fa-weight-hanging"></i> ${o.qty || '?'} ${o.unit || 'units'}</span>
                        <span><i class="fa-regular fa-calendar"></i> ${date}</span>
                        <span>ID: ${String(o.id || o._id || '').slice(-6) || '—'}</span>
                    </div>
                </div>
                <div class="tx-card-right">
                    <div class="tx-amount">₹${Number(o.totalPrice || 0).toLocaleString('en-IN')}</div>
                    <div class="tx-status" style="color:${statusColor}">
                        <i class="fa-solid ${statusIcon}"></i> ${(o.status || 'pending')[0].toUpperCase() + (o.status || 'pending').slice(1)}
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch (err) {
        body.innerHTML = `<div class="pp-empty"><i class="fa-solid fa-triangle-exclamation" style="color:#e53935"></i> Failed to load: ${err.message}</div>`;
    }
}

/* =====================================================================
   LAND RECORDS PANEL
===================================================================== */
function renderLandRecordsPanel() {
    const body    = document.getElementById('landRecordsBody');
    if (!body) return;

    const auth     = JSON.parse(localStorage.getItem('ffAuth') || '{}');
    const profile  = _currentProfile || {};
    const acres    = parseFloat(profile.acres) || 0;
    const location = profile.location || '';

    body.innerHTML = `
        <div class="land-hero">
            <i class="fa-solid fa-map-location-dot"></i>
            <div>
                <div class="land-hero-val">${acres} Acres</div>
                <div class="land-hero-sub">Registered farmland</div>
            </div>
        </div>

        <div class="land-section-title"><i class="fa-solid fa-pencil"></i> Update Land Details</div>

        <div class="form-group">
            <label>FARM AREA (ACRES)</label>
            <input type="number" id="landAcresInput" class="market-input" min="0" step="0.5"
                   value="${acres}" placeholder="e.g. 4.5">
        </div>
        <div class="form-group">
            <label>VILLAGE / DISTRICT</label>
            <input type="text" id="landLocationInput" class="market-input"
                   value="${location}" placeholder="e.g. Coimbatore, Tamil Nadu">
        </div>
        <div class="form-group">
            <label>CROP TYPE (OPTIONAL)</label>
            <input type="text" id="landCropType" class="market-input"
                   value="${profile.cropType || ''}" placeholder="e.g. Paddy, Sugarcane">
        </div>
        <div class="form-group">
            <label>SOIL TYPE (OPTIONAL)</label>
            <select id="landSoilType" class="market-input">
                <option value="">Select soil type</option>
                ${['Alluvial','Black (Cotton)','Red','Laterite','Sandy','Clayey']
                  .map(s => `<option ${profile.soilType === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
        </div>
        <button class="verify-btn" onclick="saveLandRecords()" style="width:100%;margin-top:8px;">
            <i class="fa-solid fa-floppy-disk"></i> SAVE LAND RECORDS
        </button>

        <div class="land-info-box">
            <i class="fa-solid fa-circle-info"></i>
            Land records are stored locally and help personalise crop recommendations.
        </div>
    `;
}

async function saveLandRecords() {
    const acres    = document.getElementById('landAcresInput')?.value.trim() || '0';
    const location = document.getElementById('landLocationInput')?.value.trim() || '';
    const cropType = document.getElementById('landCropType')?.value.trim() || '';
    const soilType = document.getElementById('landSoilType')?.value || '';

    try {
        await saveProfile({ acres, location, cropType, soilType });
        showProfileToast('Land records saved ✓', 'success');
    } catch (err) {
        showProfileToast('Save failed: ' + err.message, 'error');
    }
}

/* =====================================================================
   APP SETTINGS PANEL
===================================================================== */
function renderSettingsPanel() {
    const body = document.getElementById('settingsBody');
    if (!body) return;

    const darkOn  = isDarkMode();
    const apiBase = typeof API !== 'undefined' ? API.getBaseUrl() : '';

    body.innerHTML = `
        <!-- Dark Mode -->
        <div class="settings-group">
            <div class="settings-group-title"><i class="fa-solid fa-moon"></i> Appearance</div>
            <div class="settings-row">
                <span>Dark Mode</span>
                <label class="pp-toggle">
                    <input type="checkbox" id="darkModeToggle" ${darkOn ? 'checked' : ''}
                           onchange="applyDarkMode(this.checked)">
                    <span class="pp-toggle-slider"></span>
                </label>
            </div>
        </div>

        <!-- Notifications placeholder -->
        <div class="settings-group">
            <div class="settings-group-title"><i class="fa-solid fa-bell"></i> Notifications</div>
            <div class="settings-row">
                <span>Order alerts</span>
                <label class="pp-toggle">
                    <input type="checkbox" id="notifOrders" ${localStorage.getItem('ff_notif_orders') !== '0' ? 'checked' : ''}
                           onchange="saveSetting('ff_notif_orders', this.checked ? '1' : '0')">
                    <span class="pp-toggle-slider"></span>
                </label>
            </div>
            <div class="settings-row">
                <span>Price alerts</span>
                <label class="pp-toggle">
                    <input type="checkbox" id="notifPrices" ${localStorage.getItem('ff_notif_prices') === '1' ? 'checked' : ''}
                           onchange="saveSetting('ff_notif_prices', this.checked ? '1' : '0')">
                    <span class="pp-toggle-slider"></span>
                </label>
            </div>
        </div>

        <!-- Backend / API config -->
        <div class="settings-group">
            <div class="settings-group-title"><i class="fa-solid fa-server"></i> Backend Connection</div>
            <div class="form-group" style="margin-bottom:8px;">
                <label style="font-size:11px;color:#888;">API URL (leave blank for auto)</label>
                <input type="url" id="settingsApiInput" class="market-input" style="font-size:12px;"
                       placeholder="http://192.168.x.x:3000" value="${apiBase}">
            </div>
            <div style="display:flex;gap:8px;">
                <button class="pp-settings-btn" onclick="saveSettingsApi()">
                    <i class="fa-solid fa-floppy-disk"></i> Save
                </button>
                <button class="pp-settings-btn" onclick="testSettingsApi()">
                    <i class="fa-solid fa-plug"></i> Test
                </button>
                <button class="pp-settings-btn pp-danger-btn" onclick="clearSettingsApi()">
                    <i class="fa-solid fa-rotate-left"></i> Reset
                </button>
            </div>
            <div id="settingsApiStatus" class="settings-api-status"></div>
        </div>

        <!-- Data & Privacy -->
        <div class="settings-group">
            <div class="settings-group-title"><i class="fa-solid fa-shield-halved"></i> Data & Privacy</div>
            <button class="pp-settings-btn pp-danger-btn" style="width:100%;margin-top:4px;"
                    onclick="clearLocalCache()">
                <i class="fa-solid fa-trash-can"></i> Clear Local Cache
            </button>
        </div>

        <!-- App info -->
        <div class="settings-app-info">
            <i class="fa-solid fa-seedling" style="color:var(--header-text);"></i>
            <strong>Farmers Friend</strong> v1.0.0
            <br><small style="color:#aaa;">Built with ♥ for farmers</small>
        </div>
    `;
}

function saveSetting(key, value) {
    localStorage.setItem(key, value);
}

async function saveSettingsApi() {
    const input  = document.getElementById('settingsApiInput');
    const status = document.getElementById('settingsApiStatus');
    const url    = (input?.value || '').trim().replace(/\/+$/, '');
    if (url && !/^https?:\/\//i.test(url)) {
        status.textContent = '⚠ Enter a valid URL (http:// or https://)';
        status.style.color = '#e53935';
        return;
    }
    API.setBaseUrl(url);
    status.textContent = url ? `✓ Saved: ${url}` : '✓ Using auto-detected backend';
    status.style.color = '#43a047';
}

async function testSettingsApi() {
    const input  = document.getElementById('settingsApiInput');
    const status = document.getElementById('settingsApiStatus');
    const url    = (input?.value || '').trim().replace(/\/+$/, '');
    API.setBaseUrl(url);
    status.textContent = '⏳ Testing connection…';
    status.style.color = '#fb8c00';
    try {
        const result = await API.healthCheck();
        status.textContent = result?.ok ? `✓ Connected to ${API.getBaseUrl()}` : `⚠ Connected (warning) at ${API.getBaseUrl()}`;
        status.style.color = '#43a047';
    } catch (err) {
        status.textContent = `✗ Failed: ${err.message}`;
        status.style.color = '#e53935';
    }
}

function clearSettingsApi() {
    API.setBaseUrl('');
    const input  = document.getElementById('settingsApiInput');
    const status = document.getElementById('settingsApiStatus');
    if (input) input.value = API.getBaseUrl() || '';
    if (status) { status.textContent = '✓ Reset to auto-detect'; status.style.color = '#43a047'; }
}

function clearLocalCache() {
    if (!confirm('Clear all cached data? You will need to reload data from server.')) return;
    const authBackup = localStorage.getItem('ffAuth');
    const darkBak    = localStorage.getItem(DARK_MODE_KEY);
    localStorage.clear();
    if (authBackup) localStorage.setItem('ffAuth', authBackup);
    if (darkBak)    localStorage.setItem(DARK_MODE_KEY, darkBak);
    showProfileToast('Cache cleared. Reload to refresh data.', 'success');
}

/* =====================================================================
   CHANGE PASSWORD PANEL
===================================================================== */
function renderChangePasswordPanel() {
    const body = document.getElementById('changePassBody');
    if (!body) return;
    body.innerHTML = `
        <div class="pp-pass-icon"><i class="fa-solid fa-lock"></i></div>
        <p style="font-size:13px;color:#888;text-align:center;margin-bottom:20px;">
            Enter your current password and choose a new one.
        </p>
        <div class="form-group">
            <label>CURRENT PASSWORD</label>
            <div class="pass-input-wrap">
                <input type="password" id="cpOldPass" class="market-input" placeholder="Current password">
                <button type="button" class="pass-eye-btn" onclick="togglePassVis('cpOldPass', this)">
                    <i class="fa-regular fa-eye"></i>
                </button>
            </div>
        </div>
        <div class="form-group">
            <label>NEW PASSWORD</label>
            <div class="pass-input-wrap">
                <input type="password" id="cpNewPass" class="market-input" placeholder="New password (min 4 chars)">
                <button type="button" class="pass-eye-btn" onclick="togglePassVis('cpNewPass', this)">
                    <i class="fa-regular fa-eye"></i>
                </button>
            </div>
        </div>
        <div class="form-group">
            <label>CONFIRM NEW PASSWORD</label>
            <div class="pass-input-wrap">
                <input type="password" id="cpConfirmPass" class="market-input" placeholder="Confirm new password">
                <button type="button" class="pass-eye-btn" onclick="togglePassVis('cpConfirmPass', this)">
                    <i class="fa-regular fa-eye"></i>
                </button>
            </div>
        </div>
        <div id="cpError" class="cp-error" style="display:none;"></div>
        <button class="verify-btn" onclick="submitChangePassword()" style="width:100%;margin-top:8px;">
            <i class="fa-solid fa-key"></i> CHANGE PASSWORD
        </button>
    `;
}

function togglePassVis(inputId, btn) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    const isPassword = inp.type === 'password';
    inp.type = isPassword ? 'text' : 'password';
    btn.innerHTML = isPassword ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
}

async function submitChangePassword() {
    const oldPass  = document.getElementById('cpOldPass')?.value.trim();
    const newPass  = document.getElementById('cpNewPass')?.value.trim();
    const confPass = document.getElementById('cpConfirmPass')?.value.trim();
    const errorEl  = document.getElementById('cpError');

    const showError = msg => {
        if (errorEl) { errorEl.style.display = 'block'; errorEl.textContent = msg; }
    };

    if (!oldPass || !newPass || !confPass) { showError('Please fill all fields.'); return; }
    if (newPass.length < 4) { showError('New password must be at least 4 characters.'); return; }
    if (newPass !== confPass) { showError('New passwords do not match.'); return; }
    if (oldPass === newPass) { showError('New password must differ from current password.'); return; }
    if (errorEl) errorEl.style.display = 'none';

    try {
        const auth   = JSON.parse(localStorage.getItem('ffAuth') || '{}');
        // Verify old password via login
        await API.login(auth.userId, oldPass);
        // Change password
        await API.changePassword(auth.userId, oldPass, newPass);
        showProfileToast('Password changed successfully ✓', 'success');
        closeProfilePanel();
        // Clear inputs
        ['cpOldPass','cpNewPass','cpConfirmPass'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    } catch (err) {
        showError('Failed: ' + err.message);
    }
}

/* =====================================================================
   LIVE STATS — pull real order data to populate the stats strip
===================================================================== */
async function refreshProfileStats() {
    try {
        const auth   = JSON.parse(localStorage.getItem('ffAuth') || '{}');
        const userId = auth.userId || '';
        const role   = auth.role   || '';
        const orders = await API.getOrders();

        if (role === 'seller') {
            const mine     = orders.filter(o =>
                o.sellerUserId === userId || o.holderId === userId || o.sellerId === userId
            );
            const completed = mine.filter(o => o.status === 'completed');
            const revenue   = completed.reduce((s, o) => s + Number(o.totalPrice || 0), 0);
            const salesEl   = document.getElementById('profileSales');
            const revEl     = document.getElementById('profileRevenue');
            if (salesEl) salesEl.textContent = completed.length;
            if (revEl)   revEl.textContent   = '₹' + revenue.toLocaleString('en-IN');

            // Update sellerOrderCount too
            const sellerOrders = document.getElementById('sellerOrderCount');
            if (sellerOrders) sellerOrders.textContent = mine.length;
            
            // Also save to profile
            if (typeof saveProfile === 'function') {
                try {
                    await saveProfile({ sales: String(completed.length), revenue: '₹' + revenue.toLocaleString('en-IN') });
                } catch (e) {
                    console.warn('Could not save seller profile stats:', e);
                }
            }

        } else if (role === 'user') {
            const mine      = orders.filter(o => o.buyerUserId === userId || o.userId === userId);
            const completed = mine.filter(o => o.status === 'completed');
            const spent     = completed.reduce((s, o) => s + Number(o.totalPrice || 0), 0);
            const salesEl   = document.getElementById('profileSales');
            const revEl     = document.getElementById('profileRevenue');
            if (salesEl) salesEl.textContent = completed.length;
            if (revEl)   revEl.textContent   = '₹' + spent.toLocaleString('en-IN');
            const userPurchases = document.getElementById('userPurchaseCount');
            if (userPurchases) userPurchases.textContent = completed.length;
        }
    } catch (e) { 
        console.warn('Error refreshing profile stats:', e);
    }
}

/* =====================================================================
   TOAST NOTIFICATION
===================================================================== */
let _profileToastTimer = null;
function showProfileToast(msg, type = 'success') {
    let toast = document.getElementById('profileToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'profileToast';
        toast.className = 'profile-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = `profile-toast profile-toast-${type} profile-toast-show`;
    clearTimeout(_profileToastTimer);
    _profileToastTimer = setTimeout(() => {
        toast.classList.remove('profile-toast-show');
    }, 3000);
}

/* =====================================================================
   INIT — called when profile tab is opened
===================================================================== */
async function initProfilePage() {
    try {
        hoistProfilePanels();   // move panels to <body> for correct fixed positioning
        initDarkMode();
        
        // Load and display profile data from API
        if (typeof initProfile === 'function') {
            try {
                await initProfile();
            } catch (e) {
                console.error('Error calling initProfile:', e);
            }
        }
        
        // Refresh stats (non-blocking, but should handle errors)
        try {
            await refreshProfileStats();
        } catch (e) {
            console.warn('Error refreshing profile stats:', e);
            // Don't let this error prevent the profile from showing
        }
    } catch (e) {
        console.error('Error initializing profile page:', e);
    }
}
