import fetch from 'node-fetch';
import { GITHUB_API_BASE, githubHeaders } from './config.js';

/**
 * Memeriksa apakah sebuah akun GitHub adalah organisasi.
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
