import fetch from 'node-fetch';
import { GITHUB_API_BASE, PER_PAGE, githubHeaders } from '../config.js';

// Cache sederhana di memori: Map<org, { data: repos, expires: timestamp }>
const cache = new Map();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 jam dalam milidetik

/**
 * Mengambil SEMUA repositori publik dari sebuah organisasi (dengan caching).
 * @param {string} org - Nama organisasi
 * @returns {Promise<Array>} - Array objek repositori
 */
export async function fetchAllOrgRepos(org) {
    const now = Date.now();
    const cached = cache.get(org);
    if (cached && cached.expires > now) {
        console.log(`[CACHE] Hit for org: ${org}`);
        return cached.data;
    }

    console.log(`[INFO] Fetching all repos for org: ${org} (cache miss)`);
    let allRepos = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const url = `${GITHUB_API_BASE}/orgs/${org}/repos?per_page=${PER_PAGE}&page=${page}&sort=updated`;
        const response = await fetch(url, { headers: githubHeaders });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Organization '${org}' not found`);
            } else if (response.status === 403) {
                throw new Error('GitHub API rate limit exceeded');
            } else {
                throw new Error(`GitHub API error: ${response.status}`);
            }
        }

        const repos = await response.json();
        if (repos.length === 0) {
            hasMore = false;
        } else {
            allRepos = allRepos.concat(repos);
            page++;
        }

        const linkHeader = response.headers.get('link');
        hasMore = linkHeader && linkHeader.includes('rel="next"');
    }

    console.log(`[INFO] Fetched ${allRepos.length} repos for ${org}. Caching for 6 hours.`);
    cache.set(org, {
        data: allRepos,
        expires: now + CACHE_TTL
    });

    return allRepos;
}
