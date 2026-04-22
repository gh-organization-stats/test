import { formatNumber, formatSize, wrapText } from '../lib/formatters.js';
import themes from './themes.js';
import { octiconPaths } from './icons.js';

/**
 * Render stats card SVG dengan dukungan Octicons.
 */
export function renderStatsCard(stats, options = {}) {
    const theme = themes[options.theme] || themes.default;
    const hide = options.hide ? new Set(options.hide.split(',')) : new Set();
    const showIcons = options.show_icons === 'true' || options.show_icons === true;
    
    // Konfigurasi layout
    const cardWidth = 500;
    const padding = 20;
    const titleY = 50;
    const iconSize = 16;
    const iconOffset = iconSize + 6; // jarak dari ikon ke teks
    const lineHeight = 28;
    
    // Definisikan metrik yang akan ditampilkan beserta ikonnya
    const metricDefs = [
        { key: 'totalStars', label: 'Total Stars', value: stats.totalStars, format: formatNumber, icon: 'star' },
        { key: 'totalForks', label: 'Total Forks', value: stats.totalForks, format: formatNumber, icon: 'repo-forked' },
        { key: 'openIssues', label: 'Open Issues', value: stats.openIssues, format: formatNumber, icon: 'issue-opened' },
        { key: 'openPRs', label: 'Open PRs', value: stats.openPRs, format: formatNumber, icon: 'git-pull-request' },
        { key: 'publicRepos', label: 'Public Repos', value: stats.publicRepos, format: formatNumber, icon: 'repo' },
        { key: 'followers', label: 'Followers', value: stats.followers, format: formatNumber, icon: 'people' },
        { key: 'members', label: 'Members', value: stats.members, format: formatNumber, icon: 'person' },
        { key: 'topLanguage', label: 'Top Language', value: stats.topLanguage, format: (v) => v, icon: 'code' },
        { key: 'languagesCount', label: 'Languages', value: stats.languagesCount, format: formatNumber, icon: 'code-square' },
        { key: 'totalSize', label: 'Total Size', value: stats.totalSize, format: formatSize, icon: 'database' },
        { key: 'totalWatchers', label: 'Total Watchers', value: stats.totalWatchers, format: formatNumber, icon: 'eye' }
    ];

    const visibleMetrics = metricDefs.filter(m => !hide.has(m.key));
    
    // Hitung tinggi kartu
    const titleLineCount = wrapText(stats.displayName || stats.name, cardWidth - 2 * padding, 18).length;
    const titleHeight = titleLineCount * 22;
    const cardHeight = titleY + titleHeight + 10 + (visibleMetrics.length * lineHeight) + padding;
    
    // Mulai SVG
    let svg = `<svg width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Organization Stats Card">`;
    
    // Background
    svg += `<rect width="${cardWidth}" height="${cardHeight}" rx="10" fill="${theme.bgColor}" stroke="${theme.borderColor}" stroke-width="2"/>`;
    
    // Judul
    const displayName = stats.displayName || stats.name;
    const titleLines = wrapText(displayName, cardWidth - 2 * padding, 18);
    let currentTitleY = titleY;
    for (const line of titleLines) {
        svg += `<text x="${cardWidth / 2}" y="${currentTitleY}" text-anchor="middle" font-family="'Segoe UI', Ubuntu, Sans-Serif" font-size="18" font-weight="bold" fill="${theme.titleColor}">${escapeXml(line)}</text>`;
        currentTitleY += 22;
    }
    
    // Garis pemisah
    svg += `<line x1="${padding}" y1="${currentTitleY + 5}" x2="${cardWidth - padding}" y2="${currentTitleY + 5}" stroke="${theme.borderColor}" stroke-width="1"/>`;
    
    // Metrik
    let yPos = currentTitleY + 25;
    const textX = showIcons ? padding + iconOffset : padding;
    
    for (const metric of visibleMetrics) {
        const formattedValue = metric.format(metric.value);
        
        // Render ikon jika diaktifkan dan path tersedia
        if (showIcons && metric.icon && octiconPaths[metric.icon]) {
            const iconPath = octiconPaths[metric.icon];
            // Ikon 16x16, posisi y disesuaikan agar sejajar dengan teks
            const iconY = yPos - 11;
            svg += `<g transform="translate(${padding}, ${iconY})" fill="${theme.iconColor}">`;
            svg += `<path d="${iconPath}" fill-rule="evenodd"/>`;
            svg += `</g>`;
        }
        
        // Label
        svg += `<text x="${textX}" y="${yPos}" font-family="'Segoe UI', Ubuntu, Sans-Serif" font-size="14" fill="${theme.textColor}">${escapeXml(metric.label)}:</text>`;
        
        // Nilai (rata kanan)
        svg += `<text x="${cardWidth - padding}" y="${yPos}" text-anchor="end" font-family="'Segoe UI', Ubuntu, Sans-Serif" font-size="14" font-weight="bold" fill="${theme.textColor}">${escapeXml(formattedValue)}</text>`;
        
        yPos += lineHeight;
    }
    
    svg += `</svg>`;
    return svg;
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
