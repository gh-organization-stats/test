// api/badge-json.js
const fetch = require('node-fetch');

// --- Konfigurasi ---
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const headers = GITHUB_TOKEN ? { 'Authorization': `token ${GITHUB_TOKEN}` } : {};

const GITHUB_API_BASE = 'https://api.github.com';
const PER_PAGE = 100; // Maksimum item per halaman (batas GitHub API)

// --- Fungsi Helper: Mengambil SEMUA repositori publik (menangani paginasi) ---
async function fetchAllOrgRepos(org) {
    let allRepos = [];
    let page = 1;
    let hasMore = true;
    
    console.log(`[INFO] Mengambil data repositori untuk organisasi: ${org}`);

    while (hasMore) {
        const url = `${GITHUB_API_BASE}/orgs/${org}/repos?per_page=${PER_PAGE}&page=${page}&sort=updated`;
        try {
            const response = await fetch(url, { headers });
            
            if (!response.ok) {
                console.error(`[ERROR] GitHub API error: ${response.status} ${response.statusText}`);
                // Kembalikan error spesifik untuk ditampilkan di badge
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
            
            // Cek apakah ada halaman berikutnya dari header 'link'
            const linkHeader = response.headers.get('link');
            hasMore = linkHeader && linkHeader.includes('rel="next"');
            
        } catch (error) {
            // Lempar ulang error yang sudah terformat
            throw error;
        }
    }
    
    console.log(`[INFO] Berhasil mengambil ${allRepos.length} repositori.`);
    return allRepos;
}

// --- Fungsi Helper: Mendapatkan data lisensi untuk semua repositori ---
async function fetchLicenses(repos) {
    const licenses = {};
    for (const repo of repos) {
        if (repo.license) {
            const key = repo.license.key;
            licenses[key] = (licenses[key] || 0) + 1;
        }
    }
    return licenses;
}

// --- Fungsi Helper: Mendapatkan bahasa pemrograman untuk semua repositori ---
function getLanguages(repos) {
    const languages = {};
    repos.forEach(repo => {
        if (repo.language) {
            languages[repo.language] = (languages[repo.language] || 0) + 1;
        }
    });
    return languages;
}

// --- Fungsi Helper: Mendapatkan topik yang paling sering digunakan ---
function getTopics(repos) {
    const topics = {};
    repos.forEach(repo => {
        if (repo.topics) {
            repo.topics.forEach(topic => {
                topics[topic] = (topics[topic] || 0) + 1;
            });
        }
    });
    return topics;
}

// --- Fungsi Helper: Menghitung kontributor unik (perlu API tambahan) ---
async function fetchContributorsCount(repos) {
    let totalContributors = 0;
    const reposToProcess = repos.slice(0, 10);
    for (const repo of reposToProcess) {
        try {
            const url = `${GITHUB_API_BASE}/repos/${repo.full_name}/contributors?per_page=1&anon=true`;
            const response = await fetch(url, { headers });
            if (response.ok) {
                const linkHeader = response.headers.get('link');
                if (linkHeader) {
                    const match = linkHeader.match(/&page=(\d+)>; rel="last"/);
                    if (match) {
                        totalContributors += parseInt(match[1], 10);
                    } else {
                        totalContributors += 1;
                    }
                } else {
                    totalContributors += 1;
                }
            }
        } catch (error) {
            console.warn(`[WARN] Gagal mengambil kontributor untuk ${repo.full_name}: ${error.message}`);
        }
    }
    if (repos.length > 10) {
        const avgPerRepo = totalContributors / 10;
        totalContributors = Math.round(totalContributors + avgPerRepo * (repos.length - 10));
    }
    return totalContributors;
}

// --- Fungsi Utama untuk Menghitung Metrik Agregat Organisasi ---
async function calculateOrgStats(repos, metric, org) {
    let value;
    let extraData = null;

    switch (metric) {
        // === Metrik Akumulasi dari Semua Repo ===
        case 'stars':
            value = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
            break;
        case 'forks':
            value = repos.reduce((sum, repo) => sum + repo.forks_count, 0);
            break;
        case 'watchers':
            value = repos.reduce((sum, repo) => sum + repo.watchers_count, 0);
            break;
        case 'size':
            value = repos.reduce((sum, repo) => sum + repo.size, 0);
            break;
        case 'open-issues':
        case 'issues':
            value = repos.reduce((sum, repo) => sum + repo.open_issues_count, 0);
            break;
        case 'repos':
        case 'repositories':
        case 'repo-count':
            value = repos.length;
            break;
            
        // === Metrik Berdasarkan Analisis Data ===
        case 'top-language': {
            const languages = getLanguages(repos);
            const sorted = Object.entries(languages).sort((a, b) => b[1] - a[1]);
            if (sorted.length > 0) {
                value = sorted[0][0];
                extraData = { count: sorted[0][1] };
            } else {
                value = 'None';
            }
            break;
        }
        case 'languages-count': {
            const languages = getLanguages(repos);
            value = Object.keys(languages).length;
            break;
        }
        case 'top-topic': {
            const topics = getTopics(repos);
            const sorted = Object.entries(topics).sort((a, b) => b[1] - a[1]);
            if (sorted.length > 0) {
                value = sorted[0][0];
                extraData = { count: sorted[0][1] };
            } else {
                value = 'None';
            }
            break;
        }
        case 'topics-count': {
            const topics = getTopics(repos);
            value = Object.keys(topics).length;
            break;
        }
        case 'top-license': {
            const licenses = await fetchLicenses(repos);
            const sorted = Object.entries(licenses).sort((a, b) => b[1] - a[1]);
            if (sorted.length > 0) {
                value = sorted[0][0];
                extraData = { count: sorted[0][1] };
            } else {
                value = 'None';
            }
            break;
        }
        
        // === Metrik yang Membutuhkan API Tambahan ===
        case 'contributors':
            value = await fetchContributorsCount(repos);
            break;
            
        // === Metrik dari Organisasi (API GitHub Org) ===
        case 'followers':
            try {
                const orgResponse = await fetch(`${GITHUB_API_BASE}/orgs/${org}`, { headers });
                if (orgResponse.ok) {
                    const orgData = await orgResponse.json();
                    value = orgData.followers || 0;
                } else {
                    throw new Error(`Failed to fetch organization data`);
                }
            } catch (error) {
                throw new Error(`Failed to fetch followers: ${error.message}`);
            }
            break;
        case 'created':
            try {
                const orgResponse = await fetch(`${GITHUB_API_BASE}/orgs/${org}`, { headers });
                if (orgResponse.ok) {
                    const orgData = await orgResponse.json();
                    value = orgData.created_at ? new Date(orgData.created_at).getFullYear().toString() : 'N/A';
                } else {
                    throw new Error(`Failed to fetch organization data`);
                }
            } catch (error) {
                throw new Error(`Failed to fetch creation date: ${error.message}`);
            }
            break;
            
        default:
            throw new Error(`Metric '${metric}' not supported for organization`);
    }
    
    return { value, extraData };
}

// --- Fungsi untuk Menghitung Metrik Repositori Spesifik ---
async function calculateRepoStats(owner, repo, metric) {
    let value;
    let extraData = null;

    try {
        switch (metric) {
            // === Metrik Dasar ===
            case 'stars': {
                const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers });
                if (!res.ok) {
                    if (res.status === 404) throw new Error(`Repository '${owner}/${repo}' not found`);
                    else throw new Error(`GitHub API error: ${res.status}`);
                }
                const data = await res.json();
                value = data.stargazers_count;
                break;
            }
            case 'forks': {
                const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers });
                if (!res.ok) {
                    if (res.status === 404) throw new Error(`Repository '${owner}/${repo}' not found`);
                    else throw new Error(`GitHub API error: ${res.status}`);
                }
                const data = await res.json();
                value = data.forks_count;
                break;
            }
            case 'watchers': {
                const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers });
                if (!res.ok) {
                    if (res.status === 404) throw new Error(`Repository '${owner}/${repo}' not found`);
                    else throw new Error(`GitHub API error: ${res.status}`);
                }
                const data = await res.json();
                value = data.watchers_count;
                break;
            }
            case 'open-issues':
            case 'issues': {
                const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers });
                if (!res.ok) {
                    if (res.status === 404) throw new Error(`Repository '${owner}/${repo}' not found`);
                    else throw new Error(`GitHub API error: ${res.status}`);
                }
                const data = await res.json();
                value = data.open_issues_count;
                break;
            }
            case 'size': {
                const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers });
                if (!res.ok) {
                    if (res.status === 404) throw new Error(`Repository '${owner}/${repo}' not found`);
                    else throw new Error(`GitHub API error: ${res.status}`);
                }
                const data = await res.json();
                value = data.size; // dalam KB
                break;
            }
            case 'license': {
                const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers });
                if (!res.ok) {
                    if (res.status === 404) throw new Error(`Repository '${owner}/${repo}' not found`);
                    else throw new Error(`GitHub API error: ${res.status}`);
                }
                const data = await res.json();
                value = data.license ? data.license.spdx_id : 'None';
                break;
            }
            case 'language': {
                const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers });
                if (!res.ok) {
                    if (res.status === 404) throw new Error(`Repository '${owner}/${repo}' not found`);
                    else throw new Error(`GitHub API error: ${res.status}`);
                }
                const data = await res.json();
                value = data.language || 'None';
                break;
            }
            case 'topics-count': {
                const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers });
                if (!res.ok) {
                    if (res.status === 404) throw new Error(`Repository '${owner}/${repo}' not found`);
                    else throw new Error(`GitHub API error: ${res.status}`);
                }
                const data = await res.json();
                value = data.topics ? data.topics.length : 0;
                break;
            }
            
            // === Metrik Rilis dan Tag ===
            case 'release': {
                const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/releases/latest`, { headers });
                if (res.status === 404) {
                    value = 'none';
                } else if (!res.ok) {
                    throw new Error(`GitHub API error: ${res.status}`);
                } else {
                    const data = await res.json();
                    value = data.tag_name || data.name || 'unknown';
                }
                break;
            }
            case 'tag': {
                const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/tags?per_page=1`, { headers });
                if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
                const data = await res.json();
                value = data.length > 0 ? data[0].name : 'none';
                break;
            }
            case 'release-date': {
                const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/releases/latest`, { headers });
                if (res.status === 404) {
                    value = 'no release';
                } else if (!res.ok) {
                    throw new Error(`GitHub API error: ${res.status}`);
                } else {
                    const data = await res.json();
                    const date = new Date(data.published_at || data.created_at);
                    value = date.toISOString().split('T')[0];
                }
                break;
            }
            
            // === Metrik Commit ===
            case 'last-commit': {
                const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?per_page=1`, { headers });
                if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
                const data = await res.json();
                if (data.length > 0) {
                    const date = new Date(data[0].commit.committer.date);
                    value = date.toISOString().split('T')[0];
                } else {
                    value = 'never';
                }
                break;
            }
            case 'commit-activity': {
                // Total commits dalam 52 minggu terakhir
                const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/stats/commit_activity`, { headers });
                if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    value = data.reduce((sum, week) => sum + week.total, 0);
                } else {
                    value = 0;
                }
                break;
            }
            
            // === Metrik Pull Request ===
            case 'pulls': {
                const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls?state=open&per_page=1`, { headers });
                if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
                const linkHeader = res.headers.get('link');
                if (linkHeader) {
                    const match = linkHeader.match(/&page=(\d+)>; rel="last"/);
                    value = match ? parseInt(match[1], 10) : 0;
                } else {
                    const data = await res.json();
                    value = data.length;
                }
                break;
            }
            
            // === Metrik Kontributor ===
            case 'contributors': {
                const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contributors?per_page=1&anon=true`, { headers });
                if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
                const linkHeader = res.headers.get('link');
                if (linkHeader) {
                    const match = linkHeader.match(/&page=(\d+)>; rel="last"/);
                    value = match ? parseInt(match[1], 10) : 1;
                } else {
                    const data = await res.json();
                    value = data.length;
                }
                break;
            }
            
            // === Metrik Bahasa ===
            case 'languages-count': {
                const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/languages`, { headers });
                if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
                const data = await res.json();
                value = Object.keys(data).length;
                break;
            }
            case 'top-language': {
                const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/languages`, { headers });
                if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
                const data = await res.json();
                const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
                value = sorted.length > 0 ? sorted[0][0] : 'None';
                if (sorted.length > 0) {
                    extraData = { bytes: sorted[0][1] };
                }
                break;
            }
            
            default:
                throw new Error(`Metric '${metric}' not supported for repository`);
        }
    } catch (error) {
        // Lempar error dengan pesan yang sudah diformat
        throw error;
    }

    return { value, extraData };
}

// --- Konfigurasi Label, Warna, dan Ikon untuk Setiap Metrik ---
const metricConfig = {
    // === Organisasi ===
    'stars': { label: 'Total Stars', color: 'yellow', logo: 'star' },
    'forks': { label: 'Total Forks', color: 'blue', logo: 'repo-forked' },
    'watchers': { label: 'Total Watchers', color: 'orange', logo: 'eye' },
    'followers': { label: 'Followers', color: 'blue', logo: 'person' },
    'issues': { label: 'Open Issues', color: 'green', logo: 'issue-opened' },
    'open-issues': { label: 'Open Issues', color: 'green', logo: 'issue-opened' },
    'contributors': { label: 'Contributors', color: 'blue', logo: 'people' },
    'repos': { label: 'Public Repos', color: 'brightgreen', logo: 'repo' },
    'repositories': { label: 'Public Repos', color: 'brightgreen', logo: 'repo' },
    'repo-count': { label: 'Public Repos', color: 'brightgreen', logo: 'repo' },
    'size': { label: 'Total Size', color: 'lightgrey', logo: 'database' },
    'created': { label: 'Created', color: 'blue', logo: 'calendar' },
    'top-language': { label: 'Top Language', color: 'blue', logo: 'code' },
    'languages-count': { label: 'Languages', color: 'blue', logo: 'code' },
    'top-topic': { label: 'Top Topic', color: 'blue', logo: 'tag' },
    'topics-count': { label: 'Topics', color: 'blue', logo: 'tag' },
    'top-license': { label: 'Top License', color: 'blue', logo: 'law' },
    
    // === Repositori ===
    'license': { label: 'License', color: 'blue', logo: 'law' },
    'language': { label: 'Language', color: 'blue', logo: 'code' },
    'release': { label: 'Release', color: 'blue', logo: 'tag' },
    'tag': { label: 'Tag', color: 'blue', logo: 'tag' },
    'release-date': { label: 'Release Date', color: 'blue', logo: 'calendar' },
    'last-commit': { label: 'Last Commit', color: 'blue', logo: 'git-commit' },
    'commit-activity': { label: 'Commits (52w)', color: 'blue', logo: 'git-commit' },
    'pulls': { label: 'Open PRs', color: 'blue', logo: 'git-pull-request' }
};

// --- Fungsi untuk mengembalikan respons error dalam format Shields.io ---
function sendErrorBadge(res, errorMessage) {
    res.setHeader('Cache-Control', 'no-cache');
    res.json({
        schemaVersion: 1,
        label: 'ERROR',
        message: errorMessage,
        color: 'red',
        namedLogo: 'github',
        logoColor: 'white'
    });
}

// --- Handler Utama API ---
module.exports = async (req, res) => {
    try {
        const { org, repo, metric = 'stars', exclude } = req.query;

        // Validasi input: harus ada org ATAU repo
        if (!org && !repo) {
            return sendErrorBadge(res, 'Parameter "org" or "repo" is required');
        }

        let result;
        
        if (repo) {
            // Mode Repositori Spesifik
            const parts = repo.split('/');
            if (parts.length !== 2) {
                return sendErrorBadge(res, 'Repo parameter must be in format "owner/repo"');
            }
            const [owner, repoName] = parts;
            result = await calculateRepoStats(owner, repoName, metric);
        } else {
            // Mode Organisasi (Agregat)
            let allRepos;
            try {
                allRepos = await fetchAllOrgRepos(org);
            } catch (error) {
                return sendErrorBadge(res, error.message);
            }
            
            // Filter repositori yang dikecualikan
            let filteredRepos = allRepos;
            if (exclude) {
                const excludeList = exclude.split(',').map(name => name.trim().toLowerCase());
                console.log(`[INFO] Mengecualikan repositori: ${excludeList.join(', ')}`);
                
                filteredRepos = allRepos.filter(repo => {
                    const repoName = repo.name.toLowerCase();
                    const fullName = repo.full_name.toLowerCase();
                    return !excludeList.some(excluded => 
                        repoName === excluded || fullName.endsWith(`/${excluded}`) || fullName === excluded
                    );
                });
                
                console.log(`[INFO] Jumlah repo setelah filter: ${filteredRepos.length} (dari ${allRepos.length})`);
            }
            
            try {
                result = await calculateOrgStats(filteredRepos, metric, org);
            } catch (error) {
                return sendErrorBadge(res, error.message);
            }
        }

        const config = metricConfig[metric] || {
            label: metric.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            color: 'blue',
            logo: 'github'
        };

        let message = result.value.toString();
        
        // Format khusus untuk ukuran
        if (metric === 'size') {
            if (result.value > 1024 * 1024) {
                message = (result.value / (1024 * 1024)).toFixed(2) + ' GB';
            } else if (result.value > 1024) {
                message = (result.value / 1024).toFixed(2) + ' MB';
            } else {
                message = result.value + ' KB';
            }
        }

        // Data tambahan
        if (result.extraData) {
            if (metric === 'top-language' && result.extraData.bytes) {
                const kb = (result.extraData.bytes / 1024).toFixed(1);
                message = `${message} (${kb} KB)`;
            } else if (result.extraData.count) {
                message = `${message} (${result.extraData.count} repos)`;
            }
        }

        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.json({
            schemaVersion: 1,
            label: config.label,
            message: message,
            color: config.color,
            namedLogo: config.logo,
            logoColor: 'white'
        });

    } catch (error) {
        console.error(`[ERROR] Unhandled error: ${error.message}`);
        sendErrorBadge(res, 'Internal server error');
    }
};
