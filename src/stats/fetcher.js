import fetch from 'node-fetch';
import { GITHUB_API_BASE, GITHUB_TOKEN } from '../config.js';
import { fetchAllOrgRepos, fetchAllReposCommitCounts } from '../github/api.js';

/**
 * Membulatkan angka menjadi maksimal 1 desimal.
 * Contoh: 85.234 -> 85.2, 99.999 -> 100, 60 -> 60
 */
function formatPercentile(value) {
    const rounded = Math.round(value * 10) / 10;
    // Hapus .0 jika tidak diperlukan
    return rounded % 1 === 0 ? Math.round(rounded) : rounded;
}

/**
 * Calculates the exponential cdf.
 * @param {number} x The value.
 * @returns {number} The exponential cdf (0-1).
 */
function exponential_cdf(x) {
  return 1 - 2 ** -x;
}

/**
 * Calculates the log normal cdf approximation.
 * @param {number} x The value.
 * @returns {number} The log normal cdf (0-1).
 */
function log_normal_cdf(x) {
  return x / (1 + x);
}

/**
 * Calculates the organization's rank using weighted percentiles,
 * adopting the methodology from github-readme-stats.
 * @param {object} stats The organization's statistics.
 * @returns {{ level: string, percentile: number }} The calculated rank.
 */
function calculateRank(stats) {
  // --- MEDIAN VALUES (can be adjusted based on actual data) ---
  const TOTAL_STARS_MEDIAN = 500;      // Total stars across all repos
  const TOTAL_FORKS_MEDIAN = 200;      // Total forks across all repos
  const TOTAL_COMMITS_MEDIAN = 5000;   // Total commits across all repos
  const OPEN_PRS_MEDIAN = 100;         // Total open PRs across all repos
  const PUBLIC_REPOS_MEDIAN = 10;       // Number of public repos
  const MEMBERS_MEDIAN = 5;            // Number of public members

  // --- WEIGHTS (importance factor for each metric) ---
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

  // --- THRESHOLDS & LEVEL MAPPING (Japanese grading system) ---
  const THRESHOLDS = [1, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];
  const LEVELS = ["S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C"];

  // Calculate weighted percentile
  const rank =
    1 -
    (TOTAL_STARS_WEIGHT * log_normal_cdf(stats.totalStars / TOTAL_STARS_MEDIAN) +
      TOTAL_FORKS_WEIGHT * log_normal_cdf(stats.totalForks / TOTAL_FORKS_MEDIAN) +
      TOTAL_COMMITS_WEIGHT * exponential_cdf(stats.totalCommits / TOTAL_COMMITS_MEDIAN) +
      OPEN_PRS_WEIGHT * exponential_cdf(stats.openPRs / OPEN_PRS_MEDIAN) +
      PUBLIC_REPOS_WEIGHT * log_normal_cdf(stats.publicRepos / PUBLIC_REPOS_MEDIAN) +
      MEMBERS_WEIGHT * log_normal_cdf(stats.members / MEMBERS_MEDIAN)) /
    TOTAL_WEIGHT;

  const percentile = formatPercentile(rank * 100);
  const levelIndex = THRESHOLDS.findIndex((t) => percentile <= t);
  const level = LEVELS[levelIndex];

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
        stats.openPRs += repo.open_prs_count || 0;
        
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
    const headers = GITHUB_TOKEN ? { 'Authorization': `Bearer ${GITHUB_TOKEN}` } : {};
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

    // --- 5. Hitung rank dengan metode weighted percentile yang baru ---
    stats.rank = calculateRank(stats);

    return stats;
}
