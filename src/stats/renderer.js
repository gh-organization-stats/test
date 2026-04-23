import { formatNumber, formatSize, measureTextWidth, wrapText } from '../lib/formatters.js';
import themes from './themes.js';
import { octiconPaths } from './icons.js';

// Konstanta dari repo asli
const PADDING = 25;
const LINE_HEIGHT = 25;
const TITLE_FONT_SIZE = 18;
const METRIC_FONT_SIZE = 13;
const RANK_RADIUS = 40;
const RANK_STROKE = 5;
const ICON_SIZE = 16;
const ICON_SPACING = 6;

function cleanColor(c) {
  if (!c) return 'ffffff';
  let cleaned = String(c).trim().replace(/^#/, '');
  if (cleaned.length === 3) cleaned = cleaned.split('').map(ch => ch + ch).join('');
  return /^[0-9A-Fa-f]{6}$/.test(cleaned) ? cleaned.toLowerCase() : 'ffffff';
}
const colorAttr = (c) => `#${cleanColor(c)}`;

// Metrik yang tersedia
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

const CORE_METRICS = new Set([
  'totalStars', 'totalForks', 'totalCommits', 'openPRs', 'openIssues', 'publicRepos', 'totalSize'
]);

// Flex layout kolom
function flexLayout({ items, gap, direction }) {
  if (direction !== 'column') return items;
  return items.map((item, i) => `<g transform="translate(0, ${i * gap})">${item}</g>`);
}

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

  // Kumpulkan metrik
  const statItems = [];
  for (const [key, def] of Object.entries(METRIC_DEFS)) {
    if (hide.has(key)) continue;
    if (CORE_METRICS.has(key) || show.has(key)) {
      const value = stats[key];
      if (value === undefined || value === null) continue;
      let formatted;
      if (key === 'totalSize') formatted = formatSize(value);
      else if (key === 'topLanguage') formatted = String(value);
      else formatted = formatNumber(value);
      statItems.push({ ...def, value: formatted, key });
    }
  }

  // Hitung lebar maksimal label dan nilai
  let maxLabelW = 0, maxValueW = 0;
  statItems.forEach(item => {
    const lw = measureTextWidth(item.label + ':', METRIC_FONT_SIZE);
    const vw = measureTextWidth(item.value, METRIC_FONT_SIZE);
    if (lw > maxLabelW) maxLabelW = lw;
    if (vw > maxValueW) maxValueW = vw;
  });

  const iconSpace = showIcons ? (ICON_SIZE + ICON_SPACING) : 0;
  const titleW = measureTextWidth(customTitle, TITLE_FONT_SIZE);
  const contentW = Math.max(titleW, maxLabelW + maxValueW + iconSpace + 10);
  const rankSpace = hideRank ? 0 : (RANK_RADIUS * 2 + 20);
  const width = Math.max(cardWidthOpt || 0, contentW + 2 * PADDING + rankSpace, 300);

  const titleLines = wrapText(customTitle, width - 2 * PADDING - rankSpace, TITLE_FONT_SIZE);
  const titleHeight = titleLines.length * (TITLE_FONT_SIZE + 4);
  const height = PADDING + titleHeight + 10 + statItems.length * LINE_HEIGHT + PADDING;

  // Mulai SVG
  const svg = [];
  svg.push(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`);
  
  if (isGradient) {
    svg.push(`<defs><linearGradient id="${gradientId}" gradientTransform="rotate(${gradientAngle})">`);
    gradientStops.forEach((c, i) => {
      const offset = (i / (gradientStops.length - 1)) * 100;
      svg.push(`<stop offset="${offset}%" stop-color="#${c}"/>`);
    });
    svg.push(`</linearGradient></defs>`);
  }
  
  const bgFill = isGradient ? `url(#${gradientId})` : colorAttr(bgColor);
  if (!hideBorder) {
    svg.push(`<rect width="${width}" height="${height}" rx="${borderRadius}" fill="${bgFill}" stroke="${colorAttr(borderColor)}" stroke-width="2"/>`);
  } else {
    svg.push(`<rect width="${width}" height="${height}" rx="${borderRadius}" fill="${bgFill}"/>`);
  }
  
  // Judul
  let y = PADDING + TITLE_FONT_SIZE;
  titleLines.forEach(line => {
    svg.push(`<text x="${PADDING}" y="${y}" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="${TITLE_FONT_SIZE}" font-weight="bold" fill="${colorAttr(titleColor)}">${escapeXml(line)}</text>`);
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
      svg.push(`<style>@keyframes rank{from{stroke-dashoffset:${circ}}to{stroke-dashoffset:${target}}}.rank-circle{animation:rank 1s ease forwards}</style>`);
    }
    svg.push(`<circle cx="${cx}" cy="${cy}" r="${RANK_RADIUS}" fill="none" stroke="${colorAttr(borderColor)}" stroke-width="${RANK_STROKE}" opacity="0.2"/>`);
    svg.push(`<circle cx="${cx}" cy="${cy}" r="${RANK_RADIUS}" fill="none" stroke="${colorAttr(ringColor)}" stroke-width="${RANK_STROKE}" stroke-dasharray="${circ}" stroke-dashoffset="${disableAnimations ? target : circ}" class="rank-circle" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>`);
    svg.push(`<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="14" font-weight="bold" fill="${colorAttr(textColor)}">${rank.level || 'C+'}</text>`);
    svg.push(`<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="9" fill="${colorAttr(textColor)}">${rank.percentile}%</text>`);
  }
  
  // Metrik
  const labelX = showIcons ? (ICON_SIZE + ICON_SPACING) : 0;
  const valueX = labelX + maxLabelW + 10;
  
  const metricNodes = statItems.map(item => {
    const iconSvg = (showIcons && item.icon && octiconPaths[item.icon])
      ? `<g transform="translate(0, -3)" fill="${colorAttr(iconColor)}"><path d="${octiconPaths[item.icon]}" fill-rule="evenodd"/></g>`
      : '';
    return `
      <g transform="translate(${PADDING}, 0)">
        ${iconSvg}
        <text x="${labelX}" y="0" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="${METRIC_FONT_SIZE}" fill="${colorAttr(textColor)}">${escapeXml(item.label)}:</text>
        <text x="${valueX}" y="0" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="${METRIC_FONT_SIZE}" font-weight="bold" fill="${colorAttr(textColor)}">${escapeXml(item.value)}</text>
      </g>
    `;
  });
  
  const statsSvg = flexLayout({ items: metricNodes, gap: LINE_HEIGHT, direction: 'column' }).join('');
  svg.push(`<g transform="translate(0, ${PADDING + titleHeight + 10})">${statsSvg}</g>`);
  svg.push(`</svg>`);
  return svg.join('');
}

function escapeXml(unsafe) {
  if (typeof unsafe !== 'string') unsafe = String(unsafe);
  return unsafe.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' })[c]);
}
