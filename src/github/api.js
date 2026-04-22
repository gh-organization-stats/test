import fetch from 'node-fetch';
import { GITHUB_API_BASE, GITHUB_TOKEN } from '../config.js';

// ==================== Konfigurasi GraphQL ====================
const GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

// Cache untuk fetchAllOrgRepos (6 jam)
const cache = new Map();
const CACHE_TTL = 6 * 60 * 60 * 1000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

// ==================== Fungsi Publik ====================

/**
 * Cek apakah akun adalah organisasi (tetap REST).
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
 * Mengembalikan array dengan struktur yang kompatibel dengan REST API.
 */
export async function fetchAllOrgRepos(org) {
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
                            nameWithOwner
                            stargazerCount
                            forkCount
                            watchers {
                                totalCount
                            }
                            diskUsage
                            issues(states: OPEN) {
                                totalCount
                            }
                            pullRequests(states: OPEN) {
                                totalCount
                            }
                            primaryLanguage {
                                name
                            }
                            licenseInfo {
                                key
                                spdxId
                            }
                            repositoryTopics(first: 20) {
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

        // Transformasi ke format kompatibel REST
        for (const node of repoData.nodes) {
            const transformed = {
                name: node.name,
                full_name: node.nameWithOwner,
                stargazers_count: node.stargazerCount,
                forks_count: node.forkCount,
                watchers_count: node.watchers.totalCount,
                size: node.diskUsage || 0,
                open_issues_count: node.issues.totalCount,
                open_prs_count: node.openPRs?.totalCount || 0,
                language: node.primaryLanguage?.name || null,
                license: node.licenseInfo ? {
                    key: node.licenseInfo.key,
                    spdx_id: node.licenseInfo.spdxId
                } : null,
                topics: node.repositoryTopics?.nodes?.map(t => t.topic.name) || []
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

/**
 * Mengambil total commit untuk setiap repositori dalam array.
 * @param {Array} repos - Array repositori (setidaknya punya properti nameWithOwner)
 * @returns {Promise<Map<string, number>>} - Map dari full_name ke total commit
 */
export async function fetchAllReposCommitCounts(repos) {
    const commitCounts = new Map();
    
    // Batasi paralelisme agar tidak membebani API
    const batchSize = 5;
    for (let i = 0; i < repos.length; i += batchSize) {
        const batch = repos.slice(i, i + batchSize);
        const promises = batch.map(repo => fetchRepoCommitCount(repo.nameWithOwner));
        const results = await Promise.allSettled(promises);
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                commitCounts.set(batch[index].nameWithOwner, result.value);
            } else {
                console.warn(`Failed to fetch commits for ${batch[index].nameWithOwner}: ${result.reason}`);
                commitCounts.set(batch[index].nameWithOwner, 0);
            }
        });
        
        // Jeda kecil antar batch untuk menghormati rate limit sekunder
        if (i + batchSize < repos.length) {
            await sleep(200);
        }
    }
    
    return commitCounts;
}

/**
 * Mengambil total commit untuk satu repositori.
 */
async function fetchRepoCommitCount(repoFullName) {
    const [owner, name] = repoFullName.split('/');
    const query = `
        query ($owner: String!, $name: String!) {
            repository(owner: $owner, name: $name) {
                defaultBranchRef {
                    target {
                        ... on Commit {
                            history {
                                totalCount
                            }
                        }
                    }
                }
            }
        }
    `;
    
    const data = await graphqlRequest(query, { owner, name });
    return data.repository?.defaultBranchRef?.target?.history?.totalCount || 0;
}
