require('dotenv').config({ override: true });

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
    if (!userId || !name || !email || !role || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const users = await readDB('users.json') || [];

    if (users.some(u => u.userId.toLowerCase() === userId.toLowerCase())) {
        return res.status(409).json({ error: 'This User ID is already registered.' });
    }
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        return res.status(409).json({ error: 'This email is already registered.' });
    }
    if (users.some(u => u.name.toLowerCase() === name.toLowerCase() && u.role === role)) {
        return res.status(409).json({ error: 'An account with this name already exists for this role.' });
    }

    const newUser = { userId, name, email, role, password, registeredAt: new Date().toISOString() };
    users.push(newUser);
    await writeDB('users.json', users);
    res.status(201).json({ message: 'Registration successful.' });
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
    const { userId, password } = req.body;
    if (!userId || !password) {
        return res.status(400).json({ error: 'User ID and password are required.' });
    }

    const ADMIN_ID = 'Tamil';
    const ADMIN_PASSWORD = '1306';
    if (userId === ADMIN_ID && password === ADMIN_PASSWORD) {
        return res.json({ role: 'admin', userId, name: 'Admin' });
    }

    const users = await readDB('users.json') || [];
    const user = users.find(u => u.userId === userId);
    if (!user) return res.status(404).json({ error: 'Account not found. Please register first.' });
    if (user.password !== password) return res.status(401).json({ error: 'Incorrect password.' });

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
    const products = await readDB('market_products.json') || [];
    const newProduct = { id: `p${Date.now()}`, ...req.body };
    products.unshift(newProduct);
    await writeDB('market_products.json', products);
    res.status(201).json(newProduct);
}));

app.put('/api/market-products/:id', asyncHandler(async (req, res) => {
    const products = await readDB('market_products.json') || [];
    const index = products.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Product not found.' });
    products[index] = { ...products[index], ...req.body };
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
    const items = await readDB('fertilizers.json') || [];
    const newItem = { id: `f${Date.now()}`, ...req.body };
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
    const items = await readDB('cattle_feeds.json') || [];
    const newItem = { id: `cf${Date.now()}`, ...req.body };
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
    const items = await readDB('cattle_products.json') || [];
    const newItem = { id: `cp${Date.now()}`, ...req.body };
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
    const profiles = await readDB('profiles.json') || {};
    profiles[req.params.userId] = { ...(profiles[req.params.userId] || {}), ...req.body };
    await writeDB('profiles.json', profiles);
    res.json(profiles[req.params.userId]);
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
