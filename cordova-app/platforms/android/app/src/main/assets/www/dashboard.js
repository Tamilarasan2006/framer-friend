/**
 * dashboard.js — Farmer Dashboard Module
 * Handles all data fetching and rendering for the Farmer Dashboard section.
 * Requires: Chart.js, api.js
 */

/* ====================================================
   GLOBALS
==================================================== */
let _dbRevenueChart = null;   // Chart.js instance (destroyed on reload)
let _dbLoaded = false;        // prevent duplicate loads

/* ====================================================
   ENTRY POINT — called from showTab() in script.js
==================================================== */
async function loadFarmerDashboard(userId) {
    _dbLoaded = true;
    _renderHeroSection(userId);
    _showDashboardSkeleton();

    try {
        const data = await API.getDashboard(userId);
        if (!data) throw new Error('No dashboard data returned.');

        _renderSummaryStrip(data);
        _renderEarningsCard(data.totalEarnings);
        _renderOrderStatus(data.orderStatus);
        _renderRevenueChart(data.monthlyRevenue);
        _renderBestSellers(data.bestSellers);
        _renderCropsAdded(data.cropsAdded);
        _renderQuickStats(data.quickStats);
    } catch (err) {
        console.error('[Dashboard] Load error:', err.message);
        _renderDashboardError(err.message);
    }

    // Initialise AI Price Prediction widget (non-blocking)
    initPricePrediction(userId).catch(e =>
        console.warn('[PricePredict] init failed:', e.message)
    );
}

/* ====================================================
   HERO / GREETING
==================================================== */
function _renderHeroSection(userId) {
    const hour = new Date().getHours();
    let greeting = 'Good morning, Farmer';
    if (hour >= 12 && hour < 17) greeting = 'Good afternoon, Farmer';
    else if (hour >= 17) greeting = 'Good evening, Farmer';

    const greetEl = document.getElementById('dbGreeting');
    const dateEl  = document.getElementById('dbDate');
    if (greetEl) greetEl.textContent = greeting;
    if (dateEl) {
        const now = new Date();
        dateEl.textContent = now.toLocaleDateString('en-IN', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
        });
    }
}

/* ====================================================
   SKELETON LOADER
==================================================== */
function _showDashboardSkeleton() {
    const targets = ['dbTotalEarnings', 'dbStatusCompleted', 'dbStatusPending',
                     'dbStatusCancelled', 'dbCropsCount', 'dbTotalOrders',
                     'dbCompletedOrders', 'dbTotalSales', 'dbAvgRating'];
    targets.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = '...'; el.classList.add('db-loading'); }
    });

    const bsEl = document.getElementById('dbBestSellers');
    if (bsEl) bsEl.innerHTML = '<div class="db-skeleton-list"><div class="db-skel"></div><div class="db-skel"></div><div class="db-skel"></div></div>';
}

function _clearLoading(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('db-loading');
}

/* ====================================================
   SUMMARY STRIP (4 top cards)
==================================================== */
function _renderSummaryStrip(data) {
    const earnings = data.totalEarnings || 0;
    const totalOrders = (data.quickStats || {}).totalOrders || 0;
    const pending = (data.orderStatus || {}).pending || 0;
    const products = data.cropsAdded || 0;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('dbSumEarnings', '\u20B9' + Number(earnings).toLocaleString('en-IN'));
    set('dbSumSales', totalOrders);
    set('dbSumPending', pending);
    set('dbSumProducts', products);
}

/* ====================================================
   EARNINGS CARD
==================================================== */
function _renderEarningsCard(totalEarnings) {
    const el = document.getElementById('dbTotalEarnings');
    if (!el) return;
    _clearLoading('dbTotalEarnings');

    // Animated count-up
    const target = Number(totalEarnings) || 0;
    let current = 0;
    const step = Math.max(1, Math.floor(target / 60));
    const subEl = document.getElementById('dbEarningsSub');

    const timer = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = '\u20B9' + current.toLocaleString('en-IN');
        if (current >= target) {
            clearInterval(timer);
            el.textContent = '\u20B9' + target.toLocaleString('en-IN');
            if (subEl) subEl.textContent = 'total from completed orders';
        }
    }, 16);
}

/* ====================================================
   ORDER STATUS
==================================================== */
function _renderOrderStatus(orderStatus) {
    const s = orderStatus || { completed: 0, pending: 0, cancelled: 0 };
    const ids = ['dbStatusCompleted', 'dbStatusPending', 'dbStatusCancelled'];
    const keys = ['completed', 'pending', 'cancelled'];
    ids.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) { el.textContent = s[keys[i]] || 0; _clearLoading(id); }
    });
}

/* ====================================================
   MONTHLY REVENUE CHART
==================================================== */
function _renderRevenueChart(monthlyRevenue) {
    const canvas = document.getElementById('dbRevenueChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (_dbRevenueChart) {
        _dbRevenueChart.destroy();
        _dbRevenueChart = null;
    }

    const months = (monthlyRevenue || []).map(m => m.label);
    const revenues = (monthlyRevenue || []).map(m => m.revenue);
    const maxRev = Math.max(...revenues, 1);

    const ctx = canvas.getContext('2d');

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, 220);
    grad.addColorStop(0, 'rgba(76, 175, 80, 0.55)');
    grad.addColorStop(1, 'rgba(76, 175, 80, 0.02)');

    _dbRevenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Revenue',
                data: revenues,
                fill: true,
                backgroundColor: grad,
                borderColor: '#4caf50',
                borderWidth: 2.5,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#4caf50',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                tension: 0.42
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 900, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(30,40,30,0.92)',
                    titleColor: '#aed581',
                    bodyColor: '#fff',
                    padding: 10,
                    callbacks: {
                        label: ctx => ' \u20B9' + Number(ctx.parsed.y).toLocaleString('en-IN')
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(200,230,200,0.08)' },
                    ticks: { color: '#9e9e9e', font: { size: 11 } }
                },
                y: {
                    min: 0,
                    suggestedMax: maxRev * 1.25,
                    grid: { color: 'rgba(200,230,200,0.10)' },
                    ticks: {
                        color: '#9e9e9e',
                        font: { size: 11 },
                        callback: v => '\u20B9' + Number(v).toLocaleString('en-IN')
                    }
                }
            }
        }
    });
}

/* ====================================================
   BEST SELLERS
==================================================== */
const _rankMedals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

function _renderBestSellers(bestSellers) {
    const container = document.getElementById('dbBestSellers');
    if (!container) return;

    const items = bestSellers || [];
    if (!items.length) {
        container.innerHTML = '<p class="db-empty">No sales data yet.</p>';
        return;
    }

    container.innerHTML = items.map((p, i) => `
        <div class="db-bs-item">
            <span class="db-bs-rank">${_rankMedals[i] || (i + 1)}</span>
            <div class="db-bs-img-wrap">
                ${p.image
                    ? `<img src="${p.image}" alt="${p.name}" class="db-bs-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                       <div class="db-bs-img-fallback" style="display:none;"><i class="fa-solid fa-seedling"></i></div>`
                    : `<div class="db-bs-img-fallback"><i class="fa-solid fa-seedling"></i></div>`
                }
            </div>
            <div class="db-bs-info">
                <div class="db-bs-name">${p.name}</div>
                <div class="db-bs-meta">\u20B9${p.pricePer100g}/100g &middot; ${p.buys} sales</div>
            </div>
            <div class="db-bs-badge">${p.buys} sold</div>
        </div>
    `).join('');
}

/* ====================================================
   CROPS ADDED
==================================================== */
function _renderCropsAdded(count) {
    const el = document.getElementById('dbCropsCount');
    if (el) { el.textContent = count != null ? count : 0; _clearLoading('dbCropsCount'); }
}

/* ====================================================
   QUICK STATS
==================================================== */
function _renderQuickStats(quickStats) {
    const qs = quickStats || {};
    const map = {
        dbTotalOrders:     qs.totalOrders     || 0,
        dbCompletedOrders: qs.completedOrders || 0,
        dbTotalSales:      qs.totalSales      || 0,
        dbAvgRating:       qs.avgRating       ? qs.avgRating + ' \u2B50' : 'N/A'
    };
    Object.entries(map).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) { el.textContent = val; _clearLoading(id); }
    });
}

/* ====================================================
   ERROR STATE
==================================================== */
function _renderDashboardError(msg) {
    const ids = ['dbTotalEarnings', 'dbStatusCompleted', 'dbStatusPending',
                 'dbStatusCancelled', 'dbCropsCount', 'dbTotalOrders',
                 'dbCompletedOrders', 'dbTotalSales', 'dbAvgRating'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = '-'; _clearLoading(id); }
    });
    const bsEl = document.getElementById('dbBestSellers');
    if (bsEl) bsEl.innerHTML = '<p class="db-empty" style="color:#e53935"><i class="fa-solid fa-triangle-exclamation"></i> ' + msg + '</p>';
}

/* ====================================================
   NEARBY MARKET ACTIVITY (Dashboard widget)
==================================================== */
async function loadDashboardNearby() {
    const btn    = document.getElementById('dbNearbyDetectBtn');
    const status = document.getElementById('dbNearbyStatus');
    const list   = document.getElementById('dbNearbyList');
    if (!status || !list) return;

    if (!navigator.geolocation) {
        status.innerHTML = '<span style="color:#e53935"><i class="fa-solid fa-triangle-exclamation"></i> GPS not supported on this device.</span>';
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Detecting...';
    }
    status.textContent = '';
    list.innerHTML = '';

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            if (btn) {
                btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh';
                btn.disabled = false;
                btn.onclick = loadDashboardNearby;
            }

            status.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color:#43a047"></i> Finding nearby listings...';

            try {
                const products = await API.getNearbyProducts(lat, lng, 50, 'nearest');
                if (!products.length) {
                    status.innerHTML = '<span style="color:#888"><i class="fa-solid fa-circle-info"></i> No sellers found within 50 km.</span>';
                    return;
                }

                status.innerHTML = `<span style="color:#388e3c;font-weight:700"><i class="fa-solid fa-circle-check"></i> ${products.length} seller${products.length !== 1 ? 's' : ''} within 50 km</span>`;

                list.innerHTML = products.slice(0, 8).map(p => {
                    const imgSrc = (p.image && /^https?:\/\//i.test(p.image)) ? p.image
                        : p.image ? p.image : 'image/seeds.jpg';
                    const priceLabel = p.packPrice
                        ? `₹${p.packPrice}/${p.packWeight || p.minQuantity}${p.packUnit || p.unit || 'g'}`
                        : `₹${p.pricePer100g}/100g`;
                    const contactHref = p.holderPhone ? `tel:${p.holderPhone}` : '#';
                    const isSoldOut = p.stock !== undefined && p.stock !== null && Number(p.stock) <= 0;
                    return `
                    <div class="db-nearby-item${isSoldOut ? ' db-nearby-soldout' : ''}">
                        <img class="db-nearby-img" src="${imgSrc}" alt="${p.name}" onerror="this.src='image/seeds.jpg'">
                        <div class="db-nearby-info">
                            <div class="db-nearby-name">${p.name}${isSoldOut ? ' <span class="db-nearby-so-tag">SOLD OUT</span>' : ''}</div>
                            <div class="db-nearby-meta">
                                <span class="db-nearby-dist"><i class="fa-solid fa-location-dot"></i> ${p.distanceKm} km</span>
                                <span class="db-nearby-price">${priceLabel}</span>
                                ${p.transportEstimateRs > 0 ? `<span class="db-nearby-transport"><i class="fa-solid fa-truck"></i> ~₹${p.transportEstimateRs}</span>` : ''}
                            </div>
                            <div class="db-nearby-seller"><i class="fa-solid fa-user-tag"></i> ${p.holderName || 'Unknown'}</div>
                        </div>
                        ${!isSoldOut && p.holderPhone ? `<a href="${contactHref}" class="db-nearby-contact"><i class="fa-solid fa-phone"></i></a>` : ''}
                    </div>`;
                }).join('');

            } catch (err) {
                status.innerHTML = `<span style="color:#e53935"><i class="fa-solid fa-triangle-exclamation"></i> ${err.message}</span>`;
            }
        },
        (err) => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Detect My Location';
            }
            status.innerHTML = `<span style="color:#e53935"><i class="fa-solid fa-triangle-exclamation"></i> Location denied: ${err.message}</span>`;
        },
        { enableHighAccuracy: true, timeout: 12000 }
    );
}

/* ====================================================
   AI PRICE PREDICTION WIDGET
==================================================== */

let _ppAllOrders   = null;
let _ppAllProducts = null;
let _ppSparkChart  = null;

/**
 * Populate the product selector with products the logged-in seller owns
 * (or all products for admin). Called automatically when dashboard loads.
 */
async function initPricePrediction(userId) {
    const sel = document.getElementById('dbPredictProductSel');
    if (!sel) return;

    try {
        // Fetch data (cached after first call)
        if (!_ppAllOrders)   _ppAllOrders   = await API.getOrders();
        if (!_ppAllProducts) _ppAllProducts = await API.getMarketProducts();

        // Determine which products this user owns
        const auth = JSON.parse(localStorage.getItem('ffAuth') || '{}');
        const role = auth.role || '';

        const ownerProducts = role === 'admin'
            ? _ppAllProducts
            : _ppAllProducts.filter(p => {
                const holderId = String(p.holderId || '').trim() ||
                    (String(p.holderName || '').match(/F\d+/i) || [])[0] || '';
                return holderId === userId || holderId === auth.userId;
              });

        // Also include any product that has orders by this seller
        const sellerProductIds = new Set(
            (_ppAllOrders || [])
                .filter(o => o.sellerUserId === userId || o.sellerUserId === auth.userId)
                .map(o => o.productId)
        );
        const merged = [
            ...ownerProducts,
            ..._ppAllProducts.filter(p =>
                sellerProductIds.has(p.id) && !ownerProducts.find(op => op.id === p.id)
            )
        ];

        if (!merged.length) {
            sel.innerHTML = '<option value="">— No products found —</option>';
            return;
        }

        sel.innerHTML = '<option value="">— Select a product —</option>' +
            merged.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    } catch (err) {
        sel.innerHTML = '<option value="">— Error loading products —</option>';
        console.error('[PricePredict] init error:', err.message);
    }
}

/** Called when the product dropdown changes — resets result panel. */
function onPredictProductChange() {
    document.getElementById('dbPredictResult')  && (document.getElementById('dbPredictResult').style.display  = 'none');
    document.getElementById('dbPredictNoData')  && (document.getElementById('dbPredictNoData').style.display  = 'none');
    document.getElementById('dbPredictLoading') && (document.getElementById('dbPredictLoading').style.display = 'none');
}

/** Runs the prediction and renders the result card. */
async function runPricePrediction() {
    const sel     = document.getElementById('dbPredictProductSel');
    const result  = document.getElementById('dbPredictResult');
    const nodata  = document.getElementById('dbPredictNoData');
    const loading = document.getElementById('dbPredictLoading');
    const btn     = document.getElementById('dbPredictRunBtn');
    if (!sel || !result) return;

    const productId = sel.value;
    if (!productId) {
        alert('Please select a product first.');
        return;
    }

    // Show loading
    result.style.display  = 'none';
    nodata.style.display  = 'none';
    loading.style.display = 'flex';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }

    try {
        // Ensure data is loaded
        if (!_ppAllOrders)   _ppAllOrders   = await API.getOrders();
        if (!_ppAllProducts) _ppAllProducts = await API.getMarketProducts();

        const prediction = PricePredictionEngine.predict(productId, _ppAllOrders, _ppAllProducts);

        loading.style.display = 'none';
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Predict'; }

        if (!prediction) {
            document.getElementById('dbPredictNoDataMsg').textContent =
                'No completed orders found for this product yet. Make some sales first!';
            nodata.style.display = 'flex';
            return;
        }

        _renderPrediction(prediction);
        result.style.display = 'block';

    } catch (err) {
        loading.style.display = 'none';
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Predict'; }
        document.getElementById('dbPredictNoDataMsg').textContent = 'Error: ' + err.message;
        nodata.style.display = 'flex';
        console.error('[PricePredict] run error:', err.message);
    }
}

/** Render all the prediction UI elements. */
function _renderPrediction(p) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    // Prices
    set('ppCurrentPrice',   p.currentMarket ? `₹${p.currentMarket}` : '—');
    set('ppSuggestedPrice', `₹${p.suggestedPer100g}`);

    // Pack row
    const packRow = document.getElementById('ppPackRow');
    if (packRow && p.currentPackPrice !== null) {
        set('ppCurrentPack',   `₹${p.currentPackPrice}/${p.packLabel}`);
        set('ppSuggestedPack', `₹${p.suggestedPackPrice}/${p.packLabel}`);
        packRow.style.display = 'flex';
    } else if (packRow) {
        packRow.style.display = 'none';
    }

    // Stats
    set('ppAvg30',    p.avg30 !== null ? `₹${p.avg30}` : 'N/A');
    set('ppOrders30', p.ordersLast30);
    set('ppBoost',    `+${p.boostPct}%`);

    // Trend
    const trendEl = document.getElementById('ppTrend');
    const iconEl  = document.getElementById('ppTrendIcon');
    const statEl  = document.getElementById('ppStatTrend');
    if (trendEl) {
        const arrow = p.trendDir === 'up' ? '↑' : p.trendDir === 'down' ? '↓' : '→';
        trendEl.textContent = `${arrow} +${p.trendPct}% (${p.trendLabel})`;
    }
    if (iconEl) {
        iconEl.className = p.trendDir === 'up'
            ? 'fa-solid fa-arrow-trend-up'
            : p.trendDir === 'down'
            ? 'fa-solid fa-arrow-trend-down'
            : 'fa-solid fa-minus';
    }
    if (statEl) {
        statEl.className = 'db-predict-stat ' +
            (p.trendDir === 'up' ? 'pp-trend-up' : p.trendDir === 'down' ? 'pp-trend-down' : '');
    }

    // Tip text
    const tipEl = document.getElementById('ppTip');
    if (tipEl) {
        let tipText = '';
        if (p.trendDir === 'up' && p.boostPct >= 10) {
            tipText = `🔥 High demand! Price at ₹${p.suggestedPer100g}/100g for best profit — market is trending up.`;
        } else if (p.trendDir === 'up') {
            tipText = `📈 Prices are rising. Listing at ₹${p.suggestedPer100g}/100g gives you a competitive edge.`;
        } else if (p.trendDir === 'down') {
            tipText = `ℹ︎ Market is softening. ₹${p.suggestedPer100g}/100g keeps you competitive while protecting margins.`;
        } else {
            tipText = `✅ Stable market. Listing at ₹${p.suggestedPer100g}/100g (30-day avg + ${p.boostPct}%) is optimal.`;
        }
        tipEl.textContent = tipText;
    }

    // Sparkline chart
    _renderSparkline(p.sparkline);
}

/** Render the small price-history sparkline using Chart.js. */
function _renderSparkline(sparkline) {
    const canvas = document.getElementById('ppSparkCanvas');
    if (!canvas || typeof Chart === 'undefined' || !sparkline.length) return;

    if (_ppSparkChart) { _ppSparkChart.destroy(); _ppSparkChart = null; }

    const ctx    = canvas.getContext('2d');
    const grad   = ctx.createLinearGradient(0, 0, 0, 70);
    grad.addColorStop(0, 'rgba(129, 199, 132, 0.45)');
    grad.addColorStop(1, 'rgba(129, 199, 132, 0.02)');

    _ppSparkChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sparkline.map(s => s.date),
            datasets: [{
                data:               sparkline.map(s => s.price),
                fill:               true,
                backgroundColor:    grad,
                borderColor:        '#43a047',
                borderWidth:        2,
                pointRadius:        4,
                pointBackgroundColor: '#fff',
                pointBorderColor:   '#43a047',
                pointBorderWidth:   2,
                tension:            0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 700, easing: 'easeOutCubic' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(27,42,27,0.92)',
                    titleColor: '#a5d6a7',
                    bodyColor:  '#fff',
                    padding:    8,
                    callbacks: {
                        label: ctx => ' ₹' + ctx.parsed.y + '/100g'
                    }
                }
            },
            scales: {
                x: {
                    grid:  { display: false },
                    ticks: { color: '#9e9e9e', font: { size: 9 }, maxRotation: 30 }
                },
                y: {
                    // Add 10% padding above & below so the line is never cut off
                    min: Math.floor(Math.min(...sparkline.map(s => s.price)) * 0.90),
                    max: Math.ceil( Math.max(...sparkline.map(s => s.price)) * 1.10),
                    grid:  { color: 'rgba(200,230,200,0.10)' },
                    ticks: { color: '#9e9e9e', font: { size: 10 }, callback: v => '₹' + v }
                }
            }
        }
    });
}

