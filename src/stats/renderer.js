import { formatNumber, formatSize, measureTextWidth, wrapText } from '../lib/formatters.js';
import themes from './themes.js';
import { octiconPaths } from './icons.js';
import fetch from 'node-fetch';

const PADDING = 25;
const TITLE_Y = 35;
const CARD_BODY_Y = 55;
const LINE_HEIGHT = 25;
const TITLE_FONT_SIZE = 18;
const METRIC_FONT_SIZE = 14;
const RANK_RADIUS = 40;
const RANK_STROKE = 6;
const ICON_SIZE = 16;
const ICON_SPACING = 9;
const RIGHT_MARGIN = 20;
const EXTRA_WIDTH = 40;
const LABEL_VALUE_GAP = 35;

function cleanColor(c) {
  if (!c) return 'ffffff';
  let cleaned = String(c).trim().replace(/^#/, '');
  if (cleaned.length === 3) cleaned = cleaned.split('').map(ch => ch + ch).join('');
  return /^[0-9A-Fa-f]{6}$/.test(cleaned) ? cleaned.toLowerCase() : 'ffffff';
}
const colorAttr = (c) => `#${cleanColor(c)}`;

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

async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url);
    const buffer = await response.buffer();
    const contentType = response.headers.get('content-type') || 'image/png';
    const base64 = buffer.toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (e) {
    console.error('Failed to fetch avatar:', e);
    return null;
  }
}

export async function renderStatsCard(stats, options = {}) {
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
  const rankIcon = options.rank_icon || 'default';
  const allBold = options.all_bold === 'true';

  const fontAliases = {
    'default': "'Segoe UI', Ubuntu, Sans-Serif",
    'sans': "'Segoe UI', Ubuntu, Sans-Serif",
    'serif': "'Times New Roman', Times, serif",
    'times': "'Times New Roman', Times, serif",
    'mono': "'Courier New', Courier, monospace",
    'monospace': "'Courier New', Courier, monospace",
    'system': "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    'roboto': "'Roboto', 'Segoe UI', Ubuntu, Sans-Serif",
    'poppins': "'Poppins', 'Segoe UI', Ubuntu, Sans-Serif",
  };
  const fontFamily = fontAliases[options.font] || options.font || fontAliases.default;

  const titleColor = cleanColor(options.title_color || theme.titleColor);
  const textColor = cleanColor(options.text_color || theme.textColor);
  const iconColor = cleanColor(options.icon_color || theme.iconColor);
  const borderColor = cleanColor(options.border_color || theme.borderColor);
  const ringColor = cleanColor(options.ring_color || theme.ringColor);
  const rawBgColor = options.bg_color || theme.bgColor;

  let isGradient = false, gradientId = null, gradientAngle = 0, gradientStops = [];
  if (typeof rawBgColor === 'string' && rawBgColor.includes(',')) {
    isGradient = true;
    const parts = rawBgColor.split(',').map(p => p.trim());
    gradientAngle = parseInt(parts[0], 10) || 0;
    gradientStops = parts.slice(1).map(c => cleanColor(c));
    gradientId = `g${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }
  const bgColor = cleanColor(rawBgColor);

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

  let maxLabelW = 0, maxValueW = 0;
  statItems.forEach(item => {
    const lw = measureTextWidth(item.label, METRIC_FONT_SIZE);
    const vw = measureTextWidth(item.value, METRIC_FONT_SIZE);
    if (lw > maxLabelW) maxLabelW = lw;
    if (vw > maxValueW) maxValueW = vw;
  });

  const iconSpace = showIcons ? (ICON_SIZE + ICON_SPACING) : 0;
  // Lebar konten metrik (label + gap + nilai + icon)
  const metricsContentW = maxLabelW + maxValueW + iconSpace + LABEL_VALUE_GAP;
  
  // Ruang untuk rank circle di kanan (tetap)
  const rankSpace = hideRank ? 0 : (RANK_RADIUS * 2 + 30);

  // Lebar kartu minimum berdasarkan metrik
  let width = Math.max(
    cardWidthOpt || 0,
    metricsContentW + PADDING + rankSpace + RIGHT_MARGIN + EXTRA_WIDTH,
    350
  );

  // Wrap judul dengan lebar yang tersedia di kiri rank circle
  const availableTitleWidth = width - PADDING - rankSpace - RIGHT_MARGIN;
  const titleLines = wrapText(customTitle, availableTitleWidth, TITLE_FONT_SIZE);
  const titleW = Math.max(...titleLines.map(l => measureTextWidth(l, TITLE_FONT_SIZE)));

  // Periksa apakah judul membutuhkan lebar lebih besar, jika ya, perbesar width
  const titleRequiredWidth = titleW + PADDING + rankSpace + RIGHT_MARGIN;
  if (titleRequiredWidth > width) {
    width = titleRequiredWidth;
  }

  const titleHeight = titleLines.length * (TITLE_FONT_SIZE + 4);
  const height = CARD_BODY_Y + statItems.length * LINE_HEIGHT + PADDING;

  // Rank circle selalu di kanan dengan jarak tetap
  const rankCircleX = hideRank ? 0 : width - PADDING - RIGHT_MARGIN - RANK_RADIUS;
  const rankCircleY = hideRank ? 0 : (statItems.length * LINE_HEIGHT) / 2 - 15;

  // Batas kanan untuk nilai metrik (agar tidak menabrak rank circle)
  const maxValueX = hideRank ? (width - PADDING) : (rankCircleX - 30);

  const svg = [];
  svg.push(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="descId">`);
  svg.push(`<title id="titleId">${escapeXml(customTitle)}'s GitHub Stats, Rank: ${stats.rank?.level || 'N/A'}</title>`);
  svg.push(`<desc id="descId">${statItems.map(i => `${i.label} ${i.value}`).join(', ')}</desc>`);

  svg.push(`<style>`);
  svg.push(`.header { font: 600 18px ${fontFamily}; fill: #${titleColor}; animation: fadeInAnimation 0.8s ease-in-out forwards; }`);
  svg.push(`@supports(-moz-appearance: auto) { .header { font-size: 15.5px; } }`);
  const labelFontWeight = allBold ? '600' : '400';
  svg.push(`.stat-label { font: ${labelFontWeight} 14px ${fontFamily}; fill: #${textColor}; }`);
  svg.push(`.stat-value { font: 600 14px ${fontFamily}; fill: #${textColor}; }`);
  svg.push(`@supports(-moz-appearance: auto) { .stat-label, .stat-value { font-size:12px; } }`);
  svg.push(`.stagger { opacity: 0; animation: fadeInAnimation 0.3s ease-in-out forwards; }`);
  svg.push(`.rank-text { font: 800 24px ${fontFamily}; fill: #${textColor}; animation: scaleInAnimation 0.3s ease-in-out forwards; }`);
  svg.push(`.icon { fill: #${iconColor}; display: ${showIcons ? 'block' : 'none'}; }`);
  svg.push(`.rank-circle-rim { stroke: #${ringColor}; fill: none; stroke-width: ${RANK_STROKE}; opacity: 0.2; }`);
  svg.push(`.rank-circle { stroke: #${ringColor}; stroke-dasharray: 250; fill: none; stroke-width: ${RANK_STROKE}; stroke-linecap: round; opacity: 0.8; transform-origin: -10px 8px; transform: rotate(-90deg); animation: rankAnimation 1s forwards ease-in-out; }`);
  const circumference = 2 * Math.PI * RANK_RADIUS;
  const targetOffset = circumference * (1 - (stats.rank?.percentile || 0) / 100);
  svg.push(`@keyframes rankAnimation { from { stroke-dashoffset: ${circumference}; } to { stroke-dashoffset: ${targetOffset}; } }`);
  svg.push(`@keyframes scaleInAnimation { from { transform: translate(-5px, 5px) scale(0); } to { transform: translate(-5px, 5px) scale(1); } }`);
  svg.push(`@keyframes fadeInAnimation { from { opacity: 0; } to { opacity: 1; } }`);
  svg.push(`</style>`);

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

  svg.push(`<g data-testid="card-title" transform="translate(${PADDING}, ${TITLE_Y})">`);
  titleLines.forEach((line, i) => {
    svg.push(`<text x="0" y="${i * (TITLE_FONT_SIZE + 4)}" class="header" data-testid="header">${escapeXml(line)}</text>`);
  });
  svg.push(`</g>`);

  svg.push(`<g data-testid="main-card-body" transform="translate(0, ${CARD_BODY_Y})">`);

  if (!hideRank && stats.rank) {
    const cx = -10;
    const cy = 8;
    svg.push(`<g data-testid="rank-circle" transform="translate(${rankCircleX}, ${rankCircleY})">`);
    svg.push(`<circle class="rank-circle-rim" cx="${cx}" cy="${cy}" r="${RANK_RADIUS}" />`);
    svg.push(`<circle class="rank-circle" cx="${cx}" cy="${cy}" r="${RANK_RADIUS}" />`);

    if (rankIcon === 'avatar') {
      let avatarData = stats.avatarBase64;
      if (!avatarData && stats.avatarUrl) {
        avatarData = await fetchImageAsBase64(stats.avatarUrl);
      }
      if (avatarData) {
        const clipId = `avatarClip-${Date.now()}`;
        svg.push(`<defs><clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${RANK_RADIUS - 2}" /></clipPath></defs>`);
        svg.push(`<image x="${cx - RANK_RADIUS}" y="${cy - RANK_RADIUS}" width="${RANK_RADIUS * 2}" height="${RANK_RADIUS * 2}" clip-path="url(#${clipId})" href="${avatarData}" preserveAspectRatio="xMidYMid slice" />`);
      } else {
        svg.push(`<g class="rank-text">`);
        svg.push(`<text x="-5" y="3" alignment-baseline="central" dominant-baseline="central" text-anchor="middle">${stats.rank.level || 'C+'}</text>`);
        svg.push(`</g>`);
      }
    } else if (rankIcon === 'github') {
      const githubPath = octiconPaths['mark-github'];
      if (githubPath) {
        svg.push(`<g transform="translate(${cx - 12}, ${cy - 12}) scale(0.05)" fill="#${textColor}">`);
        svg.push(`<path d="${githubPath}"/>`);
        svg.push(`</g>`);
      } else {
        svg.push(`<g class="rank-text">`);
        svg.push(`<text x="-5" y="3" alignment-baseline="central" dominant-baseline="central" text-anchor="middle">${stats.rank.level || 'C+'}</text>`);
        svg.push(`</g>`);
      }
    } else if (rankIcon === 'percent') {
      svg.push(`<text x="-5" y="-7" text-anchor="middle" class="rank-text" style="font-size: 12px;">TOP</text>`);
      svg.push(`<text x="-5" y="12" text-anchor="middle" class="rank-text" style="font-size: 16px;">${stats.rank.percentile}%</text>`);
    } else {
      svg.push(`<g class="rank-text">`);
      svg.push(`<text x="-5" y="3" alignment-baseline="central" dominant-baseline="central" text-anchor="middle">${stats.rank.level || 'C+'}</text>`);
      svg.push(`</g>`);
    }
    svg.push(`</g>`);
  }

  svg.push(`<svg x="0" y="0">`);
  statItems.forEach((item, index) => {
    const yOffset = index * LINE_HEIGHT;
    const delay = 450 + index * 150;
    svg.push(`<g transform="translate(0, ${yOffset})">`);
    svg.push(`<g class="stagger" style="animation-delay: ${delay}ms" transform="translate(${PADDING}, 0)">`);
    if (showIcons && item.icon && octiconPaths[item.icon]) {
      svg.push(`<svg data-testid="icon" class="icon" viewBox="0 0 16 16" version="1.1" width="16" height="16">`);
      svg.push(`<path fill-rule="evenodd" d="${octiconPaths[item.icon]}"/>`);
      svg.push(`</svg>`);
    }
    const labelX = showIcons ? ICON_SIZE + ICON_SPACING : 0;
    const valueX = Math.min(labelX + maxLabelW + LABEL_VALUE_GAP, maxValueX);
    svg.push(`<text class="stat-label" x="${labelX}" y="12.5">${escapeXml(item.label)}</text>`);
    svg.push(`<text class="stat-value" x="${valueX}" y="12.5" data-testid="${item.key}">${escapeXml(item.value)}</text>`);
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
