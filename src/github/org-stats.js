import fetch from 'node-fetch';
import { GITHUB_API_BASE, githubHeaders } from '../config.js';

/**
 * Menghitung metrik agregat dari daftar repositori.
 */
export async function calculateOrgStats(repos, metric, org) {
    let value;
    let extraData = null;

    switch (metric) {
        // --- Akumulasi langsung ---
        case 'stars':
            value = repos.reduce((sum, r) => sum + r.stargazers_count, 0);
            break;
        case 'forks':
            value = repos.reduce((sum, r) => sum + r.forks_count, 0);
            break;
        case 'watchers':
            value = repos.reduce((sum, r) => sum + r.watchers_count, 0);
            break;
        case 'size':
        case 'disk-usage':
            value = repos.reduce((sum, r) => sum + r.size, 0);
            break;
        case 'issues':
        case 'open-issues':
            value = repos.reduce((sum, r) => sum + r.open_issues_count, 0);
            break;
        case 'repo-count':
        case 'repos':
            value = repos.length;
            break;

        // --- Bahasa & Topik (tidak perlu API tambahan) ---
        case 'top-language': {
            const langCount = {};
            repos.forEach(r => {
                if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1;
            });
            const sorted = Object.entries(langCount).sort((a, b) => b[1] - a[1]);
            value = sorted[0]?.[0] || 'None';
            if (sorted[0]) extraData = { count: sorted[0][1] };
            break;
        }
        case 'languages-count': {
            const langs = new Set();
            repos.forEach(r => { if (r.language) langs.add(r.language); });
            value = langs.size;
            break;
        }
        case 'top-topic': {
            const topicCount = {};
            repos.forEach(r => {
                if (r.topics) r.topics.forEach(t => topicCount[t] = (topicCount[t] || 0) + 1);
            });
            const sorted = Object.entries(topicCount).sort((a, b) => b[1] - a[1]);
            value = sorted[0]?.[0] || 'None';
            if (sorted[0]) extraData = { count: sorted[0][1] };
            break;
        }
        case 'topics-count': {
            const topics = new Set();
            repos.forEach(r => { if (r.topics) r.topics.forEach(t => topics.add(t)); });
            value = topics.size;
            break;
        }
        case 'top-license': {
            const licenseCount = {};
            repos.forEach(r => {
                if (r.license) licenseCount[r.license.key] = (licenseCount[r.license.key] || 0) + 1;
            });
            const sorted = Object.entries(licenseCount).sort((a, b) => b[1] - a[1]);
            value = sorted[0]?.[0] || 'None';
            if (sorted[0]) extraData = { count: sorted[0][1] };
            break;
        }

        // --- Metrik dengan API tambahan (sampel 10 repo, diskalakan) ---
        case 'contributors':
            value = await aggregateWithSampling(repos, async (repo) => {
                const url = `${GITHUB_API_BASE}/repos/${repo.full_name}/contributors?per_page=1&anon=true`;
                const res = await fetch(url, { headers: githubHeaders });
                if (res.ok) {
                    const link = res.headers.get('link');
                    if (link) {
                        const match = link.match(/&page=(\d+)>; rel="last"/);
                        return match ? parseInt(match[1]) : 1;
                    }
                    const data = await res.json();
                    return data.length;
                }
                return 0;
            });
            break;

        case 'open-prs': {
            value = await aggregateWithSampling(repos, async (repo) => {
                const url = `${GITHUB_API_BASE}/repos/${repo.full_name}/pulls?state=open&per_page=1`;
                const res = await fetch(url, { headers: githubHeaders });
                if (res.ok) {
                    const link = res.headers.get('link');
                    if (link) {
                        const match = link.match(/&page=(\d+)>; rel="last"/);
                        return match ? parseInt(match[1]) : 0;
                    }
                    const data = await res.json();
                    return data.length;
                }
                return 0;
            });
            break;
        }

        case 'commits': {
            // Commit activity (52 minggu) – hanya tersedia jika repo tidak kosong
            value = await aggregateWithSampling(repos, async (repo) => {
                const url = `${GITHUB_API_BASE}/repos/${repo.full_name}/stats/commit_activity`;
                const res = await fetch(url, { headers: githubHeaders });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        return data.reduce((sum, week) => sum + week.total, 0);
                    }
                }
                return 0;
            });
            break;
        }

        case 'branches': {
            value = await aggregateWithSampling(repos, async (repo) => {
                const url = `${GITHUB_API_BASE}/repos/${repo.full_name}/branches?per_page=1`;
                const res = await fetch(url, { headers: githubHeaders });
                if (res.ok) {
                    const link = res.headers.get('link');
                    if (link) {
                        const match = link.match(/&page=(\d+)>; rel="last"/);
                        return match ? parseInt(match[1]) : 1;
                    }
                    const data = await res.json();
                    return data.length;
                }
                return 0;
            });
            break;
        }

        case 'releases': {
            value = await aggregateWithSampling(repos, async (repo) => {
                const url = `${GITHUB_API_BASE}/repos/${repo.full_name}/releases?per_page=1`;
                const res = await fetch(url, { headers: githubHeaders });
                if (res.ok) {
                    const link = res.headers.get('link');
                    if (link) {
                        const match = link.match(/&page=(\d+)>; rel="last"/);
                        return match ? parseInt(match[1]) : 0;
                    }
                    const data = await res.json();
                    return data.length;
                }
                return 0;
            });
            break;
        }

        case 'tags': {
            value = await aggregateWithSampling(repos, async (repo) => {
                const url = `${GITHUB_API_BASE}/repos/${repo.full_name}/tags?per_page=1`;
                const res = await fetch(url, { headers: githubHeaders });
                if (res.ok) {
                    const link = res.headers.get('link');
                    if (link) {
                        const match = link.match(/&page=(\d+)>; rel="last"/);
                        return match ? parseInt(match[1]) : 0;
                    }
                    const data = await res.json();
                    return data.length;
                }
                return 0;
            });
            break;
        }

        // --- Data langsung dari endpoint organisasi ---
        case 'followers':
            try {
                const res = await fetch(`${GITHUB_API_BASE}/orgs/${org}`, { headers: githubHeaders });
                const data = await res.json();
                value = data.followers || 0;
            } catch { value = 0; }
            break;

        case 'created':
            try {
                const res = await fetch(`${GITHUB_API_BASE}/orgs/${org}`, { headers: githubHeaders });
                const data = await res.json();
                value = data.created_at ? new Date(data.created_at).getFullYear().toString() : 'N/A';
            } catch { value = 'N/A'; }
            break;

        default:
            throw new Error(`Metric '${metric}' not supported for organization`);
    }

    return { value, extraData };
}

/**
 * Agregasi dengan sampling (ambil 10 repo pertama, lalu hitung rata-rata dan skala).
 * @param {Array} repos - Daftar repo
 * @param {Function} fetchFn - Fungsi async yang mengembalikan nilai per repo
 * @returns {Promise<number>} - Total estimasi
 */
async function aggregateWithSampling(repos, fetchFn) {
    const SAMPLE_SIZE = 10;
    const sample = repos.slice(0, SAMPLE_SIZE);
    let total = 0;
    let successCount = 0;

    for (const repo of sample) {
        try {
            const val = await fetchFn(repo);
            if (typeof val === 'number' && !isNaN(val)) {
                total += val;
                successCount++;
            }
        } catch (e) {
            console.warn(`Sampling failed for ${repo.full_name}: ${e.message}`);
        }
    }

    if (successCount === 0) return 0;

    const avg = total / successCount;
    return Math.round(avg * repos.length);
}

// --- Konfigurasi tampilan badge (logo dihapus) ---
export const metricConfig = {
    // Basic
    stars:          { label: 'Total Stars', color: 'yellow' },
    forks:          { label: 'Total Forks', color: 'blue' },
    watchers:       { label: 'Total Watchers', color: 'orange' },
    size:           { label: 'Total Size', color: 'lightgrey' },
    'disk-usage':   { label: 'Disk Usage', color: 'lightgrey' },
    issues:         { label: 'Open Issues', color: 'green' },
    'open-issues':  { label: 'Open Issues', color: 'green' },
    'repo-count':   { label: 'Public Repos', color: 'brightgreen' },
    repos:          { label: 'Public Repos', color: 'brightgreen' },
    // Language & Topics
    'top-language': { label: 'Top Language', color: 'blue' },
    'languages-count': { label: 'Languages', color: 'blue' },
    'top-topic':    { label: 'Top Topic', color: 'blue' },
    'topics-count': { label: 'Topics', color: 'blue' },
    'top-license':  { label: 'Top License', color: 'blue' },
    // Activity
    contributors:   { label: 'Contributors', color: 'blue' },
    'open-prs':     { label: 'Open PRs', color: 'blue' },
    commits:        { label: 'Commits (52w)', color: 'blue' },
    branches:       { label: 'Branches', color: 'blue' },
    releases:       { label: 'Releases', color: 'blue' },
    tags:           { label: 'Tags', color: 'blue' },
    // Org meta
    followers:      { label: 'Followers', color: 'blue' },
    created:        { label: 'Created', color: 'blue' }
};
