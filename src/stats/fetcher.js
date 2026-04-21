// src/stats/fetcher.js
import fetch from 'node-fetch';
import { GITHUB_API_BASE, githubHeaders } from '../config.js';

/**
 * Mengambil semua data statistik untuk sebuah organisasi.
 * @param {string} org - Nama organisasi
 * @param {Array} repos - Array repositori yang sudah diambil
 * @returns {Promise<Object>} - Objek statistik
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
        updatedAt: null
    };

    // Hitung metrik dari repositori
    const langCount = {};
    
    for (const repo of repos) {
        stats.totalStars += repo.stargazers_count;
        stats.totalForks += repo.forks_count;
        stats.totalWatchers += repo.watchers_count;
        stats.totalSize += repo.size;
        stats.openIssues += repo.open_issues_count;
        
        if (repo.language) {
            langCount[repo.language] = (langCount[repo.language] || 0) + 1;
        }
    }

    // Tentukan top language dan jumlah bahasa unik
    const sortedLangs = Object.entries(langCount).sort((a, b) => b[1] - a[1]);
    if (sortedLangs.length > 0) {
        stats.topLanguage = sortedLangs[0][0];
        stats.languagesCount = sortedLangs.length;
    }

    // Hitung open PRs (sampling untuk performa, atau hitung semua jika repos sedikit)
    if (repos.length <= 30) {
        // Hitung semua
        for (const repo of repos) {
            try {
                const pullsUrl = `${GITHUB_API_BASE}/repos/${repo.full_name}/pulls?state=open&per_page=1`;
                const res = await fetch(pullsUrl, { headers: githubHeaders });
                if (res.ok) {
                    const link = res.headers.get('link');
                    if (link) {
                        const match = link.match(/&page=(\d+)>; rel="last"/);
                        stats.openPRs += match ? parseInt(match[1]) : 0;
                    } else {
                        const data = await res.json();
                        stats.openPRs += data.length;
                    }
                }
            } catch (e) {
                console.warn(`Failed to fetch PRs for ${repo.full_name}`);
            }
        }
    } else {
        // Sampling 10 repo
        const sample = repos.slice(0, 10);
        let samplePRs = 0;
        for (const repo of sample) {
            try {
                const pullsUrl = `${GITHUB_API_BASE}/repos/${repo.full_name}/pulls?state=open&per_page=1`;
                const res = await fetch(pullsUrl, { headers: githubHeaders });
                if (res.ok) {
                    const link = res.headers.get('link');
                    if (link) {
                        const match = link.match(/&page=(\d+)>; rel="last"/);
                        samplePRs += match ? parseInt(match[1]) : 0;
                    } else {
                        const data = await res.json();
                        samplePRs += data.length;
                    }
                }
            } catch (e) {}
        }
        stats.openPRs = Math.round((samplePRs / 10) * repos.length);
    }

    // Ambil data organisasi dari REST API
    try {
        const orgRes = await fetch(`${GITHUB_API_BASE}/orgs/${org}`, { headers: githubHeaders });
        if (orgRes.ok) {
            const orgData = await orgRes.json();
            stats.displayName = orgData.name || org;
            stats.avatarUrl = orgData.avatar_url || '';
            stats.followers = orgData.followers || 0;
            stats.createdAt = orgData.created_at;
            stats.updatedAt = orgData.updated_at;
        }
    } catch (e) {
        console.error('Failed to fetch org data:', e);
    }

    // Ambil jumlah anggota publik (GraphQL akan lebih baik, tapi REST juga bisa)
    try {
        const membersRes = await fetch(`${GITHUB_API_BASE}/orgs/${org}/public_members`, { headers: githubHeaders });
        if (membersRes.ok) {
            const membersData = await membersRes.json();
            stats.members = membersData.length;
            // Perhatikan: ini hanya anggota publik. Untuk total anggota, perlu GraphQL API.
        }
    } catch (e) {
        console.error('Failed to fetch members:', e);
    }

    return stats;
}
