const candidates = [
    process.env.MOBILE_API_BASE,
    process.env.RENDER_API_BASE,
    process.env.API_BASE_URL,
    'https://farmersfriend-api.onrender.com'
]
    .map((value) => String(value || '').trim().replace(/\/+$/, ''))
    .filter(Boolean);

async function checkHealth(baseUrl) {
    const target = `${baseUrl}/api/health`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
        const res = await fetch(target, { signal: controller.signal });
        if (!res.ok) {
            return { ok: false, reason: `HTTP ${res.status}` };
        }

        const data = await res.json().catch(() => ({}));
        if (data && data.ok === true) {
            return { ok: true, reason: 'ok' };
        }

        return { ok: false, reason: 'health endpoint returned unexpected payload' };
    } catch (err) {
        return { ok: false, reason: err.message };
    } finally {
        clearTimeout(timeout);
    }
}

(async () => {
    for (const base of candidates) {
        const result = await checkHealth(base);
        if (result.ok) {
            console.log(`Hosted backend check passed: ${base}`);
            process.exit(0);
        }
        console.warn(`Backend check failed for ${base}: ${result.reason}`);
    }

    console.error(
        'No reachable hosted backend found. Set MOBILE_API_BASE to your live API URL before building the APK.'
    );
    process.exit(1);
})();
