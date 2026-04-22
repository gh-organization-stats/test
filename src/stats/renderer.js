import { formatNumber, formatSize, measureTextWidth, wrapText } from '../lib/formatters.js';
import themes from './themes.js';
import { octiconPaths } from './icons.js';

// --- Konstanta Layout ---
const PADDING = 25;
const LINE_HEIGHT = 25;
const TITLE_FONT_SIZE = 18;
const METRIC_FONT_SIZE = 13;
const RANK_RADIUS = 40;
const RANK_STROKE_WIDTH = 5;
const ICON_SIZE = 16;
const ICON_SPACING = 6;

// --- Helper Warna ---
function cleanColor(color) {
    if (!color) return 'ffffff';
    let cleaned = String(color).trim().replace(/^#/, '');
    if (cleaned.length === 3) cleaned = cleaned.split('').map(c => c + c).join('');
    return /^[0-9A-Fa-f]{6}$/.test(cleaned) ? cleaned.toLowerCase() : 'ffffff';
}
const colorAttr = (c) => `#${cleanColor(c)}`;

// --- Flex Layout Vertikal ---
function flexLayout({ items, gap, direction }) {
    if (direction !== 'column') return items;
    return items.map((item, index) => {
        return `<g transform="translate(0, ${index * gap})">${item}</g>`;
    });
}

// --- Definisi Metrik ---
const METRIC_DEFS = {
    totalStars:    { label: 'Total Stars', icon: 'star' },
    totalForks:    { label: 'Total Forks', icon: 'repo-forked' },
    totalCommits:  { label: 'Total Commits', icon: 'git-commit' },
    openPRs:       { label: 'Open PRs', icon: 'git-pull-request' },
    openIssues:    { label: 'Open Issues', icon: 'issue-opened' },
    publicRepos:   { label: 'Public Repos', icon: 'repo' },
    totalSize:     { label: 'Total Size', icon: 'database' },
    members:       { label: 'Members', icon: 'person' },
    followers:     { label: 'Followers', icon: 'people' },
    topLanguage:   { label: 'Top Language', icon: 'code' },
    languagesCount:{ label: 'Languages', icon: 'code-square' },
    totalWatchers: { label: 'Total Watchers', icon: 'eye' },
};

// Metrik inti yang tampil secara default (seperti di repositori asli)
const CORE_METRICS = new Set([
    'totalStars', 'totalForks', 'totalCommits', 'openPRs', 'openIssues', 'publicRepos', 'totalSize'
]);

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
    const cardWidthOpt = options.card_width ? parseInt(options.card_width) : null;

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
        if (hide.has(key)) continue;
        const isCore = CORE_METRICS.has(key);
        if (isCore || show.has(key)) {
            const value = stats[key];
            if (value === undefined || value === null) continue;
            
            let formatted;
            if (key === 'totalSize') formatted = formatSize(value);
            else if (key === 'topLanguage') formatted = String(value);
            else formatted = formatNumber(value);
            
            statItems.push({ ...def, value: formatted, key });
        }
    }

    // --- Hitung lebar konten terpanjang ---
    let maxLabelWidth = 0;
    let maxValueWidth = 0;
    statItems.forEach(item => {
        const labelW = measureTextWidth(item.label + ':', METRIC_FONT_SIZE);
        const valueW = measureTextWidth(item.value, METRIC_FONT_SIZE);
        if (labelW > maxLabelWidth) maxLabelWidth = labelW;
        if (valueW > maxValueWidth) maxValueWidth = valueW;
    });
    
    const iconSpace = showIcons ? (ICON_SIZE + ICON_SPACING) : 0;
    const titleWidth = measureTextWidth(customTitle, TITLE_FONT_SIZE);
    const contentWidth = Math.max(titleWidth, maxLabelWidth + maxValueWidth + iconSpace + 20);
    
    // Lebar kartu: minimal 300px, ditambah ruang untuk rank circle jika ada
    const rankSpace = hideRank ? 0 : (RANK_RADIUS * 2 + 20);
    let width = cardWidthOpt || Math.max(300, contentWidth + 2 * PADDING + rankSpace);
    width = Math.max(width, 300);
    
    // --- Tinggi kartu ---
    const titleLines = wrapText(customTitle, width - 2 * PADDING - rankSpace, TITLE_FONT_SIZE);
    const titleHeight = titleLines.length * (TITLE_FONT_SIZE + 4);
    const statsHeight = statItems.length * LINE_HEIGHT;
    const height = PADDING + titleHeight + 15 + statsHeight + PADDING;

    // --- Bangun SVG ---
    const svgParts = [];
    svgParts.push(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`);
    
    // Gradient defs
    if (isGradient) {
        svgParts.push(`<defs><linearGradient id="${gradientId}" gradientTransform="rotate(${gradientAngle})">`);
        gradientStops.forEach((c, i) => {
            const offset = (i / (gradientStops.length - 1)) * 100;
            svgParts.push(`<stop offset="${offset}%" stop-color="#${c}"/>`);
        });
        svgParts.push(`</linearGradient></defs>`);
    }
    
    // Background
    const bgFill = isGradient ? `url(#${gradientId})` : colorAttr(bgColor);
    if (!hideBorder) {
        svgParts.push(`<rect width="${width}" height="${height}" rx="${borderRadius}" fill="${bgFill}" stroke="${colorAttr(borderColor)}" stroke-width="2"/>`);
    } else {
        svgParts.push(`<rect width="${width}" height="${height}" rx="${borderRadius}" fill="${bgFill}"/>`);
    }
    
    // Judul
    let y = PADDING + TITLE_FONT_SIZE;
    titleLines.forEach(line => {
        svgParts.push(`<text x="${PADDING}" y="${y}" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="${TITLE_FONT_SIZE}" font-weight="bold" fill="${colorAttr(titleColor)}">${escapeXml(line)}</text>`);
        y += TITLE_FONT_SIZE + 4;
    });
    
    // Rank circle
    if (!hideRank && stats.rank) {
        const rank = stats.rank;
        const cx = width - PADDING - RANK_RADIUS;
        const cy = PADDING + TITLE_FONT_SIZE;
        const circ = 2 * Math.PI * RANK_RADIUS;
        const target = ((100 - (rank.percentile || 0)) / 100) * circ;
        
        if (!disableAnimations) {
            svgParts.push(`<style>@keyframes rank{from{stroke-dashoffset:${circ}}to{stroke-dashoffset:${target}}}.rank-circle{animation:rank 1s ease forwards}</style>`);
        }
        svgParts.push(`<circle cx="${cx}" cy="${cy}" r="${RANK_RADIUS}" fill="none" stroke="${colorAttr(borderColor)}" stroke-width="${RANK_STROKE_WIDTH}" opacity="0.2"/>`);
        svgParts.push(`<circle cx="${cx}" cy="${cy}" r="${RANK_RADIUS}" fill="none" stroke="${colorAttr(ringColor)}" stroke-width="${RANK_STROKE_WIDTH}" stroke-dasharray="${circ}" stroke-dashoffset="${disableAnimations ? target : circ}" class="rank-circle" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>`);
        svgParts.push(`<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="14" font-weight="bold" fill="${colorAttr(textColor)}">${rank.level || 'C+'}</text>`);
        svgParts.push(`<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="9" fill="${colorAttr(textColor)}">${rank.percentile}%</text>`);
    }
    
    // Buat node untuk setiap metrik (untuk flexLayout)
    const metricNodes = statItems.map((item, index) => {
        const iconSvg = showIcons && item.icon && octiconPaths[item.icon]
            ? `<g transform="translate(0, -3)" fill="${colorAttr(iconColor)}"><path d="${octiconPaths[item.icon]}" fill-rule="evenodd"/></g>`
            : '';
        const labelX = showIcons ? (ICON_SIZE + ICON_SPACING) : 0;
        // Posisi nilai dihitung relatif terhadap lebar kolom (gunakan maxLabelWidth + spasi)
        const valueX = labelX + maxLabelWidth + 20;
        
        return `
            <g transform="translate(${PADDING}, 0)">
                ${iconSvg}
                <text x="${labelX}" y="0" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="${METRIC_FONT_SIZE}" fill="${colorAttr(textColor)}">${escapeXml(item.label)}:</text>
                <text x="${valueX}" y="0" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="${METRIC_FONT_SIZE}" font-weight="bold" fill="${colorAttr(textColor)}">${escapeXml(item.value)}</text>
            </g>
        `;
    });
    
    const statsSvg = flexLayout({ items: metricNodes, gap: LINE_HEIGHT, direction: 'column' }).join('');
    const statsStartY = PADDING + titleHeight + 15;
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
