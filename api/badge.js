import handleBadgeRequest from '../src/badge/handler.js';

export default async function handler(req, res) {
    return handleBadgeRequest(req, res);
}
