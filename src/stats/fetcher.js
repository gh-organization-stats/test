// src/stats/fetcher.js
import fetch from 'node-fetch';
import { GITHUB_API_BASE, GITHUB_TOKEN } from '../config.js';
import { fetchAllOrgRepos, fetchAllReposCommitCounts } from '../github/api.js';

// Cache untuk hasil fetchOrgStats (6 jam)
const statsCache = new Map();
const STATS_CACHE_TTL = 6 * 60 * 60 * 1000;

/**
 * Membulatkan angka menjadi maksimal 1 desimal.
 */
function formatPercentile(value) {
    const rounded = Math.round(value * 10) / 10;
    return rounded % 1 === 0 ? Math.round(rounded) : rounded;
}

/**
 * Calculates the exponential cdf.
 */
function exponential_cdf(x) {
    return 1 - 2 ** -x;
}

/**
 * Calculates the log normal cdf approximation.
 */
function log_normal_cdf(x) {
    return x / (1 + x);
}

/**
 * Menghitung rank organisasi menggunakan weighted percentiles.
 * @param {object} stats - Data statistik organisasi.
 * @returns {{ level: string, percentile: number }} - Hasil perhitungan rank.
 */
function calculateRank(stats) {
    const TOTAL_STARS_MEDIAN = 500;
    const TOTAL_FORKS_MEDIAN = 200;
    const TOTAL_COMMITS_MEDIAN = 5000;
    const OPEN_PRS_MEDIAN = 100;
    const PUBLIC_REPOS_MEDIAN = 10;
    const MEMBERS_MEDIAN = 5;

    const TOTAL_STARS_WEIGHT = 4;
    const TOTAL_FORKS_WEIGHT = 3;
    const TOTAL_COMMITS_WEIGHT = 2;
    const OPEN_PRS_WEIGHT = 1;
    const PUBLIC_REPOS_WEIGHT = 1;
    const MEMBERS_WEIGHT = 1;

    const TOTAL_WEIGHT =
        TOTAL_STARS_WEIGHT +
        TOTAL_FORKS_WEIGHT +
        TOTAL_COMMITS_WEIGHT +
        OPEN_PRS_WEIGHT +
        PUBLIC_REPOS_WEIGHT +
        MEMBERS_WEIGHT;

    // Threshold dari besar ke kecil
    const THRESHOLDS = [100, 87.5, 75, 62.5, 50, 37.5, 25, 12.5, 0];
    const LEVELS = ["S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C"];

    // Hitung rata-rata terbobot CDF (tanpa 1 minus)
    const rank =
        (TOTAL_STARS_WEIGHT * log_normal_cdf(stats.totalStars / TOTAL_STARS_MEDIAN) +
            TOTAL_FORKS_WEIGHT * log_normal_cdf(stats.totalForks / TOTAL_FORKS_MEDIAN) +
            TOTAL_COMMITS_WEIGHT * exponential_cdf(stats.totalCommits / TOTAL_COMMITS_MEDIAN) +
            OPEN_PRS_WEIGHT * exponential_cdf(stats.openPRs / OPEN_PRS_MEDIAN) +
            PUBLIC_REPOS_WEIGHT * log_normal_cdf(stats.publicRepos / PUBLIC_REPOS_MEDIAN) +
            MEMBERS_WEIGHT * log_normal_cdf(stats.members / MEMBERS_MEDIAN)) /
        TOTAL_WEIGHT;

    const percentile = formatPercentile(rank * 100);

    // Cari level: iterasi threshold, jika percentile >= threshold, ambil level tersebut
    let level = LEVELS[LEVELS.length - 1]; // default terendah
    for (let i = 0; i < THRESHOLDS.length; i++) {
        if (percentile >= THRESHOLDS[i]) {
            level = LEVELS[i];
            break;
        }
    }

    return { level, percentile };
}

/**
 * Fetch gambar avatar dan konversi ke base64.
 */
async function fetchAvatarAsBase64(url) {
    try {
        const response = await fetch(url);
        const buffer = await response.buffer();
        const contentType = response.headers.get('content-type') || 'image/png';
        const base64 = buffer.toString('base64');
        return `data:${contentType};base64,${base64}`;
    } catch (e) {
        console.error('Failed to fetch avatar for caching:', e);
        return null;
    }
}

/**
 * Mengambil semua statistik untuk organisasi.
 * @param {string} org - Nama organisasi
 * @param {Array} [repos] - Array repositori (opsional). Jika tidak diberikan, akan diambil dari cache/api.
 * @returns {Promise<Object>} - Objek statistik lengkap
 */
export async function fetchOrgStats(org, repos) {
    const now = Date.now();

    if (!repos) {
        const cached = statsCache.get(org);
        if (cached && cached.expires > now) {
            console.log(`[FETCHER CACHE] Hit for org stats: ${org}`);
            return cached.data;
        }
        console.log(`[FETCHER] Cache miss for org stats: ${org}. Fetching fresh data...`);
        repos = await fetchAllOrgRepos(org);
    } else {
        console.log(`[FETCHER] Using provided repos (exclude active), skipping cache.`);
    }

    const stats = {
        name: org,
        displayName: org,
        avatarUrl: '',
        avatarBase64: '',
        totalStars: 0,
        totalForks: 0,
        totalWatchers: 0,
        totalSize: 0,
        openIssues: 0,
        openPRs: 0,
        publicRepos: repos.length,
        followers: 0,
        members: 0,
        topLanguage: 'N/A',
        languagesCount: 0,
        createdAt: null,
        updatedAt: null,
        totalCommits: 0,
        rank: { level: 'C', percentile: 20 }
    };

    const langCount = {};

    for (const repo of repos) {
        stats.totalStars += repo.stargazers_count || 0;
        stats.totalForks += repo.forks_count || 0;
        stats.totalWatchers += repo.watchers_count || 0;
        stats.totalSize += repo.size || 0;
        stats.openIssues += repo.open_issues_count || 0;
        stats.openPRs += repo.open_prs_count || 0;
        if (repo.language) {
            langCount[repo.language] = (langCount[repo.language] || 0) + 1;
        }
    }

    const sortedLangs = Object.entries(langCount).sort((a, b) => b[1] - a[1]);
    if (sortedLangs.length > 0) {
        stats.topLanguage = sortedLangs[0][0];
        stats.languagesCount = sortedLangs.length;
    }

    const headers = GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {};
    try {
        const orgRes = await fetch(`${GITHUB_API_BASE}/orgs/${org}`, { headers });
        if (orgRes.ok) {
            const orgData = await orgRes.json();
            stats.displayName = orgData.name || org;
            stats.avatarUrl = orgData.avatar_url || '';
            stats.followers = orgData.followers || 0;
            stats.createdAt = orgData.created_at;
            stats.updatedAt = orgData.updated_at;
        }

        const membersRes = await fetch(`${GITHUB_API_BASE}/orgs/${org}/public_members`, { headers });
        if (membersRes.ok) {
            const membersData = await membersRes.json();
            stats.members = membersData.length;
        }
    } catch (e) {
        console.error('[FETCHER] Failed to fetch organization metadata:', e.message);
    }

    try {
        console.log(`[FETCHER] Fetching commit counts for ${repos.length} repos...`);
        const commitCounts = await fetchAllReposCommitCounts(repos);
        stats.totalCommits = Array.from(commitCounts.values()).reduce((sum, c) => sum + c, 0);
        console.log(`[FETCHER] Total commits: ${stats.totalCommits}`);
    } catch (e) {
        console.error('[FETCHER] Failed to fetch commit counts:', e.message);
        stats.totalCommits = 0;
    }

    stats.rank = calculateRank(stats);

    if (stats.avatarUrl) {
        stats.avatarBase64 = await fetchAvatarAsBase64(stats.avatarUrl);
    }

    if (!repos._excluded && !statsCache.has(org)) {
        statsCache.set(org, {
            data: stats,
            expires: now + STATS_CACHE_TTL
        });
        console.log(`[FETCHER] Cached stats for org: ${org}`);
    }

    return stats;
}
