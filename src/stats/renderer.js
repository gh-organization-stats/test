// src/stats/renderer.js
import { formatNumber, formatSize, measureTextWidth, wrapText } from '../lib/formatters.js';
import themes from './themes.js';
import { octiconPaths } from './icons.js';

// Konstanta yang diambil langsung dari contoh SVG
const PADDING = 25;
const TITLE_Y = 35;
const CARD_BODY_Y = 55;
const LINE_HEIGHT = 25;
const TITLE_FONT_SIZE = 18;
const METRIC_FONT_SIZE = 14; // contoh menggunakan 14px untuk stat
const RANK_RADIUS = 40;
const RANK_STROKE = 6;
const ICON_SIZE = 16;
const ICON_SPACING = 9; // dari icon ke teks = 25 - 16 = 9

// Fungsi pembersih warna
function cleanColor(c) {
  if (!c) return 'ffffff';
  let cleaned = String(c).trim().replace(/^#/, '');
  if (cleaned.length === 3) cleaned = cleaned.split('').map(ch => ch + ch).join('');
  return /^[0-9A-Fa-f]{6}$/.test(cleaned) ? cleaned.toLowerCase() : 'ffffff';
}
const colorAttr = (c) => `#${cleanColor(c)}`;

// Definisi metrik yang akan ditampilkan
const METRIC_DEFS = {
  totalStars:    { label: 'Total Stars Earned:', icon: 'star' },
  totalForks:    { label: 'Total Forks:', icon: 'repo-forked' },
  totalCommits:  { label: 'Total Commits:', icon: 'git-commit' },
  openPRs:       { label: 'Total PRs:', icon: 'git-pull-request' },
  openIssues:    { label: 'Total Issues:', icon: 'issue-opened' },
  publicRepos:   { label: 'Public Repos:', icon: 'repo' },
  totalSize:     { label: 'Total Size:', icon: 'database' },
  members:       { label: 'Members:', icon: 'person' },
  followers:     { label: 'Followers:', icon: 'people' },
  topLanguage:   { label: 'Top Language:', icon: 'code' },
  languagesCount:{ label: 'Languages:', icon: 'code-square' },
  totalWatchers: { label: 'Total Watchers:', icon: 'eye' },
};

const CORE_METRICS = new Set([
  'totalStars', 'totalForks', 'totalCommits', 'openPRs', 'openIssues', 'publicRepos', 'totalSize'
]);

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

  // Hitung lebar teks
  let maxLabelW = 0, maxValueW = 0;
  statItems.forEach(item => {
    const lw = measureTextWidth(item.label, METRIC_FONT_SIZE);
    const vw = measureTextWidth(item.value, METRIC_FONT_SIZE);
    if (lw > maxLabelW) maxLabelW = lw;
    if (vw > maxValueW) maxValueW = vw;
  });

  const iconSpace = showIcons ? (ICON_SIZE + ICON_SPACING) : 0;
  const titleW = measureTextWidth(customTitle, TITLE_FONT_SIZE);
  // Lebar konten: judul atau (label + spasi + nilai)
  const contentW = Math.max(titleW, maxLabelW + maxValueW + iconSpace + 10);
  let rankSpace = hideRank ? 0 : (RANK_RADIUS * 2 + 20);
  let width = Math.max(cardWidthOpt || 0, contentW + 2 * PADDING + rankSpace, 300);

  if (!hideRank && stats.rank) {
    const minRankX = PADDING + maxLabelW + maxValueW + iconSpace + 40 + RANK_RADIUS + PADDING;
    if (minRankX > width) {
      width = minRankX;
      rankSpace = minRankX - (contentW + 2 * PADDING); // update rankSpace
    }
  }

  const titleLines = wrapText(customTitle, width - 2 * PADDING - rankSpace, TITLE_FONT_SIZE);
  const titleHeight = titleLines.length * (TITLE_FONT_SIZE + 4);
  const height = CARD_BODY_Y + statItems.length * LINE_HEIGHT + PADDING;

  // ---- Mulai SVG ----
  const svg = [];
  svg.push(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="descId">`);
  svg.push(`<title id="titleId">${escapeXml(customTitle)}'s GitHub Stats, Rank: ${stats.rank?.level || 'N/A'}</title>`);
  svg.push(`<desc id="descId">${statItems.map(i => `${i.label} ${i.value}`).join(', ')}</desc>`);

  // Style (diambil dari contoh)
  svg.push(`<style>`);
  svg.push(`.header { font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif; fill: #${titleColor}; animation: fadeInAnimation 0.8s ease-in-out forwards; }`);
  svg.push(`@supports(-moz-appearance: auto) { .header { font-size: 15.5px; } }`);
  svg.push(`.stat { font: 600 14px 'Segoe UI', Ubuntu, "Helvetica Neue", Sans-Serif; fill: #${textColor}; }`);
  svg.push(`@supports(-moz-appearance: auto) { .stat { font-size:12px; } }`);
  svg.push(`.stagger { opacity: 0; animation: fadeInAnimation 0.3s ease-in-out forwards; }`);
  svg.push(`.rank-text { font: 800 24px 'Segoe UI', Ubuntu, Sans-Serif; fill: #${textColor}; animation: scaleInAnimation 0.3s ease-in-out forwards; }`);
  svg.push(`.icon { fill: #${iconColor}; display: ${showIcons ? 'block' : 'none'}; }`);
  svg.push(`.rank-circle-rim { stroke: #${ringColor}; fill: none; stroke-width: ${RANK_STROKE}; opacity: 0.2; }`);
  svg.push(`.rank-circle { stroke: #${ringColor}; stroke-dasharray: 250; fill: none; stroke-width: ${RANK_STROKE}; stroke-linecap: round; opacity: 0.8; transform-origin: -10px 8px; transform: rotate(-90deg); animation: rankAnimation 1s forwards ease-in-out; }`);
  svg.push(`@keyframes rankAnimation { from { stroke-dashoffset: 251.32741228718345; } to { stroke-dashoffset: ${251.32741228718345 * (1 - (stats.rank?.percentile || 0) / 100)}; } }`);
  svg.push(`@keyframes scaleInAnimation { from { transform: translate(-5px, 5px) scale(0); } to { transform: translate(-5px, 5px) scale(1); } }`);
  svg.push(`@keyframes fadeInAnimation { from { opacity: 0; } to { opacity: 1; } }`);
  svg.push(`</style>`);

  // Background
  const bgFill = isGradient ? `url(#${gradientId})` : `#${bgColor}`;
  svg.push(`<rect data-testid="card-bg" x="0.5" y="0.5" rx="${borderRadius}" height="99%" stroke="#${borderColor}" width="${width - 1}" fill="${bgFill}" stroke-opacity="${hideBorder ? '0' : '1'}" />`);
  if (isGradient) {
    svg.push(`<defs><linearGradient id="${gradientId}" gradientTransform="rotate(${gradientAngle})">`);
    gradientStops.forEach((c, i) => {
      const offset = (i / (gradientStops.length - 1)) * 100;
      svg.push(`<stop offset="${offset}%" stop-color="#${c}"/>`);
    });
    svg.push(`</linearGradient></defs>`);
  }

  // Judul
  svg.push(`<g data-testid="card-title" transform="translate(${PADDING}, ${TITLE_Y})">`);
  svg.push(`<g transform="translate(0, 0)"><text x="0" y="0" class="header" data-testid="header">${escapeXml(customTitle)}</text></g>`);
  svg.push(`</g>`);

  // Body
  svg.push(`<g data-testid="main-card-body" transform="translate(0, ${CARD_BODY_Y})">`);

  // Rank circle
  let rankCircleX = 0, rankCircleY = 0;
if (!hideRank && stats.rank) {
    const statsAreaHeight = statItems.length * LINE_HEIGHT;
    const rankCircleY = statsAreaHeight / 2;
    const rightOffset = 20;
    const defaultX = width - PADDING - rightOffset - RANK_RADIUS;
    const minX = PADDING + maxLabelW + maxValueW + iconSpace + 40;
    const rankCircleX = Math.max(defaultX, minX);

    svg.push(`<g data-testid="rank-circle" transform="translate(${rankCircleX}, ${rankCircleY})">`);
  svg.push(`<circle class="rank-circle-rim" cx="-10" cy="8" r="${RANK_RADIUS}" />`);
  svg.push(`<circle class="rank-circle" cx="-10" cy="8" r="${RANK_RADIUS}" />`);
  svg.push(`<g class="rank-text">`);
  svg.push(`<text x="-5" y="3" alignment-baseline="central" dominant-baseline="central" text-anchor="middle">${stats.rank.level || 'C+'}</text>`);
  svg.push(`</g></g>`);
}

  // Metrik
  svg.push(`<svg x="0" y="0">`);
  statItems.forEach((item, index) => {
    const yOffset = index * LINE_HEIGHT;
    const delay = 450 + index * 150;
    svg.push(`<g transform="translate(0, ${yOffset})">`);
    svg.push(`<g class="stagger" style="animation-delay: ${delay}ms" transform="translate(${PADDING}, 0)">`);
    
    // Ikon (jika ada)
    if (showIcons && item.icon && octiconPaths[item.icon]) {
      svg.push(`<svg data-testid="icon" class="icon" viewBox="0 0 16 16" version="1.1" width="16" height="16">`);
      svg.push(`<path fill-rule="evenodd" d="${octiconPaths[item.icon]}"/>`);
      svg.push(`</svg>`);
    }
    
    const labelX = showIcons ? ICON_SIZE + ICON_SPACING : 0;
    const valueX = labelX + maxLabelW + 10; // posisi nilai dihitung dinamis
    
    svg.push(`<text class="stat bold" x="${labelX}" y="12.5">${escapeXml(item.label)}</text>`);
    svg.push(`<text class="stat bold" x="${valueX}" y="12.5" data-testid="${item.key}">${escapeXml(item.value)}</text>`);
    svg.push(`</g></g>`);
  });
  svg.push(`</svg>`);
  svg.push(`</g>`);
  svg.push(`</svg>`);

  return svg.join('');
}

function escapeXml(unsafe) {
  if (typeof unsafe !== 'string') unsafe = String(unsafe);
  return unsafe.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' })[c]);
}
