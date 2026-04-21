import { formatNumber, formatSize, wrapText } from '../lib/formatters.js';
import themes from './themes.js';

/**
 * Render stats card SVG.
 * @param {Object} stats - Data statistik dari fetcher
 * @param {Object} options - Opsi kustomisasi { theme, hide, show_icons }
 * @returns {string} - String SVG
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
    const lineHeight = 28;
    
    // Tentukan metrik yang akan ditampilkan
    const metricDefs = [
        { key: 'totalStars', label: 'Total Stars', value: stats.totalStars, format: formatNumber, icon: '⭐' },
        { key: 'totalForks', label: 'Total Forks', value: stats.totalForks, format: formatNumber, icon: '🍴' },
        { key: 'openIssues', label: 'Open Issues', value: stats.openIssues, format: formatNumber, icon: '⚠️' },
        { key: 'openPRs', label: 'Open PRs', value: stats.openPRs, format: formatNumber, icon: '🔀' },
        { key: 'publicRepos', label: 'Public Repos', value: stats.publicRepos, format: formatNumber, icon: '📦' },
        { key: 'followers', label: 'Followers', value: stats.followers, format: formatNumber, icon: '👥' },
        { key: 'members', label: 'Members', value: stats.members, format: formatNumber, icon: '👤' },
        { key: 'topLanguage', label: 'Top Language', value: stats.topLanguage, format: (v) => v, icon: '📊' },
        { key: 'languagesCount', label: 'Languages', value: stats.languagesCount, format: formatNumber, icon: '🌈' },
        { key: 'totalSize', label: 'Total Size', value: stats.totalSize, format: formatSize, icon: '💾' },
        { key: 'totalWatchers', label: 'Total Watchers', value: stats.totalWatchers, format: formatNumber, icon: '👀' }
    ];

    const visibleMetrics = metricDefs.filter(m => !hide.has(m.key));
    
    // Hitung tinggi kartu berdasarkan jumlah metrik
    const cardHeight = titleY + 30 + (visibleMetrics.length * lineHeight) + padding;
    
    // Mulai bangun SVG
    let svg = `<svg width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Organization Stats Card">`;
    
    // Background
    svg += `<rect width="${cardWidth}" height="${cardHeight}" rx="10" fill="${theme.bgColor}" stroke="${theme.borderColor}" stroke-width="2"/>`;
    
    // Judul (nama organisasi)
    const displayName = stats.displayName || stats.name;
    const titleLines = wrapText(displayName, cardWidth - 2 * padding, 18);
    let currentTitleY = titleY;
    for (const line of titleLines) {
        svg += `<text x="${cardWidth / 2}" y="${currentTitleY}" text-anchor="middle" font-family="'Segoe UI', Ubuntu, Sans-Serif" font-size="18" font-weight="bold" fill="${theme.titleColor}">${escapeXml(line)}</text>`;
        currentTitleY += 22;
    }
    
    // Garis pemisah
    svg += `<line x1="${padding}" y1="${currentTitleY + 5}" x2="${cardWidth - padding}" y2="${currentTitleY + 5}" stroke="${theme.borderColor}" stroke-width="1"/>`;
    
    // Mulai metrik
    let yPos = currentTitleY + 25;
    
    for (const metric of visibleMetrics) {
        const formattedValue = metric.format(metric.value);
        
        if (showIcons) {
            // Dengan ikon (teks ikon diletakkan sebelum label)
            svg += `<text x="${padding}" y="${yPos}" font-family="'Segoe UI', Ubuntu, Sans-Serif" font-size="14" fill="${theme.textColor}">${metric.icon}  ${escapeXml(metric.label)}:</text>`;
        } else {
            // Tanpa ikon
            svg += `<text x="${padding}" y="${yPos}" font-family="'Segoe UI', Ubuntu, Sans-Serif" font-size="14" fill="${theme.textColor}">${escapeXml(metric.label)}:</text>`;
        }
        
        // Nilai (rata kanan)
        svg += `<text x="${cardWidth - padding}" y="${yPos}" text-anchor="end" font-family="'Segoe UI', Ubuntu, Sans-Serif" font-size="14" font-weight="bold" fill="${theme.textColor}">${escapeXml(formattedValue)}</text>`;
        
        yPos += lineHeight;
    }
    
    svg += `</svg>`;
    return svg;
}

/**
 * Escape karakter XML untuk mencegah injeksi.
 */
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
