// api/badge.js
const fetch = require('node-fetch');

module.exports = async (req, res) => {
    try {
        // Ambil semua query parameter dari request
        const queryParams = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
        
        // Bangun URL ke endpoint badge-json
        // Gunakan base URL dari environment variable atau deteksi otomatis
        const host = req.headers.host;
        const protocol = host.startsWith('localhost') ? 'http' : 'https';
        const baseUrl = `${protocol}://${host}`;
            
        const jsonEndpointUrl = `${baseUrl}/api/badge-json${queryParams}`;
        
        // Bangun URL ke custom-icon-badges
        const badgeServiceUrl = `https://custom-icon-badges.demolab.com/endpoint?url=${encodeURIComponent(jsonEndpointUrl)}`;
        
        // Fetch badge SVG dari layanan custom-icon-badges
        const response = await fetch(badgeServiceUrl);
        
        if (!response.ok) {
            // Jika gagal, kirimkan SVG error sederhana
            res.setHeader('Content-Type', 'image/svg+xml');
            res.setHeader('Cache-Control', 'no-cache');
            return res.send(`
                <svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
                    <rect width="120" height="20" fill="#e05d44"/>
                    <text x="5" y="14" fill="#fff" font-family="sans-serif" font-size="11">Badge Error</text>
                </svg>
            `);
        }
        
        // Ambil konten SVG
        const svgContent = await response.text();
        
        // Set header yang sesuai
        res.setHeader('Content-Type', 'image/svg+xml');
        // Cache selama 1 jam (3600 detik)
        res.setHeader('Cache-Control', 'public, max-age=3600');
        
        // Kirim SVG
        res.send(svgContent);
        
    } catch (error) {
        console.error('[ERROR] Badge rendering failed:', error);
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(`
            <svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
                <rect width="120" height="20" fill="#e05d44"/>
                <text x="5" y="14" fill="#fff" font-family="sans-serif" font-size="11">Service Error</text>
            </svg>
        `);
    }
};
