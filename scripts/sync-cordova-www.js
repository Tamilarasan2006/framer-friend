const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.resolve(__dirname, '..');
const wwwDir = path.join(root, 'cordova-app', 'www');

const filesToCopy = [
    'index.html',
    'login.html',
    'product-details.html',
    'script.js',
    'style.css',
    'api.js'
];

const dirsToCopy = [
    'image',
    'database'
];

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function cleanDir(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    for (const entry of fs.readdirSync(dirPath)) {
        const fullPath = path.join(dirPath, entry);
        fs.rmSync(fullPath, { recursive: true, force: true });
    }
}

function copyFileIfExists(relativePath) {
    const src = path.join(root, relativePath);
    const dest = path.join(wwwDir, relativePath);

    if (!fs.existsSync(src)) {
        console.warn(`Skipping missing file: ${relativePath}`);
        return;
    }

    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
}

function copyDirIfExists(relativePath) {
    const src = path.join(root, relativePath);
    const dest = path.join(wwwDir, relativePath);

    if (!fs.existsSync(src)) {
        console.warn(`Skipping missing directory: ${relativePath}`);
        return;
    }

    ensureDir(path.dirname(dest));
    fs.cpSync(src, dest, { recursive: true, force: true });
}

function getPrimaryLanIp() {
    const nets = os.networkInterfaces();
    for (const iface of Object.values(nets)) {
        for (const info of iface || []) {
            if (
                info &&
                info.family === 'IPv4' &&
                !info.internal &&
                /^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(info.address)
            ) {
                return info.address;
            }
        }
    }
    return '';
}

function writeMobileRuntimeConfig() {
    const lanIp = getPrimaryLanIp();
    const bases = [];
    const seen = new Set();
    const pushBase = (value) => {
        const normalized = String(value || '').trim().replace(/\/+$/, '');
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        bases.push(normalized);
    };
    const fromEnv = [
        process.env.MOBILE_API_BASE,
        process.env.RENDER_API_BASE,
        process.env.API_BASE_URL
    ]
        .map((value) => String(value || '').trim().replace(/\/+$/, ''))
        .filter(Boolean);

    // Hosted-first default for global usage.
    fromEnv.forEach(pushBase);

    // Local fallbacks are optional and disabled by default for hosted setups.
    const includeLocalFallbacks = String(process.env.MOBILE_INCLUDE_LOCAL_FALLBACKS || '').trim() === '1';
    if (includeLocalFallbacks) {
        if (lanIp) pushBase(`http://${lanIp}:3000`);
        pushBase('http://10.0.2.2:3000');
    }

    // Keep at least one candidate to avoid empty config if env vars are missing.
    if (bases.length === 0) {
        pushBase('https://farmersfriend-api.onrender.com');
    }

    const cfgPath = path.join(wwwDir, 'mobile-config.js');
    const content = [
        'window.FARMERSFRIEND_API_BASES = [',
        ...bases.map((base) => `  '${base}',`),
        '];',
        ''
    ].join('\n');

    fs.writeFileSync(cfgPath, content, 'utf-8');
}

function injectMobileConfigScript(htmlRelativePath) {
    const filePath = path.join(wwwDir, htmlRelativePath);
    if (!fs.existsSync(filePath)) return;

    const tag = '<script src="mobile-config.js"></script>';
    const text = fs.readFileSync(filePath, 'utf-8');
    if (text.includes(tag)) return;

    const updated = text.replace('</head>', `    ${tag}\n</head>`);
    fs.writeFileSync(filePath, updated, 'utf-8');
}

function main() {
    ensureDir(wwwDir);
    cleanDir(wwwDir);

    filesToCopy.forEach(copyFileIfExists);
    dirsToCopy.forEach(copyDirIfExists);
    writeMobileRuntimeConfig();
    injectMobileConfigScript('index.html');
    injectMobileConfigScript('login.html');
    injectMobileConfigScript('product-details.html');

    console.log('Cordova web assets synced to cordova-app/www');
}

main();
