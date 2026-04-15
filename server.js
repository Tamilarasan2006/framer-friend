const express = require('express');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const mongoose = require('mongoose');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DB_DIR = path.join(__dirname, 'database');
const UPLOAD_DIR = path.join(__dirname, 'image', 'uploads');
const LIVE_RATE_CACHE_TTL_MS = 5 * 60 * 1000;
const MONGO_URI = (process.env.MONGO_URI || '').trim();

// In-memory cache for database files
const _dbCache = {};
const _liveRateCache = {};

let FileStore = null;
const fileStoreSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true, index: true },
        data: { type: mongoose.Schema.Types.Mixed, required: true }
    },
    { timestamps: true, versionKey: false }
);

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname, { maxAge: '1h' }));

// Ensure upload directory exists
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ===== ASYNC HANDLER WRAPPER (Express 4 doesn't catch async errors) =====
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// ===== DATABASE HELPERS (ASYNC + CACHED) =====

async function initStorage() {
    if (!MONGO_URI) {
        console.log('  Storage mode: Local JSON files (MONGO_URI not set)');
        return;
    }

    try {
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 15000
        });
        FileStore = mongoose.model('FileStore', fileStoreSchema, 'file_store');
        console.log('  Storage mode: MongoDB Atlas (Mongoose connected)');
    } catch (err) {
        console.error('  MongoDB connection failed, falling back to local JSON files:', err.message);
        FileStore = null;
    }
}

async function readJSONFallback(filename) {
    const filePath = path.join(DB_DIR, filename);
    try {
        const raw = await fsp.readFile(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch (err) {
        console.error(`Failed to load database file: ${filename}`, err.message);
        return null;
    }
}

async function readMongo(filename) {
    if (!FileStore) return null;
    const existing = await FileStore.findOne({ name: filename }).lean();
    if (existing) return existing.data;

    const seeded = await readJSONFallback(filename);
    if (seeded === null) return null;

    await FileStore.updateOne(
        { name: filename },
        { $set: { data: seeded } },
        { upsert: true }
    );
    return seeded;
}

async function writeMongo(filename, data) {
    if (!FileStore) return;
    await FileStore.updateOne(
        { name: filename },
        { $set: { data } },
        { upsert: true }
    );
}

async function readDB(filename) {
    if (_dbCache[filename] !== undefined) return _dbCache[filename];

    const data = FileStore
        ? await readMongo(filename)
        : await readJSONFallback(filename);

    _dbCache[filename] = data;
    return data;
}

async function writeDB(filename, data) {
    _dbCache[filename] = data;

    if (FileStore) {
        await writeMongo(filename, data);
        return;
    }

    const filePath = path.join(DB_DIR, filename);
    await fsp.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ===== INPUT VALIDATION HELPERS =====

/**
 * Validates and sanitizes string inputs to prevent injection attacks
 * @param {any} value - Value to validate
 * @param {number} minLength - Minimum string length (default 1)
 * @param {number} maxLength - Maximum string length (default 500)
 * @returns {string|null} Sanitized string or null if invalid
 */
function validateString(value, minLength = 1, maxLength = 500) {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    if (str.length < minLength || str.length > maxLength) return null;
    // Remove potentially dangerous characters but allow basic punctuation
    return str.replace(/[<>{}|\\^`]/g, '');
}

/**
 * Validates email format
 * @param {any} email - Email to validate
 * @returns {string|null} Valid email or null
 */
function validateEmail(email) {
    const str = validateString(email, 3, 254);
    if (!str) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(str) ? str : null;
}

/**
 * Validates phone numbers (10-15 digits)
 * @param {any} phone - Phone to validate
 * @returns {string|null} Valid phone or null
 */
function validatePhone(phone) {
    if (!phone) return null;
    const digits = String(phone).replace(/\D/g, '');
    return (digits.length >= 10 && digits.length <= 15) ? digits : null;
}

/**
 * Validates numeric values
 * @param {any} value - Value to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number|null} Valid number or null
 */
function validateNumber(value, min = -Infinity, max = Infinity) {
    const num = Number(value);
    return Number.isFinite(num) && num >= min && num <= max ? num : null;
}

/**
 * Validates product data
 * @param {object} product - Product object to validate
 * @returns {object|null} Validated product or null
 */
function validateProduct(product) {
    if (!product || typeof product !== 'object') return null;
    
    const name = validateString(product.name, 2, 100);
    const description = validateString(product.description, 0, 1000);
    const price = validateNumber(product.price, 0, 1000000);
    const quantity = validateNumber(product.quantity, 0, 100000);
    const location = validateString(product.location, 1, 100);
    
    if (!name || price === null || quantity === null || !location) return null;
    
    return {
        name,
        description: description || '',
        price,
        quantity,
        location,
        ...(product.image && { image: validateString(product.image, 0, 500) || '' })
    };
}

/**
 * Validates fertilizer/cattle product data
 * @param {object} item - Item object to validate
 * @returns {object|null} Validated item or null
 */
function validateFertilizerItem(item) {
    if (!item || typeof item !== 'object') return null;
    
    const name = validateString(item.name, 2, 100);
    const type = validateString(item.type, 2, 50);
    const price = validateNumber(item.price, 0, 1000000);
    const location = validateString(item.location, 1, 100);
    
    if (!name || !type || price === null || !location) return null;
    
    return {
        name,
        type,
        price,
        location,
        ...(item.description && { description: validateString(item.description, 0, 500) || '' })
    };
}

/**
 * Validates profile data
 * @param {object} profile - Profile object to validate
 * @returns {object|null} Validated profile or null
 */
function validateProfile(profile) {
    if (!profile || typeof profile !== 'object') return null;
    
    const validated = {};
    
    if (profile.farmName) {
        const farmName = validateString(profile.farmName, 2, 100);
        if (farmName) validated.farmName = farmName;
    }
    
    if (profile.location) {
        const location = validateString(profile.location, 1, 100);
        if (location) validated.location = location;
    }
    
    if (profile.phone) {
        const phone = validatePhone(profile.phone);
        if (!phone) return null; // Fail validation if phone is provided but invalid
        validated.phone = phone;
    }
    
    if (profile.bio) {
        const bio = validateString(profile.bio, 0, 500);
        if (bio) validated.bio = bio;
    }
    
    if (profile.crops) {
        if (Array.isArray(profile.crops)) {
            validated.crops = profile.crops
                .map(c => validateString(c, 1, 50))
                .filter(c => c !== null);
        }
    }
    
    return Object.keys(validated).length > 0 ? validated : null;
}

/**
 * Validates order data
 * @param {object} order - Order object to validate
 * @returns {object|null} Validated order or null
 */
function validateOrder(order) {
    if (!order || typeof order !== 'object') return null;
    
    const buyerUserId = validateString(order.buyerUserId, 1, 100);
    const sellerUserId = validateString(order.sellerUserId, 1, 100);
    const qty = validateNumber(order.qty, 1, 100000);
    const totalPrice = validateNumber(order.totalPrice, 0.01, 10000000);
    
    if (!buyerUserId || !sellerUserId || qty === null || totalPrice === null) return null;
    
    return {
        buyerUserId,
        sellerUserId,
        qty,
        totalPrice,
        ...(order.productId && { productId: validateString(order.productId, 1, 50) || '' }),
        status: (order.status && ['pending', 'completed', 'cancelled'].includes(order.status)) ? order.status : 'pending'
    };
}

function normalizeDistrictName(location) {
    const raw = String(location || '').trim();
    if (!raw) return '';
    const map = {
        trichy: 'Tiruchirappalli',
        tiruchi: 'Tiruchirappalli',
        thiruchi: 'Tiruchirappalli',
        kovai: 'Coimbatore',
        thanjavur: 'Thanjavur'
    };
    const key = raw.toLowerCase();
    return map[key] || raw;
}

function normalizeApiRecords(records) {
    return (records || [])
        .filter(r => r && r.commodity && (r.modal_price || r.max_price || r.min_price))
        .map(r => ({
            commodity: r.commodity,
            district: r.district || r.city || '',
            market: r.market || '',
            variety: r.variety || '',
            grade: r.grade || '',
            quality: r.grade || r.variety || '',
            date: r.arrival_date || r.price_date || r.created_at || new Date().toISOString().slice(0, 10),
            modalPrice: Number(r.modal_price || r.max_price || r.min_price || 0),
            minPrice: Number(r.min_price || 0),
            maxPrice: Number(r.max_price || 0),
            unit: 'Quintal'
        }))
        .filter(r => Number.isFinite(r.modalPrice) && r.modalPrice > 0)
        .sort((a, b) => b.modalPrice - a.modalPrice);
}

async function fetchOnlineLiveRates(location) {
    const district = normalizeDistrictName(location);
    const cacheKey = (district || 'all').toLowerCase();
    const now = Date.now();
    const cached = _liveRateCache[cacheKey];
    if (cached && now - cached.ts < LIVE_RATE_CACHE_TTL_MS) {
        return cached.payload;
    }

    // Agmarknet open data (Data.gov.in). Use env override for production.
    const apiKey = process.env.DATA_GOV_API_KEY || '579b464db66ec23bdd000001f6a6388156efabf05f5f145c4c093978';
    const base = 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070';
    const params = new URLSearchParams({
        'api-key': apiKey,
        format: 'json',
        limit: '100',
        'filters[state]': 'Tamil Nadu'
    });
    if (district) params.set('filters[district]', district);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const res = await fetch(`${base}?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) {
            throw new Error(`Live rate provider failed (HTTP ${res.status})`);
        }
        const data = await res.json();
        const records = normalizeApiRecords(data.records);
        const payload = {
            source: 'data.gov.in/agmarknet',
            location: district || 'Tamil Nadu',
            fetchedAt: new Date().toISOString(),
            records
        };
        _liveRateCache[cacheKey] = { ts: now, payload };
        return payload;
    } finally {
        clearTimeout(timeout);
    }
}

// ===== AUTH / USERS API =====
// Database: database/users.json

app.get('/api/health', asyncHandler(async (req, res) => {
    const users = await readDB('users.json');
    const ok = users !== null;
    res.status(ok ? 200 : 500).json({
        ok,
        databasePath: DB_DIR,
        timestamp: new Date().toISOString()
    });
}));

app.get('/api/users', asyncHandler(async (req, res) => {
    const users = await readDB('users.json') || [];
    const safeUsers = users.map(({ password, ...rest }) => rest);
    res.json(safeUsers);
}));

app.post('/api/auth/register', asyncHandler(async (req, res) => {
    const { userId, name, email, role, password } = req.body;
    
    // Validate required fields
    const validUserId = validateString(userId, 3, 50);
    const validName = validateString(name, 2, 100);
    const validEmail = validateEmail(email);
    const validRole = role && ['farmer', 'buyer', 'seller', 'doctor'].includes(role) ? role : null;
    const validPassword = validateString(password, 6, 100);
    
    if (!validUserId || !validName || !validEmail || !validRole || !validPassword) {
        return res.status(400).json({ 
            error: 'Invalid input. Requirements: userId (3-50 chars), name (2-100 chars), valid email, valid role (farmer/buyer/seller/doctor), password (6-100 chars).' 
        });
    }

    const users = await readDB('users.json') || [];

    if (users.some(u => u.userId.toLowerCase() === validUserId.toLowerCase())) {
        return res.status(409).json({ error: 'This User ID is already registered.' });
    }
    if (users.some(u => u.email.toLowerCase() === validEmail.toLowerCase())) {
        return res.status(409).json({ error: 'This email is already registered.' });
    }
    if (users.some(u => u.name.toLowerCase() === validName.toLowerCase() && u.role === validRole)) {
        return res.status(409).json({ error: 'An account with this name already exists for this role.' });
    }

    const newUser = { 
        userId: validUserId, 
        name: validName, 
        email: validEmail, 
        role: validRole, 
        password: validPassword, 
        registeredAt: new Date().toISOString() 
    };
    users.push(newUser);
    await writeDB('users.json', users);
    res.status(201).json({ message: 'Registration successful.' });
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
    const { userId, password } = req.body;
    
    // Validate input
    const validUserId = validateString(userId, 1, 100);
    const validPassword = validateString(password, 1, 100);
    
    if (!validUserId || !validPassword) {
        return res.status(400).json({ error: 'User ID and password are required.' });
    }

    const ADMIN_ID = 'Tamil';
    const ADMIN_PASSWORD = '1306';
    if (validUserId === ADMIN_ID && validPassword === ADMIN_PASSWORD) {
        return res.json({ role: 'admin', userId: validUserId, name: 'Admin' });
    }

    const users = await readDB('users.json') || [];
    const user = users.find(u => u.userId === validUserId);
    if (!user) return res.status(404).json({ error: 'Account not found. Please register first.' });
    if (user.password !== validPassword) return res.status(401).json({ error: 'Incorrect password.' });

    res.json({ role: user.role, userId: user.userId, name: user.name });
}));

app.get('/api/users/export', asyncHandler(async (req, res) => {
    const users = await readDB('users.json') || [];
    const headers = ['User ID', 'Name', 'Email', 'Role', 'Registered At'];
    let csv = headers.join(',') + '\n';
    users.forEach(u => {
        const row = [u.userId, u.name, u.email, u.role, u.registeredAt || ''];
        csv += row.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',') + '\n';
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=registered_users.csv');
    res.send(csv);
}));

// ===== CROPS DATABASE API =====
// Database: database/crops.json

app.get('/api/crops', asyncHandler(async (req, res) => {
    const crops = await readDB('crops.json') || [];
    res.json(crops);
}));

// ===== MARKET PRODUCTS API =====
// Database: database/market_products.json

app.get('/api/market-products', asyncHandler(async (req, res) => {
    let products = await readDB('market_products.json') || [];
    const { location } = req.query;
    if (location) {
        products = products.filter(p => p.location && p.location.toLowerCase() === location.toLowerCase());
    }
    res.json(products);
}));

app.post('/api/market-products', asyncHandler(async (req, res) => {
    const validated = validateProduct(req.body);
    if (!validated) {
        return res.status(400).json({ 
            error: 'Invalid product data. Required: name (2-100), price (0-1000000), quantity (0-100000), location (1-100).' 
        });
    }
    
    const products = await readDB('market_products.json') || [];
    const newProduct = { id: `p${Date.now()}`, ...validated };
    products.unshift(newProduct);
    await writeDB('market_products.json', products);
    res.status(201).json(newProduct);
}));

// ===== GEOSPATIAL HELPER =====
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function estimateTransportRs(km) {
    // ₹8/km base rate (Tamil Nadu mini-truck / tractor transport avg)
    if (km <= 0) return 0;
    if (km < 2) return Math.round(km * 15); // local / < 2km
    return Math.round(km * 8);
}

// ===== NEARBY MARKET PRODUCTS API =====
// GET /api/market-products/nearby?lat=...&lng=...&radiusKm=50&sortBy=nearest|price&maxResults=50
app.get('/api/market-products/nearby', asyncHandler(async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radiusKm = parseFloat(req.query.radiusKm) || 50;
    const sortBy = req.query.sortBy || 'nearest';
    const maxResults = Math.min(parseInt(req.query.maxResults) || 50, 200);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ error: 'Valid lat and lng query parameters are required.' });
    }

    const products = await readDB('market_products.json') || [];

    // Filter to products with valid coords and within radius
    const nearby = [];
    for (const p of products) {
        const pLat = p.coords?.lat;
        const pLng = p.coords?.lng;
        if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) continue;

        const distanceKm = haversineKm(lat, lng, pLat, pLng);
        if (distanceKm > radiusKm) continue;

        const transportEstimateRs = estimateTransportRs(distanceKm);
        nearby.push({ ...p, distanceKm: Math.round(distanceKm * 10) / 10, transportEstimateRs });
    }

    // Sort
    if (sortBy === 'price') {
        nearby.sort((a, b) => {
            const priceA = Number(a.packPrice || a.pricePer100g || 0);
            const priceB = Number(b.packPrice || b.pricePer100g || 0);
            return priceB - priceA; // highest price first
        });
    } else {
        nearby.sort((a, b) => a.distanceKm - b.distanceKm); // nearest first
    }

    res.json(nearby.slice(0, maxResults));
}));

app.put('/api/market-products/:id', asyncHandler(async (req, res) => {
    const validated = validateProduct(req.body);
    if (!validated) {
        return res.status(400).json({ 
            error: 'Invalid product data. Required: name (2-100), price (0-1000000), quantity (0-100000), location (1-100).' 
        });
    }
    
    const products = await readDB('market_products.json') || [];
    const index = products.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Product not found.' });
    products[index] = { ...products[index], ...validated };
    await writeDB('market_products.json', products);
    res.json(products[index]);
}));

app.delete('/api/market-products/:id', asyncHandler(async (req, res) => {
    let products = await readDB('market_products.json') || [];
    const product = products.find(p => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    products = products.filter(p => p.id !== req.params.id);
    await writeDB('market_products.json', products);
    res.json(product);
}));

// ===== FERTILIZERS API =====
// Database: database/fertilizers.json

app.get('/api/fertilizers', asyncHandler(async (req, res) => {
    let items = await readDB('fertilizers.json') || [];
    const { location } = req.query;
    if (location) {
        items = items.filter(f => f.location && f.location.toLowerCase() === location.toLowerCase());
    }
    res.json(items);
}));

app.post('/api/fertilizers', asyncHandler(async (req, res) => {
    const validated = validateFertilizerItem(req.body);
    if (!validated) {
        return res.status(400).json({ 
            error: 'Invalid fertilizer data. Required: name (2-100), type (2-50), price (0-1000000), location (1-100).' 
        });
    }
    
    const items = await readDB('fertilizers.json') || [];
    const newItem = { id: `f${Date.now()}`, ...validated };
    items.unshift(newItem);
    await writeDB('fertilizers.json', items);
    res.status(201).json(newItem);
}));

app.delete('/api/fertilizers/:id', asyncHandler(async (req, res) => {
    let items = await readDB('fertilizers.json') || [];
    items = items.filter(f => f.id !== req.params.id);
    await writeDB('fertilizers.json', items);
    res.json({ message: 'Deleted.' });
}));

// ===== CATTLE FEEDS API =====
// Database: database/cattle_feeds.json

app.get('/api/cattle-feeds', asyncHandler(async (req, res) => {
    let items = await readDB('cattle_feeds.json') || [];
    const { location } = req.query;
    if (location) {
        items = items.filter(f => f.location && f.location.toLowerCase() === location.toLowerCase());
    }
    res.json(items);
}));

app.post('/api/cattle-feeds', asyncHandler(async (req, res) => {
    const validated = validateFertilizerItem(req.body);
    if (!validated) {
        return res.status(400).json({ 
            error: 'Invalid cattle feed data. Required: name (2-100), type (2-50), price (0-1000000), location (1-100).' 
        });
    }
    
    const items = await readDB('cattle_feeds.json') || [];
    const newItem = { id: `cf${Date.now()}`, ...validated };
    items.unshift(newItem);
    await writeDB('cattle_feeds.json', items);
    res.status(201).json(newItem);
}));

app.delete('/api/cattle-feeds/:id', asyncHandler(async (req, res) => {
    let items = await readDB('cattle_feeds.json') || [];
    items = items.filter(f => f.id !== req.params.id);
    await writeDB('cattle_feeds.json', items);
    res.json({ message: 'Deleted.' });
}));

// ===== CATTLE PRODUCTS API =====
// Database: database/cattle_products.json

app.get('/api/cattle-products', asyncHandler(async (req, res) => {
    let items = await readDB('cattle_products.json') || [];
    const { location } = req.query;
    if (location) {
        items = items.filter(p => p.location && p.location.toLowerCase() === location.toLowerCase());
    }
    res.json(items);
}));

app.post('/api/cattle-products', asyncHandler(async (req, res) => {
    const validated = validateFertilizerItem(req.body);
    if (!validated) {
        return res.status(400).json({ 
            error: 'Invalid cattle product data. Required: name (2-100), type (2-50), price (0-1000000), location (1-100).' 
        });
    }
    
    const items = await readDB('cattle_products.json') || [];
    const newItem = { id: `cp${Date.now()}`, ...validated };
    items.unshift(newItem);
    await writeDB('cattle_products.json', items);
    res.status(201).json(newItem);
}));

app.delete('/api/cattle-products/:id', asyncHandler(async (req, res) => {
    let items = await readDB('cattle_products.json') || [];
    items = items.filter(p => p.id !== req.params.id);
    await writeDB('cattle_products.json', items);
    res.json({ message: 'Deleted.' });
}));

// ===== PROFILES API =====
// Database: database/profiles.json

app.get('/api/profiles/:userId', asyncHandler(async (req, res) => {
    const profiles = await readDB('profiles.json') || {};
    const profile = profiles[req.params.userId] || null;
    res.json(profile);
}));

app.put('/api/profiles/:userId', asyncHandler(async (req, res) => {
    const userId = validateString(req.params.userId, 1, 100);
    if (!userId) {
        return res.status(400).json({ error: 'Invalid user ID.' });
    }
    
    const validated = validateProfile(req.body);
    if (!validated) {
        return res.status(400).json({ 
            error: 'Invalid profile data. farmName (2-100), location (1-100), phone (10-15 digits), bio (0-500), crops (array).' 
        });
    }
    
    const profiles = await readDB('profiles.json') || {};
    profiles[userId] = { ...(profiles[userId] || {}), ...validated };
    await writeDB('profiles.json', profiles);
    res.json(profiles[userId]);
}));

// ===== GLOBAL: DOCTORS API =====
// Database: database/doctors.json

app.get('/api/doctors', asyncHandler(async (req, res) => {
    let doctors = await readDB('doctors.json') || [];
    const { location } = req.query;
    if (location) {
        doctors = doctors.filter(d => d.location && d.location.toLowerCase() === location.toLowerCase());
    }
    res.json(doctors);
}));

// ===== GLOBAL: CATTLE DISEASES API =====
// Database: database/cattle_diseases.json

app.get('/api/cattle-diseases', asyncHandler(async (req, res) => {
    const diseases = await readDB('cattle_diseases.json') || {};
    res.json(diseases);
}));

app.get('/api/cattle-diseases/:animalType', asyncHandler(async (req, res) => {
    const diseases = await readDB('cattle_diseases.json') || {};
    const animalDiseases = diseases[req.params.animalType] || [];
    res.json(animalDiseases);
}));

// ===== AI KNOWLEDGE BASE API =====
// Database: database/ai_knowledge.json

app.get('/api/ai-knowledge', asyncHandler(async (req, res) => {
    const kb = await readDB('ai_knowledge.json') || {};
    res.json(kb);
}));

app.get('/api/ai-knowledge/:topic', asyncHandler(async (req, res) => {
    const kb = await readDB('ai_knowledge.json') || {};
    const topicData = kb[req.params.topic] || {};
    res.json(topicData);
}));

app.get('/api/ai-knowledge/:topic/:animalType', asyncHandler(async (req, res) => {
    const kb = await readDB('ai_knowledge.json') || {};
    const data = kb[req.params.topic]?.[req.params.animalType] || null;
    if (!data) return res.status(404).json({ error: 'No data found for this topic and animal type.' });
    res.json(data);
}));

// ===== IMAGE UPLOAD API =====
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

app.post('/api/upload-image', asyncHandler(async (req, res) => {
    const { data, filename } = req.body;
    if (!data) return res.status(400).json({ error: 'No image data provided.' });

    // Validate base64 data URL
    const match = data.match(/^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Invalid image format. Use JPEG, PNG, WEBP, or GIF.' });

    const mimeType = match[1];
    if (!ALLOWED_TYPES.includes(mimeType)) {
        return res.status(400).json({ error: 'Unsupported image type.' });
    }

    const base64Data = match[3];
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > MAX_SIZE) {
        return res.status(400).json({ error: 'Image too large. Max 5MB.' });
    }

    const ext = match[2] === 'jpeg' ? 'jpg' : match[2];
    const safeName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, safeName);

    await fsp.writeFile(filePath, buffer);
    res.json({ url: `image/uploads/${safeName}` });
}));

// ===== LIVE CROP RATES (ONLINE) =====
app.get('/api/live-crop-rates', asyncHandler(async (req, res) => {
    const { location = '' } = req.query;

    const buildLocalFallback = async (reason) => {
        let products = await readDB('market_products.json') || [];
        const district = normalizeDistrictName(location);
        if (district) {
            products = products.filter(p => p.location && String(p.location).toLowerCase() === district.toLowerCase());
        }

        const topProduct = products[0];
        if (!topProduct) {
            return res.status(502).json({
                error: 'Unable to fetch online live crop rates right now.',
                details: reason || 'No online or local rate data found.'
            });
        }

        const per100g = Number(topProduct.pricePer100g || 0);
        const perQuintal = per100g > 0 ? per100g * 1000 : 0;
        return res.json({
            source: 'local-market-fallback',
            location: district || topProduct.location || 'Local',
            fetchedAt: new Date().toISOString(),
            topRate: {
                commodity: topProduct.name,
                district: topProduct.location || district || 'Local',
                market: topProduct.holderName || 'Nature Market',
                brokerPhone: topProduct.holderPhone || '',
                date: new Date().toISOString().slice(0, 10),
                modalPrice: perQuintal || per100g,
                unit: perQuintal ? 'Quintal' : '100g'
            },
            records: products.slice(0, 20).map(p => ({
                commodity: p.name,
                district: p.location || district || 'Local',
                market: p.holderName || 'Nature Market',
                brokerPhone: p.holderPhone || '',
                date: new Date().toISOString().slice(0, 10),
                modalPrice: Number(p.pricePer100g || 0) * 1000,
                unit: 'Quintal'
            }))
        });
    };

    try {
        const payload = await fetchOnlineLiveRates(location);
        if (!payload.records.length) {
            return await buildLocalFallback('No online crop rates found for this location.');
        }

        const top = payload.records[0];
        res.json({
            source: payload.source,
            location: payload.location,
            fetchedAt: payload.fetchedAt,
            topRate: top,
            records: payload.records
        });
    } catch (err) {
        return await buildLocalFallback(err.message);
    }
}));

// ===== ORDERS API =====
// Database: database/orders.json

app.get('/api/orders', asyncHandler(async (req, res) => {
    let orders = await readDB('orders.json') || [];
    const { sellerId } = req.query;
    if (sellerId) {
        orders = orders.filter(o => o.sellerUserId === sellerId);
    }
    res.json(orders);
}));

app.post('/api/orders', asyncHandler(async (req, res) => {
    const validated = validateOrder(req.body);
    if (!validated) {
        return res.status(400).json({ 
            error: 'Invalid order data. Required: buyerUserId (1-100), sellerUserId (1-100), qty (1-100000), totalPrice (0.01-10000000).' 
        });
    }
    
    const orders = await readDB('orders.json') || [];
    const newOrder = {
        id: `ord${Date.now()}`,
        ...validated,
        createdAt: new Date().toISOString()
    };
    orders.push(newOrder);
    await writeDB('orders.json', orders);
    res.status(201).json(newOrder);
}));

// ===== FARMER DASHBOARD AGGREGATION API =====

app.get('/api/dashboard/:userId', asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const [allOrders, allProducts] = await Promise.all([
        readDB('orders.json') || [],
        readDB('market_products.json') || []
    ]);

    const myOrders = (allOrders || []).filter(o => o.sellerUserId === userId);
    const myProducts = (allProducts || []).filter(p =>
        p.holderName && p.holderName.toLowerCase().includes(userId.toLowerCase())
    );

    // Total earnings (completed orders)
    const completedOrders = myOrders.filter(o => o.status === 'completed');
    const totalEarnings = completedOrders.reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);

    // Order status counts
    const orderStatus = {
        completed: myOrders.filter(o => o.status === 'completed').length,
        pending: myOrders.filter(o => o.status === 'pending').length,
        cancelled: myOrders.filter(o => o.status === 'cancelled').length
    };

    // Monthly revenue — last 6 months
    const now = new Date();
    const monthlyRevenue = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = d.getMonth();
        const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        const revenue = completedOrders
            .filter(o => {
                const od = new Date(o.createdAt);
                return od.getFullYear() === year && od.getMonth() === month;
            })
            .reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);
        monthlyRevenue.push({ label, revenue });
    }

    // Best sellers — top 3 products by buys across all market products
    const bestSellers = [...(allProducts || [])]
        .sort((a, b) => (Number(b.buys) || 0) - (Number(a.buys) || 0))
        .slice(0, 3)
        .map(p => ({
            id: p.id,
            name: p.name,
            buys: Number(p.buys) || 0,
            image: p.image || '',
            pricePer100g: Number(p.pricePer100g) || 0
        }));

    // Crops added by this user
    const cropsAdded = myProducts.length;

    // Quick stats
    const totalSales = myOrders.reduce((sum, o) => sum + (Number(o.qty) || 0), 0);
    const ratings = completedOrders.filter(o => o.rating).map(o => Number(o.rating));
    const avgRating = ratings.length
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : 0;

    res.json({
        totalEarnings,
        orderStatus,
        monthlyRevenue,
        bestSellers,
        cropsAdded,
        quickStats: {
            totalSales,
            avgRating,
            totalOrders: myOrders.length,
            completedOrders: completedOrders.length
        }
    });
}));

// ===== ERROR HANDLING MIDDLEWARE =====
app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
});

// ===== START SERVER =====

function getLanUrls(port) {
    const ifaces = os.networkInterfaces();
    const urls = [];
    Object.values(ifaces).forEach((entries) => {
        (entries || []).forEach((entry) => {
            if (!entry || entry.internal) return;
            if (entry.family === 'IPv4') {
                urls.push(`http://${entry.address}:${port}`);
            }
        });
    });
    return urls;
}

async function startServer() {
    await initStorage();

    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n  Farmers Friend Server running at:`);
        console.log(`  -> http://localhost:${PORT}\n`);
        const lanUrls = getLanUrls(PORT);
        if (lanUrls.length) {
            console.log(`  LAN URLs (use one in APK settings prompt):`);
            lanUrls.forEach((url) => console.log(`  -> ${url}`));
            console.log('');
        }
        if (FileStore) {
            console.log('  Database backend: MongoDB Atlas via Mongoose');
        } else {
            console.log(`  Database files in: ${DB_DIR}`);
            console.log(`  - users.json          (Registration data)`);
            console.log(`  - market_products.json (Market page)`);
            console.log(`  - fertilizers.json     (Fertilizer page)`);
            console.log(`  - cattle_feeds.json    (Cattle feeds page)`);
            console.log(`  - cattle_products.json (Cattle products page)`);
            console.log(`  - profiles.json        (User profiles)`);
            console.log(`  - doctors.json         (Global doctor details)`);
            console.log(`  - cattle_diseases.json (Global cattle disease data)`);
        }
        console.log('');
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`\n  ❌ Port ${PORT} is already in use.`);
            console.error(`  Stop the old server first, then restart.\n`);
            console.error(`  Quick fix (PowerShell):`);
            console.error(`    $pid = (netstat -ano | Select-String ":${PORT}.*LISTENING").ToString().Split(' ')[-1]; taskkill /PID $pid /F\n`);
        } else {
            console.error('  ❌ Server error:', err.message);
        }
        process.exit(1);
    });
}

startServer().catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
});
