import { formatNumber, formatSize, wrapText } from '../lib/formatters.js';
import themes from './themes.js';
import { octiconPaths } from './icons.js';

/**
 * Membersihkan dan menstandarkan format warna.
 * Menerima: '#fff', 'fff', 'ffffff', '#ffffff'
 * Mengembalikan: 'ffffff' (tanpa #)
 */
function cleanColor(color) {
    if (!color) return 'ffffff';
    let cleaned = String(color).trim().replace(/^#/, '');
    if (cleaned.length === 3) {
        cleaned = cleaned.split('').map(c => c + c).join('');
    }
    if (!/^[0-9A-Fa-f]{6}$/.test(cleaned)) {
        return 'ffffff';
    }
    return cleaned.toLowerCase();
}

/**
 * Menambahkan '#' di depan jika diperlukan untuk atribut SVG.
 */
function colorAttr(color) {
    return `#${cleanColor(color)}`;
}

export function renderStatsCard(stats, options = {}) {
    const theme = themes[options.theme] || themes.default;
    const hide = options.hide ? new Set(options.hide.split(',')) : new Set();
    const showIcons = options.show_icons === 'true' || options.show_icons === true;
    const hideRank = options.hide_rank === 'true';
    const disableAnimations = options.disable_animations === 'true';
    const customTitle = options.custom_title || stats.displayName || stats.name;

    // Konfigurasi layout standar
    const cardWidth = options.card_width ? parseInt(options.card_width) : (hideRank ? 350 : 495);
    const lineHeight = options.line_height ? parseInt(options.line_height) : 25;
    const padding = 25;
    const titleY = 45;
    const borderRadius = options.border_radius || '4.5';
    
    // Posisi lingkaran rank (mirip dengan github-readme-stats)
    const rankCircleX = cardWidth - 65;
    const rankCircleY = 55;
    const rankCircleRadius = 35;
    const rankCircleStrokeWidth = 5;

    // Warna
    const rawBgColor = options.bg_color || theme.bgColor;
    const rawTitleColor = options.title_color || theme.titleColor;
    const rawTextColor = options.text_color || theme.textColor;
    const rawIconColor = options.icon_color || theme.iconColor;
    const rawBorderColor = options.border_color || theme.borderColor;
    const rawRingColor = options.ring_color || theme.ringColor;

    const titleColor = cleanColor(rawTitleColor);
    const textColor = cleanColor(rawTextColor);
    const iconColor = cleanColor(rawIconColor);
    const borderColor = cleanColor(rawBorderColor);
    const ringColor = cleanColor(rawRingColor);

    const hideBorder = options.hide_border === 'true';

    // Deteksi gradient
    let isGradient = false;
    let gradientId = null;
    let gradientAngle = 0;
    let gradientStops = [];

    if (typeof rawBgColor === 'string' && rawBgColor.includes(',')) {
        isGradient = true;
        const parts = rawBgColor.split(',').map(p => p.trim());
        gradientAngle = parseInt(parts[0], 10) || 0;
        gradientStops = parts.slice(1).map(c => cleanColor(c));
        gradientId = `g${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    }

    const bgColor = cleanColor(rawBgColor);

    // Metrik
    const metricDefs = [
        { key: 'totalStars', label: 'Total Stars', value: stats.totalStars, format: formatNumber, icon: 'star' },
        { key: 'totalForks', label: 'Total Forks', value: stats.totalForks, format: formatNumber, icon: 'repo-forked' },
        { key: 'totalCommits', label: 'Total Commits', value: stats.totalCommits, format: formatNumber, icon: 'git-commit' }, // <-- BARU
        { key: 'openPRs', label: 'Open PRs', value: stats.openPRs, format: formatNumber, icon: 'git-pull-request' },
        { key: 'openIssues', label: 'Open Issues', value: stats.openIssues, format: formatNumber, icon: 'issue-opened' },
        { key: 'publicRepos', label: 'Public Repos', value: stats.publicRepos, format: formatNumber, icon: 'repo' },
        { key: 'totalSize', label: 'Total Size', value: stats.totalSize, format: formatSize, icon: 'database' },
        { key: 'members', label: 'Members', value: stats.members, format: formatNumber, icon: 'person' },
        { key: 'followers', label: 'Followers', value: stats.followers, format: formatNumber, icon: 'people' },
        { key: 'topLanguage', label: 'Top Language', value: stats.topLanguage, format: (v) => v, icon: 'code' },
        { key: 'languagesCount', label: 'Languages', value: stats.languagesCount, format: formatNumber, icon: 'code-square' },
        { key: 'totalWatchers', label: 'Total Watchers', value: stats.totalWatchers, format: formatNumber, icon: 'eye' }
    ];

    const visibleMetrics = metricDefs.filter(m => !hide.has(m.key));
    const visibleMetricsCount = visibleMetrics.length;

    // Hitung tinggi kartu
    const titleLines = wrapText(customTitle, cardWidth - 2 * padding - (hideRank ? 0 : 50), 18);
    const titleHeight = titleLines.length * 22;
    const statsStartY = titleY + titleHeight + 15;
    const statsHeight = visibleMetricsCount * lineHeight;
    const cardHeight = statsStartY + statsHeight + padding;

    // === MULAI SVG ===
    let svg = `<svg width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Organization Stats Card">`;

    // === DEFS (Gradient & Animasi) ===
    if (isGradient) {
        svg += `<defs>`;
        svg += `<linearGradient id="${gradientId}" gradientTransform="rotate(${gradientAngle})">`;
        gradientStops.forEach((color, index) => {
            const offset = (index / (gradientStops.length - 1)) * 100;
            svg += `<stop offset="${offset}%" stop-color="#${color}"/>`;
        });
        svg += `</linearGradient>`;
        svg += `</defs>`;
    }

    if (!disableAnimations) {
        svg += `<style>`;
        svg += `@keyframes rankAnimation { from { stroke-dashoffset: 251.2; } to { stroke-dashoffset: ${251.2 * (1 - (stats.rank?.percentile || 0) / 100)}; } }`;
        svg += `.rank-circle { animation: rankAnimation 1s ease-in-out forwards; }`;
        svg += `</style>`;
    }

    // === BACKGROUND ===
    const bgFill = isGradient ? `url(#${gradientId})` : `#${bgColor}`;
    if (!hideBorder) {
        svg += `<rect width="${cardWidth}" height="${cardHeight}" rx="${borderRadius}" fill="${bgFill}" stroke="#${borderColor}" stroke-width="2"/>`;
    } else {
        svg += `<rect width="${cardWidth}" height="${cardHeight}" rx="${borderRadius}" fill="${bgFill}"/>`;
    }

    // === JUDUL ===
    let currentTitleY = titleY;
    for (const line of titleLines) {
        svg += `<text x="${padding}" y="${currentTitleY}" font-family="'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif" font-size="18" font-weight="bold" fill="#${titleColor}">${escapeXml(line)}</text>`;
        currentTitleY += 22;
    }

    // === LINGKARAN RANK (jika tidak disembunyikan) ===
    if (!hideRank && stats.rank) {
        const rank = stats.rank;
        const percentile = rank.percentile || 0;
        const circumference = 2 * Math.PI * rankCircleRadius;
        const progress = circumference * (1 - percentile / 100);
        
        // Lingkaran latar (abu-abu)
        svg += `<circle cx="${rankCircleX}" cy="${rankCircleY}" r="${rankCircleRadius}" fill="none" stroke="#${borderColor}" stroke-width="${rankCircleStrokeWidth}" opacity="0.2"/>`;
        // Lingkaran progress
        svg += `<circle cx="${rankCircleX}" cy="${rankCircleY}" r="${rankCircleRadius}" fill="none" stroke="#${ringColor}" stroke-width="${rankCircleStrokeWidth}" stroke-dasharray="${circumference}" stroke-dashoffset="${disableAnimations ? progress : circumference}" class="${disableAnimations ? '' : 'rank-circle'}" stroke-linecap="round" transform="rotate(-90 ${rankCircleX} ${rankCircleY})"/>`;
        
        // Teks rank
        svg += `<text x="${rankCircleX}" y="${rankCircleY - 5}" text-anchor="middle" font-family="'Segoe UI', Ubuntu, Sans-Serif" font-size="16" font-weight="bold" fill="#${textColor}">${rank.level || 'C+'}</text>`;
        svg += `<text x="${rankCircleX}" y="${rankCircleY + 15}" text-anchor="middle" font-family="'Segoe UI', Ubuntu, Sans-Serif" font-size="10" fill="#${textColor}">${percentile}%</text>`;
    }

    // === METRIK (Dua Kolom) ===
    let yPos = statsStartY;
    const colWidth = (cardWidth - 2 * padding - (hideRank ? 0 : 50)) / 2;
    const leftColX = padding;
    const rightColX = padding + colWidth + (hideRank ? 0 : 25);

    for (let i = 0; i < visibleMetricsCount; i += 2) {
        const leftMetric = visibleMetrics[i];
        const rightMetric = visibleMetrics[i + 1];
        
        // Render metrik kiri
        if (leftMetric) {
            svg += renderMetric(leftMetric, leftColX, yPos, showIcons, iconColor, textColor);
        }
        
        // Render metrik kanan
        if (rightMetric) {
            svg += renderMetric(rightMetric, rightColX, yPos, showIcons, iconColor, textColor);
        }
        
        yPos += lineHeight;
    }

    svg += `</svg>`;
    return svg;
}

function renderMetric(metric, x, y, showIcons, iconColor, textColor) {
    let svg = '';
    const formattedValue = metric.format(metric.value);
    const iconOffset = showIcons && metric.icon ? 20 : 0;
    const textX = x + iconOffset;

    if (showIcons && metric.icon && octiconPaths[metric.icon]) {
        const iconPath = octiconPaths[metric.icon];
        const iconY = y - 11;
        svg += `<g transform="translate(${x}, ${iconY})" fill="#${iconColor}">`;
        svg += `<path d="${iconPath}" fill-rule="evenodd"/>`;
        svg += `</g>`;
    }

    svg += `<text x="${textX}" y="${y}" font-family="'Segoe UI', Ubuntu, Sans-Serif" font-size="13" fill="#${textColor}">${escapeXml(metric.label)}:</text>`;
    svg += `<text x="${x + 180}" y="${y}" font-family="'Segoe UI', Ubuntu, Sans-Serif" font-size="13" font-weight="bold" fill="#${textColor}">${escapeXml(formattedValue)}</text>`;
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
