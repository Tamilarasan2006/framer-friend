/**
 * API Helper - Frontend module for server-side database communication
 * All data operations go through the Express server instead of localStorage.
 */
function normalizeApiBase(url) {
    const value = String(url || '').trim();
    if (!value) return '';
    return value.replace(/\/+$/, '');
}

function buildCordovaApiCandidates() {
    const candidates = [];
    const seen = new Set();

    const pushCandidate = (value) => {
        const normalized = normalizeApiBase(value);
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        candidates.push(normalized);
    };

    const saved = normalizeApiBase(localStorage.getItem('farmersfriend_api_base'));
    if (saved) pushCandidate(saved);

    const fromQuery = normalizeApiBase(new URLSearchParams(window.location.search).get('apiBase'));
    if (fromQuery) {
        localStorage.setItem('farmersfriend_api_base', fromQuery);
        pushCandidate(fromQuery);
    }

    // Injected by sync script for mobile builds (developer machine LAN IP first).
    const injected = Array.isArray(window.FARMERSFRIEND_API_BASES) ? window.FARMERSFRIEND_API_BASES : [];
    injected.forEach(pushCandidate);

    // Hosted fallback as a final internet candidate.
    pushCandidate('https://farmersfriend-api.onrender.com');

    // Localhost fallbacks are opt-in via localStorage for development only.
    const useLocalFallbacks = localStorage.getItem('farmersfriend_allow_local_fallbacks') === '1';
    if (useLocalFallbacks) {
        pushCandidate('http://10.0.2.2:3000');
        pushCandidate('http://localhost:3000');
        pushCandidate('http://127.0.0.1:3000');
    }

    return candidates;
}

function isMobileRuntime() {
    if (window.cordova) return true;
    if (window.location.protocol === 'file:') return true;
    return false;
}

function resolveApiBase() {
    if (isMobileRuntime()) {
        const candidates = buildCordovaApiCandidates();
        return candidates[0] || 'http://10.0.2.2:3000';
    }

    const saved = normalizeApiBase(localStorage.getItem('farmersfriend_api_base'));
    if (saved) return saved;

    const fromQuery = normalizeApiBase(new URLSearchParams(window.location.search).get('apiBase'));
    if (fromQuery) {
        localStorage.setItem('farmersfriend_api_base', fromQuery);
        return fromQuery;
    }

    return window.location.port === '3000' ? '' : 'http://localhost:3000';
}

let API_BASE = resolveApiBase();

function setApiBase(nextBase) {
    API_BASE = normalizeApiBase(nextBase);
    if (API_BASE) {
        localStorage.setItem('farmersfriend_api_base', API_BASE);
    } else {
        localStorage.removeItem('farmersfriend_api_base');
        API_BASE = resolveApiBase();
    }
    return API_BASE;
}

async function safeJson(res, fallback = null) {
    try {
        const text = await res.text();
        return text ? JSON.parse(text) : fallback;
    } catch {
        return fallback;
    }
}

function buildHttpError(res, data, fallbackMessage) {
    const msg = data && typeof data === 'object' && data.error
        ? data.error
        : `${fallbackMessage} (HTTP ${res.status})`;
    return new Error(msg);
}

const OFFLINE_DB_KEY = 'farmersfriend_device_db_v1';
let offlineDbCache = null;
let offlineDbInitPromise = null;

function cloneData(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
}

function parseBodyJson(options) {
    if (!options || !options.body || typeof options.body !== 'string') return {};
    try {
        return JSON.parse(options.body);
    } catch {
        return {};
    }
}

function filterByLocation(items, location) {
    if (!location) return items;
    const needle = String(location).trim().toLowerCase();
    return (items || []).filter((item) =>
        String(item.location || '').trim().toLowerCase() === needle
    );
}

function persistOfflineDb() {
    if (!offlineDbCache) return;
    localStorage.setItem(OFFLINE_DB_KEY, JSON.stringify(offlineDbCache));
}

async function readSeedJson(relativePath, fallbackValue) {
    try {
        const res = await fetch(relativePath);
        if (!res.ok) return cloneData(fallbackValue);
        return await res.json();
    } catch {
        return cloneData(fallbackValue);
    }
}

async function ensureOfflineDb() {
    if (offlineDbCache) return offlineDbCache;
    if (offlineDbInitPromise) return offlineDbInitPromise;

    offlineDbInitPromise = (async () => {
        const savedRaw = localStorage.getItem(OFFLINE_DB_KEY);
        if (savedRaw) {
            try {
                offlineDbCache = JSON.parse(savedRaw);
                return offlineDbCache;
            } catch {
                localStorage.removeItem(OFFLINE_DB_KEY);
            }
        }

        const seeded = {
            users: await readSeedJson('database/users.json', []),
            crops: await readSeedJson('database/crops.json', []),
            marketProducts: await readSeedJson('database/market_products.json', []),
            fertilizers: await readSeedJson('database/fertilizers.json', []),
            cattleFeeds: await readSeedJson('database/cattle_feeds.json', []),
            cattleProducts: await readSeedJson('database/cattle_products.json', []),
            profiles: await readSeedJson('database/profiles.json', {}),
            doctors: await readSeedJson('database/doctors.json', []),
            cattleDiseases: await readSeedJson('database/cattle_diseases.json', {}),
            aiKnowledge: await readSeedJson('database/ai_knowledge.json', {})
        };

        offlineDbCache = seeded;
        persistOfflineDb();
        return offlineDbCache;
    })().finally(() => {
        offlineDbInitPromise = null;
    });

    return offlineDbInitPromise;
}

function nextId(prefix) {
    return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function offlineRequest(url, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const body = parseBodyJson(options);
    const parsed = new URL(url, window.location.origin);
    const pathname = parsed.pathname;
    const location = parsed.searchParams.get('location') || '';
    const db = await ensureOfflineDb();

    if (pathname === '/api/health' && method === 'GET') {
        return {
            ok: true,
            mode: 'offline-device',
            timestamp: new Date().toISOString()
        };
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
        const userId = String(body.userId || '').trim();
        const password = String(body.password || '');
        if (!userId || !password) throw new Error('User ID and password are required.');

        if (userId === 'Tamil' && password === '1306') {
            return { role: 'admin', userId: 'Tamil', name: 'Admin' };
        }

        const user = (db.users || []).find((u) => u.userId === userId);
        if (!user) throw new Error('Account not found. Please register first.');
        if (user.password !== password) throw new Error('Incorrect password.');

        return { role: user.role, userId: user.userId, name: user.name };
    }

    if (pathname === '/api/auth/register' && method === 'POST') {
        const userId = String(body.userId || '').trim();
        const name = String(body.name || '').trim();
        const email = String(body.email || '').trim();
        const role = String(body.role || '').trim();
        const password = String(body.password || '').trim();

        if (!userId || !name || !email || !role || !password) {
            throw new Error('All fields are required.');
        }

        const users = db.users || [];
        if (users.some((u) => String(u.userId || '').toLowerCase() === userId.toLowerCase())) {
            throw new Error('This User ID is already registered.');
        }
        if (users.some((u) => String(u.email || '').toLowerCase() === email.toLowerCase())) {
            throw new Error('This email is already registered.');
        }
        if (users.some((u) => String(u.name || '').toLowerCase() === name.toLowerCase() && u.role === role)) {
            throw new Error('An account with this name already exists for this role.');
        }

        users.push({
            userId,
            name,
            email,
            role,
            password,
            registeredAt: new Date().toISOString()
        });
        db.users = users;
        persistOfflineDb();
        return { message: 'Registration successful.' };
    }

    if (pathname === '/api/users' && method === 'GET') {
        return (db.users || []).map(({ password, ...rest }) => rest);
    }

    if (pathname === '/api/crops' && method === 'GET') {
        return cloneData(db.crops || []);
    }

    if (pathname === '/api/market-products' && method === 'GET') {
        return cloneData(filterByLocation(db.marketProducts || [], location));
    }

    if (pathname === '/api/market-products' && method === 'POST') {
        const product = { ...body };
        if (!product.id) product.id = nextId('p');
        db.marketProducts = db.marketProducts || [];
        db.marketProducts.push(product);
        persistOfflineDb();
        return cloneData(product);
    }

    const marketMatch = pathname.match(/^\/api\/market-products\/([^/]+)$/);
    if (marketMatch && method === 'PUT') {
        const id = decodeURIComponent(marketMatch[1]);
        const index = (db.marketProducts || []).findIndex((item) => String(item.id) === id);
        if (index === -1) throw new Error('Market product not found.');
        db.marketProducts[index] = { ...db.marketProducts[index], ...body };
        persistOfflineDb();
        return cloneData(db.marketProducts[index]);
    }
    if (marketMatch && method === 'DELETE') {
        const id = decodeURIComponent(marketMatch[1]);
        db.marketProducts = (db.marketProducts || []).filter((item) => String(item.id) !== id);
        persistOfflineDb();
        return { message: 'Deleted successfully.' };
    }

    if (pathname === '/api/live-crop-rates' && method === 'GET') {
        return {
            source: 'offline-device',
            location: location || 'local',
            fetchedAt: new Date().toISOString(),
            records: []
        };
    }

    if (pathname === '/api/fertilizers' && method === 'GET') {
        return cloneData(filterByLocation(db.fertilizers || [], location));
    }
    if (pathname === '/api/fertilizers' && method === 'POST') {
        const item = { ...body };
        if (!item.id) item.id = nextId('f');
        db.fertilizers = db.fertilizers || [];
        db.fertilizers.push(item);
        persistOfflineDb();
        return cloneData(item);
    }

    if (pathname === '/api/cattle-feeds' && method === 'GET') {
        return cloneData(filterByLocation(db.cattleFeeds || [], location));
    }
    if (pathname === '/api/cattle-feeds' && method === 'POST') {
        const item = { ...body };
        if (!item.id) item.id = nextId('cf');
        db.cattleFeeds = db.cattleFeeds || [];
        db.cattleFeeds.push(item);
        persistOfflineDb();
        return cloneData(item);
    }

    if (pathname === '/api/cattle-products' && method === 'GET') {
        return cloneData(filterByLocation(db.cattleProducts || [], location));
    }
    if (pathname === '/api/cattle-products' && method === 'POST') {
        const item = { ...body };
        if (!item.id) item.id = nextId('cp');
        db.cattleProducts = db.cattleProducts || [];
        db.cattleProducts.push(item);
        persistOfflineDb();
        return cloneData(item);
    }

    const profileMatch = pathname.match(/^\/api\/profiles\/([^/]+)$/);
    if (profileMatch && method === 'GET') {
        const userId = decodeURIComponent(profileMatch[1]);
        return cloneData((db.profiles || {})[userId] || null);
    }
    if (profileMatch && method === 'PUT') {
        const userId = decodeURIComponent(profileMatch[1]);
        db.profiles = db.profiles || {};
        db.profiles[userId] = { ...(db.profiles[userId] || {}), ...body };
        persistOfflineDb();
        return cloneData(db.profiles[userId]);
    }

    if (pathname === '/api/doctors' && method === 'GET') {
        return cloneData(filterByLocation(db.doctors || [], location));
    }

    if (pathname === '/api/cattle-diseases' && method === 'GET') {
        return cloneData(db.cattleDiseases || {});
    }
    const diseaseMatch = pathname.match(/^\/api\/cattle-diseases\/([^/]+)$/);
    if (diseaseMatch && method === 'GET') {
        const animalType = decodeURIComponent(diseaseMatch[1]);
        return cloneData((db.cattleDiseases || {})[animalType] || []);
    }

    if (pathname === '/api/ai-knowledge' && method === 'GET') {
        return cloneData(db.aiKnowledge || {});
    }
    const aiMatch = pathname.match(/^\/api\/ai-knowledge\/([^/]+)(?:\/([^/]+))?$/);
    if (aiMatch && method === 'GET') {
        const topic = decodeURIComponent(aiMatch[1]);
        const animalType = aiMatch[2] ? decodeURIComponent(aiMatch[2]) : '';
        const topicData = (db.aiKnowledge || {})[topic];
        if (!topicData) return animalType ? null : {};
        if (!animalType) return cloneData(topicData);
        return cloneData(topicData[animalType] || null);
    }

    if (pathname === '/api/upload-image' && method === 'POST') {
        return { url: String(body.data || '') };
    }

    throw new Error(`Offline mode: endpoint not supported (${method} ${pathname}).`);
}

async function requestJson(url, options = {}, fallback = null, fallbackMessage = 'Request failed') {
    let res;
    try {
        res = await fetch(url, options);
    } catch {
        if (isMobileRuntime() && /^https?:\/\//i.test(url)) {
            const currentBase = normalizeApiBase(API_BASE);
            const pathPart = currentBase && url.startsWith(currentBase)
                ? url.slice(currentBase.length)
                : null;

            if (pathPart) {
                const retries = buildCordovaApiCandidates().filter(base => base !== currentBase);
                for (const nextBase of retries) {
                    try {
                        res = await fetch(`${nextBase}${pathPart}`, options);
                        setApiBase(nextBase);
                        break;
                    } catch {
                        // Try next candidate.
                    }
                }
            }
        }

        if (!res) {
            if (isMobileRuntime()) {
                return await offlineRequest(url, options);
            }
            throw new Error(
                `Cannot connect to backend server at ${API_BASE || 'same-origin'}. ` +
                'Set API URL with localStorage key farmersfriend_api_base (example: http://192.168.1.5:3000).'
            );
        }
    }

    let data = await safeJson(res, fallback);
    if (!res.ok) {
        // In mobile runtime, if the current base is wrong, try other candidates
        // before failing. Keep explicit API business errors (JSON error payload)
        // as-is so users still see meaningful auth/validation messages.
        if (isMobileRuntime() && /^https?:\/\//i.test(url)) {
            const currentBase = normalizeApiBase(API_BASE);
            const pathPart = currentBase && url.startsWith(currentBase)
                ? url.slice(currentBase.length)
                : null;

            const hasExplicitApiError = !!(data && typeof data === 'object' && data.error);
            const shouldRetry = !hasExplicitApiError && res.status >= 400;

            if (pathPart && shouldRetry) {
                const retries = buildCordovaApiCandidates().filter(base => base !== currentBase);
                for (const nextBase of retries) {
                    try {
                        const nextRes = await fetch(`${nextBase}${pathPart}`, options);
                        const nextData = await safeJson(nextRes, fallback);
                        if (nextRes.ok) {
                            setApiBase(nextBase);
                            return nextData;
                        }

                        // Stop on explicit API error from a reachable backend.
                        if (nextData && typeof nextData === 'object' && nextData.error) {
                            setApiBase(nextBase);
                            throw buildHttpError(nextRes, nextData, fallbackMessage);
                        }
                    } catch {
                        // Try next candidate.
                    }
                }
            }
        }

        if (isMobileRuntime()) {
            const hasExplicitApiError = !!(data && typeof data === 'object' && data.error);
            if (!hasExplicitApiError) {
                return await offlineRequest(url, options);
            }
        }

        throw buildHttpError(res, data, fallbackMessage);
    }

    return data;
}

const API = {
    getBaseUrl() {
        return API_BASE;
    },

    setBaseUrl(url) {
        return setApiBase(url);
    },

    async healthCheck() {
        return await requestJson(`${API_BASE}/api/health`, {}, { ok: false }, 'Backend health check failed');
    },

    // ===== AUTH =====
    async login(userId, password) {
        const data = await requestJson(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, password })
        }, {}, 'Login failed');
        return data;
    },

    async register(userData) {
        const data = await requestJson(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        }, {}, 'Registration failed');
        return data;
    },

    // ===== CROPS DATABASE =====
    async getCrops() {
        return await requestJson(`${API_BASE}/api/crops`, {}, [], 'Failed to load crops database');
    },

    // ===== MARKET PRODUCTS =====
    async getMarketProducts(location) {
        const params = location ? `?location=${encodeURIComponent(location)}` : '';
        return await requestJson(`${API_BASE}/api/market-products${params}`, {}, [], 'Failed to load market products');
    },

    async getLiveCropRates(location) {
        const params = location ? `?location=${encodeURIComponent(location)}` : '';
        return await requestJson(`${API_BASE}/api/live-crop-rates${params}`, {}, null, 'Failed to load live crop rates');
    },

    async addMarketProduct(product) {
        return await requestJson(`${API_BASE}/api/market-products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        }, {}, 'Failed to add market product');
    },

    async updateMarketProduct(id, updates) {
        return await requestJson(`${API_BASE}/api/market-products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        }, {}, 'Failed to update market product');
    },

    async deleteMarketProduct(id) {
        return await requestJson(`${API_BASE}/api/market-products/${id}`, {
            method: 'DELETE'
        }, {}, 'Failed to delete market product');
    },

    // ===== FERTILIZERS =====
    async getFertilizers(location) {
        const params = location ? `?location=${encodeURIComponent(location)}` : '';
        return await requestJson(`${API_BASE}/api/fertilizers${params}`, {}, [], 'Failed to load fertilizers');
    },

    async addFertilizer(item) {
        return await requestJson(`${API_BASE}/api/fertilizers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        }, {}, 'Failed to add fertilizer');
    },

    // ===== CATTLE FEEDS =====
    async getCattleFeeds(location) {
        const params = location ? `?location=${encodeURIComponent(location)}` : '';
        return await requestJson(`${API_BASE}/api/cattle-feeds${params}`, {}, [], 'Failed to load cattle feeds');
    },

    async addCattleFeed(item) {
        return await requestJson(`${API_BASE}/api/cattle-feeds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        }, {}, 'Failed to add cattle feed');
    },

    // ===== CATTLE PRODUCTS =====
    async getCattleProducts(location) {
        const params = location ? `?location=${encodeURIComponent(location)}` : '';
        return await requestJson(`${API_BASE}/api/cattle-products${params}`, {}, [], 'Failed to load cattle products');
    },

    async addCattleProduct(item) {
        return await requestJson(`${API_BASE}/api/cattle-products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        }, {}, 'Failed to add cattle product');
    },

    // ===== PROFILES =====
    async getProfile(userId) {
        return await requestJson(`${API_BASE}/api/profiles/${encodeURIComponent(userId)}`, {}, null, 'Failed to load profile');
    },

    async saveProfile(userId, data) {
        return await requestJson(`${API_BASE}/api/profiles/${encodeURIComponent(userId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }, {}, 'Failed to save profile');
    },

    // ===== GLOBAL: DOCTORS =====
    async getDoctors(location) {
        const params = location ? `?location=${encodeURIComponent(location)}` : '';
        return await requestJson(`${API_BASE}/api/doctors${params}`, {}, [], 'Failed to load doctors');
    },

    // ===== GLOBAL: CATTLE DISEASES =====
    async getCattleDiseases(animalType) {
        const url = animalType
            ? `${API_BASE}/api/cattle-diseases/${encodeURIComponent(animalType)}`
            : `${API_BASE}/api/cattle-diseases`;
        return await requestJson(url, {}, animalType ? [] : {}, 'Failed to load cattle diseases');
    },

    // ===== AI KNOWLEDGE BASE =====
    async getAIKnowledge() {
        return await requestJson(`${API_BASE}/api/ai-knowledge`, {}, {}, 'Failed to load AI knowledge');
    },

    async getAIKnowledgeTopic(topic, animalType) {
        const url = animalType
            ? `${API_BASE}/api/ai-knowledge/${encodeURIComponent(topic)}/${encodeURIComponent(animalType)}`
            : `${API_BASE}/api/ai-knowledge/${encodeURIComponent(topic)}`;
        return await requestJson(url, {}, animalType ? null : {}, 'Failed to load AI topic');
    },

    // ===== USERS (Admin) =====
    async getUsers() {
        return await requestJson(`${API_BASE}/api/users`, {}, [], 'Failed to load users');
    },

    exportUsersUrl() {
        return `${API_BASE}/api/users/export`;
    },

    // ===== IMAGE UPLOAD =====
    async uploadImage(base64Data) {
        const result = await requestJson(`${API_BASE}/api/upload-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: base64Data })
        }, {}, 'Upload failed');
        return result.url;
    }
};
