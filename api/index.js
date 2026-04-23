import { fetchAllOrgRepos } from '../src/github/api.js';
import { fetchOrgStats } from '../src/stats/fetcher.js';
import { renderStatsCard } from '../src/stats/renderer.js';

export default async function handler(req, res) {
  try {
    const { org, exclude, theme, hide, show, show_icons, hide_rank, disable_animations, custom_title, hide_border, border_radius, card_width, bg_color, title_color, text_color, icon_color, border_color, ring_color, rank_icon, all_bold, photo_resize, photo_quality } = req.query;

    if (!org) throw new Error('Parameter "org" is required');

    let resize = parseInt(photo_resize);
    if (isNaN(resize) || resize < 10) resize = 80;
    else if (resize > 250) resize = 250;

    let quality = parseInt(photo_quality);
    if (isNaN(quality) || quality < 1) quality = 90;
    else if (quality > 100) quality = 100;

    let stats;
    if (exclude) {
        const repos = await fetchAllOrgRepos(org);
        const excludeList = exclude.split(',').map(s => s.trim().toLowerCase());
        const filteredRepos = repos.filter(repo => {
            const name = repo.name.toLowerCase();
            const full = repo.full_name.toLowerCase();
            return !excludeList.some(ex => name === ex || full.endsWith(`/${ex}`) || full === ex);
        });
        stats = await fetchOrgStats(org, filteredRepos);
    } else {
        stats = await fetchOrgStats(org);
    }

    const svg = await renderStatsCard(stats, {
      theme, hide, show, show_icons, hide_rank, disable_animations, custom_title, hide_border, border_radius, card_width, bg_color, title_color, text_color, icon_color, border_color, ring_color, rank_icon, all_bold,
      photo_resize: resize,
      photo_quality: quality
    });

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=21600');
    res.send(svg);

    } catch (error) {
        console.error('[Stats Error]', error);
        
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
