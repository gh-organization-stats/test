import { formatNumber, formatSize, measureTextWidth, wrapText } from '../lib/formatters.js';
import themes from './themes.js';
import { octiconPaths } from './icons.js';

// --- Konstanta & Helper ---
const CARD_MIN_WIDTH = 287;
const CARD_DEFAULT_WIDTH = 287;
const RANK_CARD_MIN_WIDTH = 420;
const RANK_CARD_DEFAULT_WIDTH = 450;
const RANK_ONLY_CARD_MIN_WIDTH = 290;
const RANK_ONLY_CARD_DEFAULT_WIDTH = 290;
const PADDING = 25;
const LINE_HEIGHT = 26;
const TITLE_FONT_SIZE = 18;
const METRIC_FONT_SIZE = 13;

function cleanColor(color) {
    if (!color) return 'ffffff';
    let cleaned = String(color).trim().replace(/^#/, '');
    if (cleaned.length === 3) cleaned = cleaned.split('').map(c => c + c).join('');
    return /^[0-9A-Fa-f]{6}$/.test(cleaned) ? cleaned.toLowerCase() : 'ffffff';
}
const colorAttr = (c) => `#${cleanColor(c)}`;

// Layout flex vertikal
function flexLayout({ items, gap, direction }) {
    if (direction !== "column") {
        console.warn("flexLayout hanya mendukung arah 'column' untuk layout vertikal.");
        return items;
    }
    return items.map((item, index) => {
        return `<g transform="translate(0, ${index * gap})">${item}</g>`;
    });
}

// --- Definisi Metrik ---
const METRIC_DEFS = {
    totalStars: { label: 'Total Stars', icon: 'star' },
    totalForks: { label: 'Total Forks', icon: 'repo-forked' },
    totalCommits: { label: 'Total Commits', icon: 'git-commit' },
    openPRs: { label: 'Open PRs', icon: 'git-pull-request' },
    openIssues: { label: 'Open Issues', icon: 'issue-opened' },
    publicRepos: { label: 'Public Repos', icon: 'repo' },
    totalSize: { label: 'Total Size', icon: 'database' },
    members: { label: 'Members', icon: 'person' },
    followers: { label: 'Followers', icon: 'people' },
    topLanguage: { label: 'Top Language', icon: 'code' },
    languagesCount: { label: 'Languages', icon: 'code-square' },
    totalWatchers: { label: 'Total Watchers', icon: 'eye' },
};

// --- Fungsi Render Utama ---
export function renderStatsCard(stats, options = {}) {
    const theme = themes[options.theme] || themes.default;
    const hide = new Set((options.hide || '').split(',').filter(Boolean));
    const show = new Set((options.show || '').split(',').filter(Boolean));
    const showIcons = options.show_icons === 'true';
    const hideRank = options.hide_rank === 'true';
    const disableAnimations = options.disable_animations === 'true';
    const customTitle = options.custom_title || stats.displayName || stats.name;
    const hideBorder = options.hide_border === 'true';
    const borderRadius = options.border_radius || '4.5';
    const card_width = options.card_width ? parseInt(options.card_width) : null;
    const number_format = options.number_format || 'short';
    const locale = options.locale || 'en';

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

    // --- Kumpulkan metrik yang akan ditampilkan ---
    const statItems = [];
    for (const [key, def] of Object.entries(METRIC_DEFS)) {
        if (hide.has(key)) continue; // 1. Abaikan jika di-hide
        
        // 2. Metrik dasar selalu tampil, kecuali di-hide
        const isCoreMetric = ['totalStars', 'totalForks', 'totalCommits', 'openPRs', 'openIssues', 'publicRepos', 'totalSize'].includes(key);
        if (isCoreMetric || show.has(key)) {
            let value = stats[key];
            if (value === undefined) continue;
            
            let formattedValue;
            if (key === 'totalSize') formattedValue = formatSize(value);
            else if (key === 'topLanguage') formattedValue = value;
            else formattedValue = formatNumber(value);
            
            statItems.push({
                key, label: def.label, value: formattedValue, icon: def.icon
            });
        }
    }

    // --- Buat node teks untuk setiap item ---
    const createTextNode = (item, index) => {
        const iconSvg = showIcons && item.icon && octiconPaths[item.icon]
            ? `<g transform="translate(0, -3)" fill="${colorAttr(iconColor)}"><path d="${octiconPaths[item.icon]}" fill-rule="evenodd"/></g>`
            : '';
        const labelX = showIcons ? '25' : '0';
        const valueX = '200'; // Posisi nilai akan dihitung ulang
        
        return `
            <g transform="translate(${PADDING}, ${index * LINE_HEIGHT})">
                ${iconSvg}
                <text x="${labelX}" y="0" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="${METRIC_FONT_SIZE}" fill="${colorAttr(textColor)}">${escapeXml(item.label)}:</text>
                <text x="${valueX}" y="0" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="${METRIC_FONT_SIZE}" font-weight="bold" fill="${colorAttr(textColor)}">${escapeXml(item.value)}</text>
            </g>
        `;
    };

    const statNodes = statItems.map((item, index) => createTextNode(item, index));
    
    // Hitung lebar konten terpanjang
    let maxContentWidth = 0;
    statItems.forEach(item => {
        const labelWidth = measureTextWidth(item.label + ': ', METRIC_FONT_SIZE);
        const valueWidth = measureTextWidth(item.value, METRIC_FONT_SIZE);
        const iconWidth = showIcons ? 25 : 0;
        maxContentWidth = Math.max(maxContentWidth, labelWidth + valueWidth + iconWidth);
    });
    
    const titleWidth = measureTextWidth(customTitle, TITLE_FONT_SIZE);
    maxContentWidth = Math.max(maxContentWidth, titleWidth);
    
    // Hitung lebar kartu
    const iconWidth = showIcons && statItems.length ? 16 + 1 : 0;
    let minCardWidth = hideRank ? Math.max(50 + maxContentWidth, CARD_MIN_WIDTH) : (statItems.length ? RANK_CARD_MIN_WIDTH : RANK_ONLY_CARD_MIN_WIDTH) + iconWidth;
    let defaultCardWidth = hideRank ? CARD_DEFAULT_WIDTH : (statItems.length ? RANK_CARD_DEFAULT_WIDTH : RANK_ONLY_CARD_DEFAULT_WIDTH) + iconWidth;
    let width = card_width || defaultCardWidth;
    if (width < minCardWidth) width = minCardWidth;
    
    // Hitung tinggi kartu
    const titleLines = wrapText(customTitle, width - 2 * PADDING - (hideRank ? 0 : 70), TITLE_FONT_SIZE);
    const titleHeight = titleLines.length * (TITLE_FONT_SIZE + 4);
    const statsStartY = PADDING + titleHeight + 15;
    let height = Math.max(45 + (statItems.length + 1) * LINE_HEIGHT, hideRank ? 0 : statItems.length ? 150 : 180);
    
    // --- Bangun SVG ---
    const svgParts = [];
    svgParts.push(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Organization Stats Card">`);
    
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
        const circ = 2 * Math.PI * 40; // radius 40
        const target = ((100 - (stats.rank.percentile || 0)) / 100) * circ;
        svgParts.push(`<style>@keyframes rank{from{stroke-dashoffset:${circ}}to{stroke-dashoffset:${target}}}.rank-circle{animation:rank 1s ease forwards}</style>`);
    }
    
    // Background
    const bgFill = isGradient ? `url(#${gradientId})` : colorAttr(bgColor);
    if (!hideBorder) {
        svgParts.push(`<rect width="${width}" height="${height}" rx="${borderRadius}" fill="${bgFill}" stroke="${colorAttr(borderColor)}" stroke-width="2"/>`);
    } else {
        svgParts.push(`<rect width="${width}" height="${height}" rx="${borderRadius}" fill="${bgFill}"/>`);
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
        const rankCircleX = width - PADDING - 40;
        const rankCircleY = PADDING + TITLE_FONT_SIZE;
        const circ = 2 * Math.PI * 40;
        const progress = ((100 - rank.percentile) / 100) * circ;
        svgParts.push(`<circle cx="${rankCircleX}" cy="${rankCircleY}" r="40" fill="none" stroke="${colorAttr(borderColor)}" stroke-width="5" opacity="0.2"/>`);
        svgParts.push(`<circle cx="${rankCircleX}" cy="${rankCircleY}" r="40" fill="none" stroke="${colorAttr(ringColor)}" stroke-width="5" stroke-dasharray="${circ}" stroke-dashoffset="${disableAnimations ? progress : circ}" class="rank-circle" stroke-linecap="round" transform="rotate(-90 ${rankCircleX} ${rankCircleY})"/>`);
        svgParts.push(`<text x="${rankCircleX}" y="${rankCircleY - 4}" text-anchor="middle" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="14" font-weight="bold" fill="${colorAttr(textColor)}">${rank.level || 'C+'}</text>`);
        svgParts.push(`<text x="${rankCircleX}" y="${rankCircleY + 14}" text-anchor="middle" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="9" fill="${colorAttr(textColor)}">${rank.percentile}%</text>`);
    }
    
    // Render semua metrik dalam layout kolom
    const statsSvg = flexLayout({ items: statNodes, gap: LINE_HEIGHT, direction: "column" }).join('');
    svgParts.push(`<g transform="translate(0, ${statsStartY})">${statsSvg}</g>`);
    
    svgParts.push(`</svg>`);
    return svgParts.join('');
}

function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') unsafe = String(unsafe);
    return unsafe.replace(/[<>&'"]/g, c => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;'
    })[c]);
}
