import fetch from 'node-fetch';
import { BADGE_SERVICE_BASE } from '../config.js';
import { fetchAllOrgRepos } from '../github/api.js';
import { calculateOrgStats, metricConfig } from '../github/org-stats.js';
import { formatNumber, formatSize } from '../lib/formatters.js';

/**
 * Router utama untuk /api/badge/*
 *
 * Pendekatan:
 * - Ambil seluruh path setelah /api/badge (misal: /stars/vercel/next.js)
 * - Ambil segmen pertama sebagai 'metric'.
 * - Jika metric adalah metrik kustom kita (terdaftar di metricConfig), maka:
 *     - Asumsikan format: /{metric}/{owner}
 *     - Jalankan perhitungan agregat untuk akun tersebut (bisa user atau org).
 * - Jika bukan metrik kustom, tambahkan prefix '/github' dan teruskan ke Shields.io.
 */
export default async function handleBadgeRequest(req, res) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const path = url.pathname.replace('/api/badge', ''); // hasil: /{metric}/{...}
        const queryString = url.search;

        // Ambil segmen pertama (metric)
        const segments = path.split('/').filter(s => s !== '');
        if (segments.length === 0) {
            throw new Error('Invalid path. Expected /{metric}/...');
        }

        const metric = segments[0];

        // Cek apakah ini metrik kustom kita (agregat akun)
        if (metricConfig.hasOwnProperty(metric)) {
            // Metrik kustom hanya mendukung format: /{metric}/{owner}
            if (segments.length < 2) {
                throw new Error(`Custom metric '${metric}' requires an owner name. Format: /${metric}/{owner}`);
            }
            const owner = segments[1];
            await handleCustomMetric(metric, owner, req, res);
            return;
        }

        // Bukan metrik kustom → tambahkan prefix '/github' dan proxy ke Shields.io
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

/**
 * Menangani metrik kustom untuk agregat akun (user atau organisasi).
 */
async function handleCustomMetric(metric, owner, req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const excludeParam = url.searchParams.get('exclude');
    const styleParam = url.searchParams.get('style');

    // Ambil semua repo publik milik owner (cache 6 jam)
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

    // Hitung metrik
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

    // Bangun badge
    const badgePath = `/badge/${encodeURIComponent(config.label)}-${encodeURIComponent(message)}-${config.color}`;
    const params = new URLSearchParams();
    if (styleParam) params.set('style', styleParam);
    if (config.logo) params.set('logo', config.logo);
    const badgeUrl = `${BADGE_SERVICE_BASE}${badgePath}?${params.toString()}`;

    console.log(`[INFO] Generated badge URL: ${badgeUrl}`);
    const response = await fetch(badgeUrl);
    await pipeResponse(response, res, 'public, max-age=21600');
}

/**
 * Meneruskan response dari upstream ke client.
 */
async function pipeResponse(upstreamRes, clientRes, customCacheControl = null) {
    const contentType = upstreamRes.headers.get('content-type') || 'image/svg+xml';
    const cacheControl = customCacheControl || upstreamRes.headers.get('cache-control') || 'public, max-age=3600';
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
