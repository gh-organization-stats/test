import fetch from 'node-fetch';
import { GITHUB_API_BASE, PER_PAGE, githubHeaders } from '../config.js';

/**
 * Cek apakah sebuah akun GitHub adalah organisasi.
 * @param {string} owner - Nama akun
 * @returns {Promise<boolean>}
 */
export async function isOrganization(owner) {
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

/**
 * Mengambil SEMUA repositori publik dari sebuah organisasi (dengan paginasi).
 * @param {string} org - Nama organisasi
 * @returns {Promise<Array>} - Array objek repositori
 */
export async function fetchAllOrgRepos(org) {
    let allRepos = [];
    let page = 1;
    let hasMore = true;

    console.log(`[INFO] Fetching all repos for org: ${org}`);

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

    console.log(`[INFO] Fetched ${allRepos.length} repos.`);
    return allRepos;
}
