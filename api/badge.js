// api/badge.js
const fetch = require('node-fetch');

const BADGE_SERVICE_BASE = 'https://custom-icon-badges.demolab.com';
const GITHUB_API_BASE = 'https://api.github.com';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const githubHeaders = GITHUB_TOKEN ? { 'Authorization': `token ${GITHUB_TOKEN}` } : {};

async function isOrganization(owner) {
    const url = `${GITHUB_API_BASE}/users/${owner}`;
    const response = await fetch(url, { headers: githubHeaders });
    
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Account '${owner}' not found`);
        } else if (response.status === 403) {
            throw new Error('GitHub API rate limit exceeded');
        } else {
            throw new Error(`GitHub API error: ${response.status}`);
        }
    }
    
    const data = await response.json();
    return data.type === 'Organization';
}

module.exports = async (req, res) => {
    try {
        let targetPath = req.url.replace('/api/badge', '');
        
        if (!targetPath.startsWith('/github/')) {
            throw new Error('Invalid path: only /github/* endpoints are allowed');
        }
        
        const segments = targetPath.split('/').filter(s => s !== '');
        if (segments.length < 3) {
            throw new Error('Invalid GitHub endpoint format');
        }
        
        const owner = segments[2];
        
        const orgCheck = await isOrganization(owner);
        if (!orgCheck) {
            throw new Error(`Account '${owner}' is not an organization`);
        }
        
        const targetUrl = `${BADGE_SERVICE_BASE}${targetPath}`;
        console.log(`[INFO] Proxying to: ${targetUrl}`);
        
        const response = await fetch(targetUrl);
        const svgContent = await response.text();
        
        res.setHeader('Content-Type', response.headers.get('content-type') || 'image/svg+xml');
        const cacheControl = response.headers.get('cache-control');
        res.setHeader('Cache-Control', cacheControl || 'public, max-age=3600');
        res.status(response.status).send(svgContent);
        
    } catch (error) {
        console.error(`[ERROR] ${error.message}`);
        
        // Ekstrak parameter 'style' dari query string
        const url = new URL(req.url, `http://${req.headers.host}`);
        const styleParam = url.searchParams.get('style');
        const styleQuery = styleParam ? `?style=${encodeURIComponent(styleParam)}` : '';
        
        // Tentukan pesan error untuk badge
        let errorMessage = 'Proxy Error';
        let statusCode = 500;
        
        if (error.message.includes('only /github/*')) {
            errorMessage = 'Invalid Path';
            statusCode = 400;
        } else if (error.message.includes('Invalid GitHub endpoint')) {
            errorMessage = 'Invalid Endpoint';
            statusCode = 400;
        } else if (error.message.includes('not found')) {
            errorMessage = 'Account Not Found';
            statusCode = 404;
        } else if (error.message.includes('rate limit')) {
            errorMessage = 'Rate Limit Exceeded';
            statusCode = 429;
        } else if (error.message.includes('not an organization')) {
            errorMessage = 'Not an Organization';
            statusCode = 400;
        }
        
        // Buat badge error dengan warna merah dan style sesuai permintaan
        const errorBadgeUrl = `${BADGE_SERVICE_BASE}/badge/${encodeURIComponent(errorMessage)}-red${styleQuery}`;
        
        try {
            const errorResponse = await fetch(errorBadgeUrl);
            if (errorResponse.ok) {
                const errorSvg = await errorResponse.text();
                res.setHeader('Content-Type', 'image/svg+xml');
                res.setHeader('Cache-Control', 'no-cache');
                return res.status(statusCode).send(errorSvg);
            }
        } catch (fetchError) {
            console.error('[ERROR] Could not fetch error badge:', fetchError.message);
        }
        
        // Fallback minimal SVG
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'no-cache');
        res.status(statusCode).send(`
            <svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
                <rect width="120" height="20" fill="#e05d44"/>
                <text x="5" y="14" fill="#fff" font-family="sans-serif" font-size="11">${errorMessage}</text>
            </svg>
        `);
    }
};
