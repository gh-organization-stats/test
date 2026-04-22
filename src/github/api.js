import fetch from 'node-fetch';
import { GITHUB_API_BASE, GITHUB_TOKEN, PER_PAGE } from '../config.js';

// ==================== Konfigurasi GraphQL ====================
const GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

// Cache untuk fetchAllOrgRepos (6 jam)
const cache = new Map();
const CACHE_TTL = 6 * 60 * 60 * 1000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Eksekusi kueri GraphQL dengan retry.
 * (Tidak di-cache di sini, caching dilakukan di level fetchAllOrgRepos)
 */
async function graphqlRequest(query, variables = {}) {
    const headers = {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
    };

    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(GRAPHQL_ENDPOINT, {
                method: 'POST',
                headers,
                body: JSON.stringify({ query, variables }),
            });

            const result = await response.json();

            // Log rate limit (opsional)
            const remaining = response.headers.get('x-ratelimit-remaining');
            const limit = response.headers.get('x-ratelimit-limit');
            if (remaining && limit) {
                console.log(`[GRAPHQL] Rate limit: ${remaining}/${limit}`);
            }

            if (result.errors) {
                const error = result.errors[0];
                throw new Error(`GraphQL Error: ${error.message}`);
            }

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            return result.data;
        } catch (error) {
            lastError = error;
            if (attempt < MAX_RETRIES) {
                console.warn(`[GRAPHQL] Attempt ${attempt} failed, retrying...`);
                await sleep(RETRY_DELAY);
            }
        }
    }
    throw lastError;
}

// ==================== Fungsi Publik (Antarmuka Lama) ====================

/**
 * Cek apakah akun adalah organisasi.
 * (Tetap menggunakan REST karena ringan dan GraphQL tidak memberi keuntungan)
 */
export async function isOrganization(owner) {
    const url = `${GITHUB_API_BASE}/users/${owner}`;
    const response = await fetch(url, {
        headers: GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}
    });

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
 * Mengambil SEMUA repositori publik dari organisasi menggunakan GraphQL.
 * Antarmuka dan nilai kembalian sama seperti versi REST, tetapi di belakang layar pakai GraphQL.
 * Hasilnya di-cache selama 6 jam.
 * 
 * @param {string} org - Nama organisasi
 * @returns {Promise<Array>} - Array objek repo dengan struktur yang kompatibel
 */
export async function fetchAllOrgRepos(org) {
    // Cek cache
    const now = Date.now();
    const cached = cache.get(org);
    if (cached && cached.expires > now) {
        console.log(`[CACHE] Hit for org: ${org}`);
        return cached.data;
    }

    console.log(`[INFO] Fetching all repos for ${org} via GraphQL (cache miss)`);
    
    const repos = [];
    let hasNextPage = true;
    let endCursor = null;

    while (hasNextPage) {
        const query = `
            query ($login: String!, $cursor: String) {
                organization(login: $login) {
                    repositories(first: 100, after: $cursor, orderBy: {field: UPDATED_AT, direction: DESC}) {
                        pageInfo {
                            hasNextPage
                            endCursor
                        }
                        nodes {
                            name
                            full_name: nameWithOwner
                            stargazers_count: stargazerCount
                            forks_count: forkCount
                            watchers_count: watchers {
                                totalCount
                            }
                            size: diskUsage
                            open_issues_count: issues(states: OPEN) {
                                totalCount
                            }
                            language: primaryLanguage {
                                name
                            }
                            license {
                                key
                            }
                            topics: repositoryTopics(first: 10) {
                                nodes {
                                    topic {
                                        name
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `;

        const data = await graphqlRequest(query, { login: org, cursor: endCursor });
        const repoData = data.organization?.repositories;

        if (!repoData) break;

        // Transformasi data GraphQL ke struktur yang kompatibel dengan kode lama (REST-like)
        for (const node of repoData.nodes) {
            const transformed = {
                name: node.name,
                full_name: node.full_name,
                stargazers_count: node.stargazers_count,
                forks_count: node.forks_count,
                watchers_count: node.watchers_count,
                size: node.size || 0,
                open_issues_count: node.open_issues_count,
                language: node.language?.name || null,
                license: node.license ? { key: node.license.key } : null,
                topics: node.topics?.nodes?.map(t => t.topic.name) || []
            };
            repos.push(transformed);
        }

        hasNextPage = repoData.pageInfo.hasNextPage;
        endCursor = repoData.pageInfo.endCursor;

        console.log(`[GRAPHQL] Fetched ${repos.length} repos so far...`);
    }

    console.log(`[INFO] Total ${repos.length} repos fetched for ${org}. Caching for 6 hours.`);
    
    cache.set(org, {
        data: repos,
        expires: now + CACHE_TTL
    });

    return repos;
}
