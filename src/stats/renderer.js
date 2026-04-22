// src/stats/renderer.js
import { formatNumber, formatSize, wrapText } from '../lib/formatters.js';
import themes from './themes.js';
import { octiconPaths } from './icons.js';

// --- Helpers ---
function cleanColor(color) {
    if (!color) return 'ffffff';
    let cleaned = String(color).trim().replace(/^#/, '');
    if (cleaned.length === 3) cleaned = cleaned.split('').map(c => c + c).join('');
    return /^[0-9A-Fa-f]{6}$/.test(cleaned) ? cleaned.toLowerCase() : 'ffffff';
}
const colorAttr = (c) => `#${cleanColor(c)}`;

// Estimasi lebar teks (13px Segoe UI)
const CHAR_WIDTH = 7.2;
function measureTextWidth(text) {
    return text.length * CHAR_WIDTH;
}

// Konstanta layout
const PADDING = 25;
const TITLE_FONT_SIZE = 18;
const METRIC_FONT_SIZE = 13;
const LINE_HEIGHT = 26;
const RANK_RADIUS = 32;
const RANK_STROKE = 5;
const ICON_SIZE = 16;
const ICON_SPACING = 6;

export function renderStatsCard(stats, options = {}) {
    const theme = themes[options.theme] || themes.default;
    const hide = new Set((options.hide || '').split(',').filter(Boolean));
    const showIcons = options.show_icons === 'true';
    const hideRank = options.hide_rank === 'true';
    const disableAnimations = options.disable_animations === 'true';
    const customTitle = options.custom_title || stats.displayName || stats.name;
    const hideBorder = options.hide_border === 'true';
    const borderRadius = options.border_radius || '4.5';

    // Warna
    const titleColor = cleanColor(options.title_color || theme.titleColor);
    const textColor = cleanColor(options.text_color || theme.textColor);
    const iconColor = cleanColor(options.icon_color || theme.iconColor);
    const borderColor = cleanColor(options.border_color || theme.borderColor);
    const ringColor = cleanColor(options.ring_color || theme.ringColor);
    const rawBgColor = options.bg_color || theme.bgColor;

    // Gradient
    let isGradient = false, gradientId = null, gradientAngle = 0, gradientStops = [];
    if (typeof rawBgColor === 'string' && rawBgColor.includes(',')) {
        isGradient = true;
        const parts = rawBgColor.split(',').map(p => p.trim());
        gradientAngle = parseInt(parts[0], 10) || 0;
        gradientStops = parts.slice(1).map(c => cleanColor(c));
        gradientId = `g${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    }
    const bgColor = cleanColor(rawBgColor);

    // --- Metrik yang ditampilkan ---
    const metricDefs = [
        { key: 'totalStars', label: 'Total Stars', value: stats.totalStars, format: formatNumber, icon: 'star' },
        { key: 'totalForks', label: 'Total Forks', value: stats.totalForks, format: formatNumber, icon: 'repo-forked' },
        { key: 'totalCommits', label: 'Total Commits', value: stats.totalCommits, format: formatNumber, icon: 'git-commit' },
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
    const metricsCount = visibleMetrics.length;

    // Format semua nilai terlebih dahulu
    const formattedValues = visibleMetrics.map(m => m.format(m.value));

    // Hitung lebar konten maksimum (label + nilai)
    let maxContentWidth = 0;
    for (let i = 0; i < visibleMetrics.length; i++) {
        const labelWidth = measureTextWidth(visibleMetrics[i].label + ': ');
        const valueWidth = measureTextWidth(formattedValues[i]);
        const iconWidth = showIcons ? ICON_SIZE + ICON_SPACING : 0;
        const total = labelWidth + valueWidth + iconWidth;
        if (total > maxContentWidth) maxContentWidth = total;
    }

    // Lebar kartu = konten + padding kiri/kanan + ruang untuk rank circle jika ada
    let cardWidth = Math.max(
        options.card_width ? parseInt(options.card_width) : 0,
        maxContentWidth + 2 * PADDING + (hideRank ? 0 : RANK_RADIUS * 2 + 20),
        350
    );

    // Judul dan tinggi
    const maxTitleWidth = cardWidth - 2 * PADDING - (hideRank ? 0 : RANK_RADIUS * 2 + 10);
    const titleLines = wrapText(customTitle, maxTitleWidth, TITLE_FONT_SIZE);
    const titleHeight = titleLines.length * (TITLE_FONT_SIZE + 4);
    const statsStartY = PADDING + titleHeight + 15;
    const statsHeight = Math.ceil(metricsCount / 2) * LINE_HEIGHT;
    const cardHeight = statsStartY + statsHeight + PADDING;

    // Posisi rank circle
    const rankCircleX = cardWidth - PADDING - RANK_RADIUS;
    const rankCircleY = PADDING + TITLE_FONT_SIZE;

    // --- Bangun SVG ---
    const svgParts = [];
    svgParts.push(`<svg width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Organization Stats Card">`);

    // Defs
    if (isGradient) {
        svgParts.push(`<defs><linearGradient id="${gradientId}" gradientTransform="rotate(${gradientAngle})">`);
        gradientStops.forEach((c, i) => {
            const offset = (i / (gradientStops.length - 1)) * 100;
            svgParts.push(`<stop offset="${offset}%" stop-color="#${c}"/>`);
        });
        svgParts.push(`</linearGradient></defs>`);
    }

    // Animasi
    if (!disableAnimations && !hideRank && stats.rank) {
        const circ = 2 * Math.PI * RANK_RADIUS;
        const target = circ * (1 - (stats.rank.percentile || 0) / 100);
        svgParts.push(`<style>@keyframes rank{from{stroke-dashoffset:${circ}}to{stroke-dashoffset:${target}}}.rank-circle{animation:rank 1s ease forwards}</style>`);
    }

    // Background
    const bgFill = isGradient ? `url(#${gradientId})` : colorAttr(bgColor);
    if (!hideBorder) {
        svgParts.push(`<rect width="${cardWidth}" height="${cardHeight}" rx="${borderRadius}" fill="${bgFill}" stroke="${colorAttr(borderColor)}" stroke-width="2"/>`);
    } else {
        svgParts.push(`<rect width="${cardWidth}" height="${cardHeight}" rx="${borderRadius}" fill="${bgFill}"/>`);
    }

    // Judul
    let titleY = PADDING + TITLE_FONT_SIZE;
    titleLines.forEach(line => {
        svgParts.push(`<text x="${PADDING}" y="${titleY}" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="${TITLE_FONT_SIZE}" font-weight="bold" fill="${colorAttr(titleColor)}">${escapeXml(line)}</text>`);
        titleY += TITLE_FONT_SIZE + 4;
    });

    // Rank Circle
    if (!hideRank && stats.rank) {
        const rank = stats.rank;
        const circ = 2 * Math.PI * RANK_RADIUS;
        const progress = circ * (1 - rank.percentile / 100);
        svgParts.push(`<circle cx="${rankCircleX}" cy="${rankCircleY}" r="${RANK_RADIUS}" fill="none" stroke="${colorAttr(borderColor)}" stroke-width="${RANK_STROKE}" opacity="0.2"/>`);
        svgParts.push(`<circle cx="${rankCircleX}" cy="${rankCircleY}" r="${RANK_RADIUS}" fill="none" stroke="${colorAttr(ringColor)}" stroke-width="${RANK_STROKE}" stroke-dasharray="${circ}" stroke-dashoffset="${disableAnimations ? progress : circ}" class="rank-circle" stroke-linecap="round" transform="rotate(-90 ${rankCircleX} ${rankCircleY})"/>`);
        svgParts.push(`<text x="${rankCircleX}" y="${rankCircleY - 4}" text-anchor="middle" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="14" font-weight="bold" fill="${colorAttr(textColor)}">${rank.level || 'C+'}</text>`);
        svgParts.push(`<text x="${rankCircleX}" y="${rankCircleY + 14}" text-anchor="middle" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="9" fill="${colorAttr(textColor)}">${rank.percentile}%</text>`);
    }

    // Metrik dalam dua kolom
    const colSpacing = 30;
    const colWidth = (cardWidth - 2 * PADDING - (hideRank ? 0 : 60) - colSpacing) / 2;
    const leftX = PADDING;
    const rightX = PADDING + colWidth + colSpacing;

    let yPos = statsStartY;
    for (let i = 0; i < metricsCount; i += 2) {
        const left = visibleMetrics[i];
        const right = visibleMetrics[i + 1];

        if (left) {
            renderMetricToParts(svgParts, left, leftX, yPos, formattedValues[i], showIcons, iconColor, textColor);
        }
        if (right) {
            renderMetricToParts(svgParts, right, rightX, yPos, formattedValues[i+1], showIcons, iconColor, textColor);
        }
        yPos += LINE_HEIGHT;
    }

    svgParts.push(`</svg>`);
    return svgParts.join('');
}

function renderMetricToParts(parts, metric, x, y, valueStr, showIcons, iconColor, textColor) {
    const iconOffset = showIcons && metric.icon ? ICON_SIZE + ICON_SPACING : 0;
    const textX = x + iconOffset;
    if (showIcons && metric.icon && octiconPaths[metric.icon]) {
        parts.push(`<g transform="translate(${x}, ${y - 11})" fill="${colorAttr(iconColor)}">`);
        parts.push(`<path d="${octiconPaths[metric.icon]}" fill-rule="evenodd"/>`);
        parts.push(`</g>`);
    }
    parts.push(`<text x="${textX}" y="${y}" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="${METRIC_FONT_SIZE}" fill="${colorAttr(textColor)}">${escapeXml(metric.label)}:</text>`);
    // Nilai di ujung kanan kolom (x + colWidth)
    const valueX = x + 180; // gunakan lebar kolom yang lebih akurat
    parts.push(`<text x="${valueX}" y="${y}" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="${METRIC_FONT_SIZE}" font-weight="bold" fill="${colorAttr(textColor)}">${escapeXml(valueStr)}</text>`);
}

function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') unsafe = String(unsafe);
    return unsafe.replace(/[<>&'"]/g, c => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;'
    })[c]);
}
