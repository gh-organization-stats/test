// src/github/org-stats.js
import fetch from 'node-fetch';
import { GITHUB_API_BASE, githubHeaders } from '../config.js';

/**
 * Menghitung metrik agregat dari daftar repositori.
 * @param {Array} repos - Array repo dari GitHub API
 * @param {string} metric - Nama metrik
 * @param {string} org - Nama organisasi (untuk followers/created)
 * @returns {Promise<{value: any, extraData?: object}>}
 */
export async function calculateOrgStats(repos, metric, org) {
    let value;
    let extraData = null;

    switch (metric) {
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

        case 'top-language': {
            const langCount = {};
            repos.forEach(r => {
                if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1;
            });
            const sorted = Object.entries(langCount).sort((a, b) => b[1] - a[1]);
            if (sorted.length > 0) {
                value = sorted[0][0];
                extraData = { count: sorted[0][1] };
            } else {
                value = 'None';
            }
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
            if (sorted.length > 0) {
                value = sorted[0][0];
                extraData = { count: sorted[0][1] };
            } else {
                value = 'None';
            }
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
                if (r.license) {
                    const key = r.license.key;
                    licenseCount[key] = (licenseCount[key] || 0) + 1;
                }
            });
            const sorted = Object.entries(licenseCount).sort((a, b) => b[1] - a[1]);
            if (sorted.length > 0) {
                value = sorted[0][0];
                extraData = { count: sorted[0][1] };
            } else {
                value = 'None';
            }
            break;
        }

        case 'contributors': {
            let total = 0;
            const sample = repos.slice(0, 10);
            for (const repo of sample) {
                try {
                    const url = `${GITHUB_API_BASE}/repos/${repo.full_name}/contributors?per_page=1&anon=true`;
                    const res = await fetch(url, { headers: githubHeaders });
                    if (res.ok) {
                        const link = res.headers.get('link');
                        if (link) {
                            const match = link.match(/&page=(\d+)>; rel="last"/);
                            total += match ? parseInt(match[1]) : 1;
                        } else {
                            total += 1;
                        }
                    }
                } catch (e) {
                    console.warn(`Contributors fetch failed for ${repo.full_name}`);
                }
            }
            if (repos.length > 10) {
                const avg = total / 10;
                total = Math.round(total + avg * (repos.length - 10));
            }
            value = total;
            break;
        }

        case 'followers':
            try {
                const res = await fetch(`${GITHUB_API_BASE}/orgs/${org}`, { headers: githubHeaders });
                if (res.ok) {
                    const data = await res.json();
                    value = data.followers || 0;
                } else value = 0;
            } catch { value = 0; }
            break;

        case 'created':
            try {
                const res = await fetch(`${GITHUB_API_BASE}/orgs/${org}`, { headers: githubHeaders });
                if (res.ok) {
                    const data = await res.json();
                    value = data.created_at ? new Date(data.created_at).getFullYear().toString() : 'N/A';
                } else value = 'N/A';
            } catch { value = 'N/A'; }
            break;

        default:
            throw new Error(`Metric '${metric}' not supported for organization`);
    }

    return { value, extraData };
}

/**
 * Konfigurasi tampilan badge untuk setiap metrik.
 */
export const metricConfig = {
    stars:          { label: 'Total Stars', color: 'yellow', logo: 'star' },
    forks:          { label: 'Total Forks', color: 'blue', logo: 'repo-forked' },
    watchers:       { label: 'Total Watchers', color: 'orange', logo: 'eye' },
    size:           { label: 'Total Size', color: 'lightgrey', logo: 'database' },
    issues:         { label: 'Open Issues', color: 'green', logo: 'issue-opened' },
    'open-issues':  { label: 'Open Issues', color: 'green', logo: 'issue-opened' },
    'repo-count':   { label: 'Public Repos', color: 'brightgreen', logo: 'repo' },
    repos:          { label: 'Public Repos', color: 'brightgreen', logo: 'repo' },
    'top-language': { label: 'Top Language', color: 'blue', logo: 'code' },
    'languages-count': { label: 'Languages', color: 'blue', logo: 'code' },
    'top-topic':    { label: 'Top Topic', color: 'blue', logo: 'tag' },
    'topics-count': { label: 'Topics', color: 'blue', logo: 'tag' },
    'top-license':  { label: 'Top License', color: 'blue', logo: 'law' },
    contributors:   { label: 'Contributors', color: 'blue', logo: 'people' },
    followers:      { label: 'Followers', color: 'blue', logo: 'person' },
    created:        { label: 'Created', color: 'blue', logo: 'calendar' }
};
