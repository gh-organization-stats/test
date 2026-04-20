// api/badge.js
const fetch = require('node-fetch');

const BADGE_SERVICE_BASE = 'https://custom-icon-badges.demolab.com';

module.exports = async (req, res) => {
    try {
        const targetPath = req.url.replace('/api/badge', '');
        const targetUrl = `${BADGE_SERVICE_BASE}${targetPath}`;
        
        console.log(`[INFO] Proxying to: ${targetUrl}`);
        
        const response = await fetch(targetUrl);
        
        // Teruskan response upstream apa adanya (termasuk error badge)
        if (!response.ok) {
            console.warn(`[WARN] Upstream returned ${response.status}`);
        }
        
        const svgContent = await response.text();
        
        res.setHeader('Content-Type', response.headers.get('content-type') || 'image/svg+xml');
        const cacheControl = response.headers.get('cache-control');
        res.setHeader('Cache-Control', cacheControl || 'public, max-age=3600');
        res.status(response.status).send(svgContent);
        
    } catch (error) {
        console.error(`[ERROR] Proxy error: ${error.message}`);
        
        // Untuk error proxy, kita buat badge menggunakan layanan yang sama
        const errorBadgeUrl = `${BADGE_SERVICE_BASE}/badge/Proxy-Error-red?style=flat`;
        
        try {
            const errorResponse = await fetch(errorBadgeUrl);
            if (errorResponse.ok) {
                const errorSvg = await errorResponse.text();
                res.setHeader('Content-Type', 'image/svg+xml');
                res.setHeader('Cache-Control', 'no-cache');
                return res.status(500).send(errorSvg);
            }
        } catch (fetchError) {
            // Fallback terakhir jika fetch error badge juga gagal
            console.error('[ERROR] Could not fetch error badge:', fetchError.message);
        }
        
        // Fallback minimal SVG jika semuanya gagal
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'no-cache');
        res.status(500).send(`
            <svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
                <rect width="120" height="20" fill="#e05d44"/>
                <text x="5" y="14" fill="#fff" font-family="sans-serif" font-size="11">Error</text>
            </svg>
        `);
    }
};
