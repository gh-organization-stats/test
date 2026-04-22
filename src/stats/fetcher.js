import fetch from 'node-fetch';
import { GITHUB_API_BASE, GITHUB_TOKEN } from '../config.js';
import { fetchAllOrgRepos, fetchAllReposCommitCounts } from '../github/api.js';

/**
 * Menghitung rank berdasarkan total stars.
 * Level: S (>20k), A+ (10k-20k), A (5k-10k), B+ (2k-5k), B (1k-2k), C+ (500-1k), C (<500)
 */
function calculateRank(totalStars) {
    let level, percentile;
    if (totalStars >= 20000) {
        level = 'S';
        percentile = 99;
    } else if (totalStars >= 10000) {
        level = 'A+';
        percentile = 95;
    } else if (totalStars >= 5000) {
        level = 'A';
        percentile = 90;
    } else if (totalStars >= 2000) {
        level = 'B+';
        percentile = 75;
    } else if (totalStars >= 1000) {
        level = 'B';
        percentile = 60;
    } else if (totalStars >= 500) {
        level = 'C+';
        percentile = 40;
    } else {
        level = 'C';
        percentile = 20;
    }
    return { level, percentile };
}

/**
 * Mengambil semua statistik untuk organisasi.
 * @param {string} org - Nama organisasi
 * @param {Array} repos - Array repositori dari fetchAllOrgRepos (sudah berisi data lengkap)
 * @returns {Promise<Object>} - Objek statistik lengkap
 */
export async function fetchOrgStats(org, repos) {
    const stats = {
        name: org,
        displayName: org,
        avatarUrl: '',
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
    
    // --- 1. Hitung metrik dasar dari seluruh repositori ---
    for (const repo of repos) {
        stats.totalStars += repo.stargazers_count || 0;
        stats.totalForks += repo.forks_count || 0;
        stats.totalWatchers += repo.watchers_count || 0;
        stats.totalSize += repo.size || 0;
        stats.openIssues += repo.open_issues_count || 0;
        stats.openPRs += repo.open_prs_count || 0; // diambil dari hasil transformasi GraphQL
        
        if (repo.language) {
            langCount[repo.language] = (langCount[repo.language] || 0) + 1;
        }
    }

    // --- 2. Top language & languages count ---
    const sortedLangs = Object.entries(langCount).sort((a, b) => b[1] - a[1]);
    if (sortedLangs.length > 0) {
        stats.topLanguage = sortedLangs[0][0];
        stats.languagesCount = sortedLangs.length;
    }

    // --- 3. Ambil data organisasi (REST) ---
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

    // --- 4. Total commits seluruh repositori (akurat, tanpa sampling) ---
    try {
        console.log(`[FETCHER] Fetching commit counts for ${repos.length} repos...`);
        const commitCounts = await fetchAllReposCommitCounts(repos);
        stats.totalCommits = Array.from(commitCounts.values()).reduce((sum, c) => sum + c, 0);
        console.log(`[FETCHER] Total commits: ${stats.totalCommits}`);
    } catch (e) {
        console.error('[FETCHER] Failed to fetch commit counts:', e.message);
        stats.totalCommits = 0;
    }

    // --- 5. Hitung rank berdasarkan total stars ---
    stats.rank = calculateRank(stats.totalStars);

    return stats;
}
