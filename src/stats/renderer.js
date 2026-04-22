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
    // Hapus spasi dan #
    let cleaned = String(color).trim().replace(/^#/, '');
    // Jika hanya 3 karakter, ekspansi ke 6 (misal 'fff' -> 'ffffff')
    if (cleaned.length === 3) {
        cleaned = cleaned.split('').map(c => c + c).join('');
    }
    // Jika bukan hex valid, kembalikan default
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

    // Ambil warna dari opsi atau tema, lalu bersihkan
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
    const borderRadius = options.border_radius || '10';

    // Deteksi gradient: format "angle,color1,color2,..."
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

    // Layout
    const cardWidth = 500;
    const padding = 20;
    const titleY = 50;
    const iconOffset = showIcons ? 22 : 0;
    const lineHeight = 28;

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

    const displayName = stats.displayName || stats.name;
    const titleLines = wrapText(displayName, cardWidth - 2 * padding, 18);
    const titleHeight = titleLines.length * 22;
    const cardHeight = titleY + titleHeight + 10 + (visibleMetrics.length * lineHeight) + padding;

    // === MULAI SVG ===
    let svg = `<svg width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Organization Stats Card">`;

    // === DEFS (Gradient) ===
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
        svg += `<text x="${cardWidth / 2}" y="${currentTitleY}" text-anchor="middle" font-family="'Segoe UI', Ubuntu, Sans-Serif" font-size="18" font-weight="bold" fill="#${titleColor}">${escapeXml(line)}</text>`;
        currentTitleY += 22;
    }

    // === GARIS PEMISAH ===
    svg += `<line x1="${padding}" y1="${currentTitleY + 5}" x2="${cardWidth - padding}" y2="${currentTitleY + 5}" stroke="#${borderColor}" stroke-width="1"/>`;

    // === METRIK ===
    let yPos = currentTitleY + 25;
    const textX = padding + iconOffset;

    for (const metric of visibleMetrics) {
        const formattedValue = metric.format(metric.value);

        if (showIcons && metric.icon && octiconPaths[metric.icon]) {
            const iconPath = octiconPaths[metric.icon];
            const iconY = yPos - 11;
            svg += `<g transform="translate(${padding}, ${iconY})" fill="#${iconColor}">`;
            svg += `<path d="${iconPath}" fill-rule="evenodd"/>`;
            svg += `</g>`;
        }

        svg += `<text x="${textX}" y="${yPos}" font-family="'Segoe UI', Ubuntu, Sans-Serif" font-size="14" fill="#${textColor}">${escapeXml(metric.label)}:</text>`;
        svg += `<text x="${cardWidth - padding}" y="${yPos}" text-anchor="end" font-family="'Segoe UI', Ubuntu, Sans-Serif" font-size="14" font-weight="bold" fill="#${textColor}">${escapeXml(formattedValue)}</text>`;

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
