import { fetchAllOrgRepos } from '../src/github/api.js';
import { fetchOrgStats } from '../src/stats/fetcher.js';
import { renderStatsCard } from '../src/stats/renderer.js';

export default async function handler(req, res) {
  try {
    const { org, exclude, theme, hide, show, show_icons, hide_rank, disable_animations, custom_title, hide_border, border_radius, card_width, bg_color, title_color, text_color, icon_color, border_color, ring_color, rank_icon } = req.query;

    if (!org) throw new Error('Parameter "org" is required');

    const repos = await fetchAllOrgRepos(org);
    let filteredRepos = repos;
    if (exclude) {
      const excludeList = exclude.split(',').map(s => s.trim().toLowerCase());
      filteredRepos = repos.filter(repo => {
        const name = repo.name.toLowerCase();
        const full = repo.nameWithOwner.toLowerCase();
        return !excludeList.some(ex => name === ex || full.endsWith(`/${ex}`) || full === ex);
      });
    }

    const stats = await fetchOrgStats(org, filteredRepos);

    const svg = await renderStatsCard(stats, {
      theme, hide, show, show_icons, hide_rank, disable_animations, custom_title, hide_border, border_radius, card_width, bg_color, title_color, text_color, icon_color, border_color, ring_color, rank_icon
    });

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=21600');
    res.send(svg);

    } catch (error) {
        console.error('[Stats Error]', error);
        
        // Buat SVG error sederhana
        const errorSvg = `
            <svg width="500" height="150" xmlns="http://www.w3.org/2000/svg">
                <rect width="500" height="150" rx="10" fill="#fff" stroke="#e05d44" stroke-width="2"/>
                <text x="250" y="50" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#e05d44">Error</text>
                <text x="250" y="80" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#434d58">${escapeXml(error.message)}</text>
            </svg>
        `;
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'no-cache');
        res.status(500).send(errorSvg);
    }
}

function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') unsafe = String(unsafe);
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}
