/**
 * price-prediction.js — AI Price Prediction Engine
 * No ML libraries needed. Uses:
 *   1. Historical orders: 30, 60, 90 day windows
 *   2. Weighted moving average for trend direction
 *   3. Demand-adjusted price suggestion (+5–10%)
 *
 * Requires: api.js (API.getOrders, API.getMarketProducts)
 */

/* ============================================================
   CONSTANTS
============================================================ */
const PP_WINDOW_DAYS   = 30;   // primary analysis window
const PP_TREND_DAYS    = 60;   // wider window for trend comparison
const PP_BOOST_LOW     = 0.05; // +5%  — moderate demand
const PP_BOOST_HIGH    = 0.10; // +10% — strong demand / rising trend
const PP_BOOST_NONE    = 0.02; // +2%  — flat / falling demand

/* ============================================================
   HELPERS
============================================================ */

/** Days between two ISO date strings (always positive). */
function _daysBetween(isoA, isoB) {
    return Math.abs(
        (new Date(isoA).getTime() - new Date(isoB).getTime()) / 86400000
    );
}

/** Derive price-per-100g for a single completed order given its product. */
function _unitPrice(order, product) {
    if (!product) return null;

    const qty        = Number(order.qty) || 0;
    const total      = Number(order.totalPrice) || 0;
    const prodUnit   = (order.unit || product.unit || 'g').toLowerCase();

    // Make sure we have sensible values
    if (qty <= 0 || total <= 0) return null;

    // Convert order qty to grams
    let qtyGrams = qty;
    if (prodUnit === 'kg') qtyGrams = qty * 1000;
    else if (prodUnit === 'l')    qtyGrams = qty * 1000;

    if (qtyGrams <= 0) return null;

    // ₹ per 100 g
    return (total / qtyGrams) * 100;
}

/** Linear regression slope over (index, value) pairs.
 *  Positive → prices rising; Negative → prices falling. */
function _linearSlope(values) {
    const n = values.length;
    if (n < 2) return 0;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
        sumX  += i;
        sumY  += values[i];
        sumXY += i * values[i];
        sumX2 += i * i;
    }
    const denom = n * sumX2 - sumX * sumX;
    return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
}

/** Format a date as 'DD MMM YYYY'. */
function _fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

/* ============================================================
   MAIN ENGINE
============================================================ */
const PricePredictionEngine = {

    /**
     * Analyse all orders for a specific product and return prediction data.
     *
     * @param {string} productId   — target product id
     * @param {Array}  allOrders   — full orders array (from API)
     * @param {Array}  allProducts — full market products array
     * @returns {Object|null}      — prediction result or null if no data
     */
    predict(productId, allOrders, allProducts) {
        // ── find product metadata ─────────────────────────────────────────
        const product = allProducts.find(p => String(p.id) === String(productId));

        // ── filter completed orders for this product ──────────────────────
        const relOrders = (allOrders || [])
            .filter(o =>
                String(o.productId) === String(productId) &&
                o.status === 'completed'
            )
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        if (!relOrders.length) return null;

        const now    = new Date().toISOString();
        const name   = product ? product.name   : relOrders[0].productName;
        const curPricePer100g = product
            ? Number(product.packPrice
                ? (product.packPrice / (product.packWeight || product.minQuantity || 100)) * 100
                : product.pricePer100g)
            : null;

        // ── build price-point history ─────────────────────────────────────
        const history = relOrders.map(o => ({
            date:          o.createdAt,
            price:         _unitPrice(o, product),
            daysAgo:       _daysBetween(now, o.createdAt)
        })).filter(h => h.price !== null);

        if (!history.length) return null;

        // All prices across full history (fallback baseline)
        const allPrices = history.map(h => h.price);
        const allAvg    = allPrices.reduce((s, p) => s + p, 0) / allPrices.length;

        // ── 30-day window ─────────────────────────────────────────────────
        const recent30 = history.filter(h => h.daysAgo <= PP_WINDOW_DAYS);
        const prices30 = recent30.map(h => h.price);

        const avg30 = prices30.length
            ? prices30.reduce((s, p) => s + p, 0) / prices30.length
            : null;

        // ── 60-day window for trend ───────────────────────────────────────
        const recent60 = history.filter(h => h.daysAgo <= PP_TREND_DAYS);
        const prices60 = recent60.map(h => h.price);

        // ── demand & velocity indicators ──────────────────────────────────
        const ordersLast30  = recent30.length;
        const ordersLast60  = recent60.length;

        // Orders per day in each half
        const velocity30     = ordersLast30 / PP_WINDOW_DAYS;
        const velocity30_60  = (ordersLast60 - ordersLast30) / PP_WINDOW_DAYS;

        // Demand trend: how much faster are recent orders arriving?
        const velocityDelta = velocity30 - velocity30_60;

        // ── price trend via linear regression ─────────────────────────────
        // Use widest available window (60d → 30d → all history) for slope
        const slopeSeries = prices60.length >= 2 ? prices60
                          : prices30.length >= 2  ? prices30
                          : allPrices;
        const slope = _linearSlope(slopeSeries);

        // Representative average — prefer recent windows, fall back to all history
        const avgPrice     = avg30
                           || (prices60.length ? prices60.reduce((s, p) => s + p, 0) / prices60.length : null)
                           || allAvg;
        const slopePercent = (slope / avgPrice) * 100;

        // ── decide direction label ────────────────────────────────────────
        let trendDir, trendLabel, trendPct;
        if (slopePercent > 1) {
            trendDir   = 'up';
            trendLabel = 'Increasing';
            trendPct   = Math.min(Math.abs(slopePercent), 30).toFixed(1);
        } else if (slopePercent < -1) {
            trendDir   = 'down';
            trendLabel = 'Decreasing';
            trendPct   = Math.min(Math.abs(slopePercent), 30).toFixed(1);
        } else {
            trendDir   = 'flat';
            trendLabel = 'Stable';
            trendPct   = '0.0';
        }

        // ── compute boost factor ──────────────────────────────────────────
        let boostFactor;
        if (trendDir === 'up' && velocityDelta >= 0) {
            boostFactor = PP_BOOST_HIGH;   // strong +10%
        } else if (trendDir === 'flat' || velocityDelta >= 0) {
            boostFactor = PP_BOOST_LOW;    // moderate +5%
        } else {
            boostFactor = PP_BOOST_NONE;   // minimal +2%
        }

        // ── suggested price ───────────────────────────────────────────────
        // baseForSuggestion: prefer 30d avg → full-history avg → product listing price
        const baseForSuggestion = avg30 || allAvg || curPricePer100g || 1;
        const suggestedPer100g  = Math.round(baseForSuggestion * (1 + boostFactor));
        const boostPct          = (boostFactor * 100).toFixed(0);

        // ── convert to pack-level prices (if product has pack info) ────────
        let currentPackPrice = null, suggestedPackPrice = null;
        if (product && product.packWeight) {
            const pw = Number(product.packWeight);
            const packUnit = (product.packUnit || product.unit || 'g').toLowerCase();
            const packGrams = packUnit === 'kg' ? pw * 1000 : pw;
            currentPackPrice   = Math.round((curPricePer100g  || baseForSuggestion) / 100 * packGrams);
            suggestedPackPrice = Math.round(suggestedPer100g / 100 * packGrams);
        }

        // ── market context ────────────────────────────────────────────────
        const currentMarket = curPricePer100g
            ? Math.round(curPricePer100g)
            : Math.round(avgPrice);

        return {
            productId,
            name,
            currentMarket,              // ₹ / 100g (from product listing)
            avg30: avg30 !== null ? Math.round(avg30) : Math.round(allAvg), // fallback to all-history avg
            trendDir,
            trendLabel,
            trendPct: parseFloat(trendPct),
            suggestedPer100g,
            boostPct: parseInt(boostPct, 10),
            ordersLast30,
            currentPackPrice,
            suggestedPackPrice,
            packLabel: product
                ? `${product.packWeight || product.minQuantity}${product.packUnit || product.unit || 'g'}`
                : null,

            // Sparkline data (most recent ~8 price points for mini-chart)
            sparkline: history.slice(-8).map(h => ({
                date:  _fmtDate(h.date),
                price: Math.round(h.price)
            }))
        };
    },

    /**
     * Run predictions for all products that have at least one completed order.
     * Returns array sorted by ordersLast30 desc.
     */
    predictAll(allOrders, allProducts) {
        const productIdsWithOrders = [
            ...new Set(
                (allOrders || [])
                    .filter(o => o.status === 'completed')
                    .map(o => o.productId)
            )
        ];

        return productIdsWithOrders
            .map(pid => this.predict(pid, allOrders, allProducts))
            .filter(Boolean)
            .sort((a, b) => b.ordersLast30 - a.ordersLast30);
    }
};
