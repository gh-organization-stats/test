export const BADGE_SERVICE_BASE = 'https://custom-icon-badges.demolab.com';
export const GITHUB_API_BASE = 'https://api.github.com';

export const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
export const githubHeaders = GITHUB_TOKEN
    ? { Authorization: `token ${GITHUB_TOKEN}` }
    : {};
