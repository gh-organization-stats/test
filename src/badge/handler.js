import fetch from 'node-fetch';
import { BADGE_SERVICE_BASE } from '../config.js';
import { isOrganization, fetchAllOrgRepos } from '../github/api.js';
import { calculateOrgStats, metricConfig } from '../github/org-stats.js';
import { formatNumber, formatSize } from '../lib/formatters.js';

/**
 * Mengekstrak owner dari path berdasarkan aturan Shields.io.
 * @param {string[]} segments - Array segmen path (tanpa '/api/badge')
 * @returns {string} - Nama owner
 */
function extractOwner(segments) {
    if (segments.length === 2) {
        // Format: /{metric}/{owner}
        return segments[1];
    } else if (segments.length >= 3) {
        // Format: /{metric}/{subpath...}/{owner}/{repo}
        return segments[segments.length - 2];
    }
    throw new Error('Invalid path: cannot determine owner');
}

export default async function handleBadgeRequest(req, res) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const path = url.pathname.replace('/api/badge', '');
        const queryString = url.search;

        const segments = path.split('/').filter(s => s !== '');
        if (segments.length === 0) {
            throw new Error('Invalid path. Expected /{metric}/...');
        }

        const metric = segments[0];

        // Tentukan owner berdasarkan path
        const owner = extractOwner(segments);

        // Validasi: owner harus organisasi
        const orgCheck = await isOrganization(owner);
        if (!orgCheck) {
            throw new Error(`Account '${owner}' is not an organization`);
        }

        // Jika metrik kustom, hitung agregat
        if (metricConfig.hasOwnProperty(metric)) {
            // Metrik kustom hanya untuk format /{metric}/{owner}
            if (segments.length !== 2) {
                throw new Error(`Custom metric '${metric}' only supports format /${metric}/{owner}`);
            }
            await handleCustomMetric(metric, owner, req, res);
            return;
        }

        // Bukan metrik kustom → proxy ke Shields.io dengan prefix /github
        let proxyPath = path;
        if (!proxyPath.startsWith('/github/')) {
            proxyPath = '/github' + proxyPath;
        }
        const targetUrl = `${BADGE_SERVICE_BASE}${proxyPath}${queryString}`;
        console.log(`[INFO] Proxying to Shields.io: ${targetUrl}`);
        const response = await fetch(targetUrl);
        await pipeResponse(response, res);
        return;

    } catch (error) {
        console.error(`[ERROR] ${error.message}`);
        await sendErrorBadge(res, error, req);
    }
}

async function handleCustomMetric(metric, owner, req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const excludeParam = url.searchParams.get('exclude');

    const allRepos = await fetchAllOrgRepos(owner);
    let filteredRepos = allRepos;
    if (excludeParam) {
        const excludeList = excludeParam.split(',').map(s => s.trim().toLowerCase());
        filteredRepos = allRepos.filter(repo => {
            const name = repo.name.toLowerCase();
            const full = repo.full_name.toLowerCase();
            return !excludeList.some(ex => name === ex || full.endsWith(`/${ex}`) || full === ex);
        });
        console.log(`[INFO] Excluded: ${excludeList.join(', ')}. Remaining: ${filteredRepos.length}`);
    }

    const { value, extraData } = await calculateOrgStats(filteredRepos, metric, owner);
    const config = metricConfig[metric];

    let message = value;
    if (metric === 'size' || metric === 'disk-usage') {
        message = formatSize(value);
    } else if (typeof value === 'number' && metric !== 'created' && metric !== 'top-language') {
        message = formatNumber(value);
    }
    if (extraData?.count) {
        message += ` (${extraData.count} repos)`;
    }

    const badgePath = `/badge/${encodeURIComponent(config.label)}-${encodeURIComponent(message)}-${config.color}`;
    const params = new URLSearchParams(url.search);
    params.delete('exclude');
    const queryString = params.toString();
    const badgeUrl = `${BADGE_SERVICE_BASE}${badgePath}${queryString ? '?' + queryString : ''}`;

    const response = await fetch(badgeUrl);
    await pipeResponse(response, res, 'public, max-age=21600');
}

async function pipeResponse(upstreamRes, clientRes, customCacheControl = null) {
    const contentType = upstreamRes.headers.get('content-type') || 'image/svg+xml';
    const cacheControl = customCacheControl || upstreamRes.headers.get('cache-control') || 'public, max-age=3600';
    clientRes.setHeader('Content-Type', contentType);
    clientRes.setHeader('Cache-Control', cacheControl);
    clientRes.status(upstreamRes.status);
    const body = await upstreamRes.text();
    clientRes.send(body);
}

async function sendErrorBadge(res, error, req) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const styleParam = url.searchParams.get('style');
    const styleQuery = styleParam ? `?style=${encodeURIComponent(styleParam)}` : '';

    let errorMessage = 'Proxy Error';
    let statusCode = 500;

    if (error.message.includes('Invalid path')) {
        errorMessage = 'Invalid Path';
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
    } else if (error.message.includes('Custom metric')) {
        errorMessage = 'Invalid Format';
        statusCode = 400;
    } else if (error.message.includes('not supported')) {
        errorMessage = 'Unsupported Metric';
        statusCode = 400;
    }

    const errorBadgeUrl = `${BADGE_SERVICE_BASE}/badge/${encodeURIComponent(errorMessage)}-red${styleQuery}`;

    try {
        const errorResponse = await fetch(errorBadgeUrl);
        if (errorResponse.ok) {
            const svg = await errorResponse.text();
            res.setHeader('Content-Type', 'image/svg+xml');
            res.setHeader('Cache-Control', 'no-cache');
            return res.status(statusCode).send(svg);
        }
    } catch (e) {
        console.error('Failed to fetch error badge:', e.message);
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(statusCode).send(`
        <svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
            <rect width="120" height="20" fill="#e05d44"/>
            <text x="5" y="14" fill="#fff" font-family="sans-serif" font-size="11">${errorMessage}</text>
        </svg>
    `);
}
