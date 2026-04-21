import fetch from 'node-fetch';
import { BADGE_SERVICE_BASE } from '../config.js';
import { isOrganization, fetchAllOrgRepos } from '../github/api.js';
import { calculateOrgStats, metricConfig } from '../github/org-stats.js';
import { formatNumber, formatSize } from '../lib/formatters.js';

/**
 * Router utama untuk /api/badge/*
 */
export default async function handleBadgeRequest(req, res) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const path = url.pathname.replace('/api/badge', '');
        const queryString = url.search;

        // Proxy langsung ke custom-icon-badges untuk endpoint GitHub standar
        if (path.startsWith('/github/')) {
            const targetUrl = `${BADGE_SERVICE_BASE}${path}${queryString}`;
            console.log(`[INFO] Proxying to: ${targetUrl}`);
            const response = await fetch(targetUrl);
            await pipeResponse(response, res);
            return;
        }

        // Statistik agregat organisasi
        if (path.startsWith('/github-org/')) {
            const parts = path.split('/').filter(s => s);
            if (parts.length < 3) {
                throw new Error('Invalid path format. Expected /github-org/{metric}/{org}');
            }
            const metric = parts[1];
            const org = parts[2];
            const excludeParam = url.searchParams.get('exclude');
            const styleParam = url.searchParams.get('style');

            if (!await isOrganization(org)) {
                throw new Error(`Account '${org}' is not an organization`);
            }

            const allRepos = await fetchAllOrgRepos(org);
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

            const { value, extraData } = await calculateOrgStats(filteredRepos, metric, org);
            const config = metricConfig[metric] || { label: metric, color: 'blue', logo: 'github' };

            let message = value;
            if (metric === 'size') {
                message = formatSize(value);
            } else if (typeof value === 'number' && metric !== 'created' && metric !== 'top-language') {
                message = formatNumber(value);
            }
            if (extraData?.count) {
                message += ` (${extraData.count} repos)`;
            }

            const badgePath = `/badge/${encodeURIComponent(config.label)}-${encodeURIComponent(message)}-${config.color}`;
            const params = new URLSearchParams();
            if (styleParam) params.set('style', styleParam);
            if (config.logo) params.set('logo', config.logo);
            const badgeUrl = `${BADGE_SERVICE_BASE}${badgePath}?${params.toString()}`;

            console.log(`[INFO] Generated badge URL: ${badgeUrl}`);
            const response = await fetch(badgeUrl);
            await pipeResponse(response, res);
            return;
        }

        throw new Error('Invalid path. Use /github/... or /github-org/...');
    } catch (error) {
        console.error(`[ERROR] ${error.message}`);
        await sendErrorBadge(res, error, req);
    }
}

/**
 * Meneruskan response dari upstream ke client.
 */
async function pipeResponse(upstreamRes, clientRes) {
    const contentType = upstreamRes.headers.get('content-type') || 'image/svg+xml';
    const cacheControl = upstreamRes.headers.get('cache-control') || 'public, max-age=3600';
    clientRes.setHeader('Content-Type', contentType);
    clientRes.setHeader('Cache-Control', cacheControl);
    clientRes.status(upstreamRes.status);
    const body = await upstreamRes.text();
    clientRes.send(body);
}

/**
 * Mengirim badge error dengan style yang sesuai.
 */
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

    // Fallback SVG
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(statusCode).send(`
        <svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
            <rect width="120" height="20" fill="#e05d44"/>
            <text x="5" y="14" fill="#fff" font-family="sans-serif" font-size="11">${errorMessage}</text>
        </svg>
    `);
}
