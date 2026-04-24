import { formatNumber, formatSize, measureTextWidth, wrapText } from '../lib/formatters.js';
import themes from './themes.js';
import { locales } from './i18n.js';
import { octiconPaths } from './icons.js';
import fetch from 'node-fetch';
import sharp from 'sharp';

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
const EXTRA_WIDTH = 44; // dikalibrasi untuk width≈434 saat data contoh Inggris
const LABEL_VALUE_GAP = 50;

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

async function processAvatarFromBase64(base64Data, size, quality) {
  try {
    const matches = base64Data.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (!matches) throw new Error('Invalid base64 data format');
    const rawBase64 = matches[2];
    const buffer = Buffer.from(rawBase64, 'base64');
    const processedBuffer = await sharp(buffer)
      .resize(size, size, { fit: 'cover', withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
    const newBase64 = processedBuffer.toString('base64');
    return `data:image/jpeg;base64,${newBase64}`;
  } catch (e) {
    console.error('[PROCESS AVATAR] Error:', e);
    return null;
  }
}

export async function renderStatsCard(stats, options = {}) {
  const theme = themes[options.theme] || themes.default;
  const defaultTheme = themes.default;

  const locale = options.locale || 'en';
  const i18n = locales[locale] || locales.en;

  const getColor = (prop, fallbackProp) => {
    if (theme[prop]) return theme[prop];
    if (fallbackProp && theme[fallbackProp]) return theme[fallbackProp];
    if (defaultTheme[prop]) return defaultTheme[prop];
    return defaultTheme[fallbackProp] || 'ffffff';
  };

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
  const photoResize = options.photo_resize || 80;
  const photoQuality = options.photo_quality || 90;

  const fontFamily = "'Segoe UI', Ubuntu, Sans-Serif";

  const titleColor = cleanColor(options.title_color || theme.titleColor || defaultTheme.titleColor);
  const textColor = cleanColor(options.text_color || theme.textColor || defaultTheme.textColor);
  const iconColor = cleanColor(options.icon_color || theme.iconColor || defaultTheme.iconColor);
  const borderColor = cleanColor(options.border_color || theme.borderColor || defaultTheme.borderColor);
  const rawBgColor = options.bg_color || theme.bgColor || defaultTheme.bgColor;

  const valueColor = cleanColor(options.value_color || getColor('valueColor', 'textColor'));
  const rankIconColor = cleanColor(options.rank_icon_color || getColor('rankIconColor', 'textColor'));

  const ringColorRaw = options.ring_color || theme.ringColor || theme.titleColor || defaultTheme.ringColor;
  let ringIsGradient = false;
  let ringGradientAngle = 0;
  let ringGradientStops = [];
  let ringColor = cleanColor(ringColorRaw);

  if (typeof ringColorRaw === 'string' && ringColorRaw.includes(',')) {
    ringIsGradient = true;
    const parts = ringColorRaw.split(',').map(p => p.trim());
    ringGradientAngle = parseInt(parts[0], 10) || 0;
    ringGradientStops = parts.slice(1).map(c => cleanColor(c));
  }

  let isGradient = false, gradientId = null, gradientAngle = 0, gradientStops = [];
  if (typeof rawBgColor === 'string' && rawBgColor.includes(',')) {
    isGradient = true;
    const parts = rawBgColor.split(',').map(p => p.trim());
    gradientAngle = parseInt(parts[0], 10) || 0;
    gradientStops = parts.slice(1).map(c => cleanColor(c));
    gradientId = `g${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }
  const bgColor = cleanColor(rawBgColor);

  // Kumpulkan metrik dengan label dari i18n
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
      statItems.push({
        key,
        value: formatted,
        icon: def.icon,
        label: i18n.metrics[key] || locales.en.metrics[key] || def.label || key
      });
    }
  }

  // Hitung lebar teks terjemahan
  let translatedLabelW = 0;
  statItems.forEach(item => {
    const lw = measureTextWidth(item.label, METRIC_FONT_SIZE);
    if (lw > translatedLabelW) translatedLabelW = lw;
  });

  // Hitung lebar teks default (Inggris) untuk patokan minimum
  const enLabels = locales.en.metrics;
  let minLabelW = 0;
  for (const [key, def] of Object.entries(METRIC_DEFS)) {
    if (hide.has(key)) continue;
    if (CORE_METRICS.has(key) || show.has(key)) {
      const enLabel = enLabels[key] || def.label || key;
      const lw = measureTextWidth(enLabel, METRIC_FONT_SIZE);
      if (lw > minLabelW) minLabelW = lw;
    }
  }

  // Gunakan yang terbesar: label terjemahan atau label Inggris
  const maxLabelW = Math.max(translatedLabelW, minLabelW);

  // Lebar nilai (tetap dihitung dari nilai aktual)
  let maxValueW = 0;
  statItems.forEach(item => {
    const vw = measureTextWidth(item.value, METRIC_FONT_SIZE);
    if (vw > maxValueW) maxValueW = vw;
  });

  const iconSpace = showIcons ? (ICON_SIZE + ICON_SPACING) : 0;
  const titleW = measureTextWidth(customTitle, TITLE_FONT_SIZE);
  const metricsContentW = maxLabelW + maxValueW + iconSpace + LABEL_VALUE_GAP;

  const rankSpace = hideRank ? 0 : (RANK_RADIUS * 2 + 30);
  const baseWidth = Math.max(
    metricsContentW + 2 * PADDING + rankSpace + EXTRA_WIDTH,
    350
  );

  const titleMinWidth = (titleW + PADDING) - 15;
  let width = Math.max(cardWidthOpt || 0, baseWidth, titleMinWidth);

  let rankCircleX = 0, rankCircleY = 0;
  if (!hideRank && stats.rank) {
    const statsAreaHeight = statItems.length * LINE_HEIGHT;
    rankCircleY = (statsAreaHeight / 2) - 15;

    const leftContentRight = PADDING + iconSpace + maxLabelW + maxValueW;
    const minX = leftContentRight + 70;
    const defaultX = baseWidth - PADDING - RIGHT_MARGIN - RANK_RADIUS;
    rankCircleX = Math.max(defaultX, minX);

    const requiredWidth = rankCircleX + RANK_RADIUS + PADDING + RIGHT_MARGIN;
    if (requiredWidth > width) width = requiredWidth;
  }

  const titleLines = wrapText(customTitle, width - 2 * PADDING, TITLE_FONT_SIZE);
  const titleHeight = titleLines.length * (TITLE_FONT_SIZE + 4);
  const height = CARD_BODY_Y + statItems.length * LINE_HEIGHT + PADDING;

  const svg = [];
  svg.push(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="descId">`);
  svg.push(`<title id="titleId">${escapeXml(customTitle)}'s GitHub Stats, Rank: ${stats.rank?.level || 'N/A'}</title>`);
  svg.push(`<desc id="descId">${statItems.map(i => `${i.label} ${i.value}`).join(', ')}</desc>`);

  svg.push(`<style>`);
  svg.push(`.header { font: 600 18px ${fontFamily}; fill: #${titleColor}; animation: fadeInAnimation 0.8s ease-in-out forwards; }`);
  svg.push(`@supports(-moz-appearance: auto) { .header { font-size: 15.5px; } }`);
  const labelFontWeight = allBold ? '600' : '400';
  svg.push(`.stat-label { font: ${labelFontWeight} 14px ${fontFamily}; fill: #${textColor}; }`);
  svg.push(`.stat-value { font: 600 14px ${fontFamily}; fill: #${valueColor}; }`);
  svg.push(`@supports(-moz-appearance: auto) { .stat-label, .stat-value { font-size:12px; } }`);
  svg.push(`.stagger { opacity: 0; animation: fadeInAnimation 0.3s ease-in-out forwards; }`);
  svg.push(`.rank-text { font: 800 24px ${fontFamily}; fill: #${rankIconColor}; animation: scaleInAnimation 0.3s ease-in-out forwards; }`);
  svg.push(`.icon { fill: #${iconColor}; display: ${showIcons ? 'block' : 'none'}; }`);
  svg.push(`.rank-circle-rim { stroke: #${ringColor}; fill: none; stroke-width: ${RANK_STROKE}; opacity: 0.2; }`);
  svg.push(`.rank-circle { stroke: #${ringColor}; stroke-dasharray: 250; fill: none; stroke-width: ${RANK_STROKE}; stroke-linecap: round; opacity: 0.8; transform-origin: -10px 8px; transform: rotate(-90deg); animation: rankAnimation 1s forwards ease-in-out; }`);
  svg.push(`@keyframes rankAnimation { from { stroke-dashoffset: 251.32741228718345; } to { stroke-dashoffset: ${251.32741228718345 * (stats.rank?.percentile || 0) / 100}; } }`);
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
  svg.push(`<g transform="translate(0, 0)"><text x="0" y="0" class="header" data-testid="header">${escapeXml(customTitle)}</text></g>`);
  svg.push(`</g>`);

  svg.push(`<g data-testid="main-card-body" transform="translate(0, ${CARD_BODY_Y})">`);

  if (!hideRank && stats.rank) {
    const cx = -10;
    const cy = 8;
    const circ = 2 * Math.PI * RANK_RADIUS;
    const target = ((stats.rank?.percentile || 0) / 100) * circ;
    const transformAttr = `transform="rotate(-90 ${cx} ${cy})"`;

    svg.push(`<g data-testid="rank-circle" transform="translate(${rankCircleX}, ${rankCircleY})">`);

    let progressAttrs = `cx="${cx}" cy="${cy}" r="${RANK_RADIUS}" fill="none" stroke-linecap="round"`;
    let strokeValue = `#${ringColor}`;
    let useClass = true;

    if (ringIsGradient) {
      const gradId = `ringGrad-${Date.now()}`;
      const rimGradId = `ringRimGrad-${Date.now()}`;

      svg.push(`<defs><linearGradient id="${gradId}" gradientTransform="rotate(${ringGradientAngle})">`);
      ringGradientStops.forEach((c, i) => {
        const offset = (i / (ringGradientStops.length - 1)) * 100;
        svg.push(`<stop offset="${offset}%" stop-color="#${c}"/>`);
      });
      svg.push(`</linearGradient>`);

      svg.push(`<linearGradient id="${rimGradId}" gradientTransform="rotate(${ringGradientAngle})">`);
      ringGradientStops.forEach((c, i) => {
        const offset = (i / (ringGradientStops.length - 1)) * 100;
        svg.push(`<stop offset="${offset}%" stop-color="#${c}" stop-opacity="0.2"/>`);
      });
      svg.push(`</linearGradient></defs>`);

      strokeValue = `url(#${gradId})`;
      useClass = false;

      svg.push(`<circle cx="${cx}" cy="${cy}" r="${RANK_RADIUS}" fill="none" stroke="url(#${rimGradId})" stroke-width="${RANK_STROKE}" />`);
    } else {
      svg.push(`<circle class="rank-circle-rim" cx="${cx}" cy="${cy}" r="${RANK_RADIUS}" />`);
    }

    const animInline = disableAnimations ? '' : ` animation: rankAnimation 1s forwards ease-in-out;`;

    if (!useClass) {
      progressAttrs += ` stroke="${strokeValue}" stroke-width="${RANK_STROKE}" stroke-dasharray="${circ}" stroke-dashoffset="${disableAnimations ? target : '251.32741228718345'}" ${transformAttr}`;
      if (disableAnimations) {
        svg.push(`<circle ${progressAttrs} />`);
      } else {
        svg.push(`<circle ${progressAttrs} style="${animInline}" />`);
      }
    } else {
      progressAttrs += ` class="rank-circle" stroke="${strokeValue}"`;
      if (disableAnimations) {
        progressAttrs += ` stroke-dashoffset="${target}" style="animation: none;"`;
      }
      svg.push(`<circle ${progressAttrs} stroke-dasharray="${circ}" stroke-dashoffset="${disableAnimations ? target : '251.32741228718345'}" ${transformAttr} />`);
    }

    if (rankIcon === 'avatar') {
      let avatarData = stats.avatarBase64;
      if (!avatarData && stats.avatarUrl) {
        const response = await fetch(stats.avatarUrl);
        if (response.ok) {
          const buffer = await response.buffer();
          const contentType = response.headers.get('content-type') || 'image/png';
          avatarData = `data:${contentType};base64,${buffer.toString('base64')}`;
        }
      }
      if (avatarData) {
        if (options.photo_resize || options.photo_quality) {
          avatarData = await processAvatarFromBase64(avatarData, photoResize, photoQuality);
        }
        if (avatarData) {
          const clipId = `avatarClip-${Date.now()}`;
          svg.push(`<defs><clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="32" /></clipPath></defs>`);
          svg.push(`<image x="${cx - 32}" y="${cy - 32}" width="64" height="64" clip-path="url(#${clipId})" href="${avatarData}" preserveAspectRatio="xMidYMid slice" />`);
        } else {
          svg.push(`<g class="rank-text"><text x="-5" y="3" alignment-baseline="central" dominant-baseline="central" text-anchor="middle">${stats.rank.level || 'C+'}</text></g>`);
        }
      } else {
        svg.push(`<g class="rank-text"><text x="-5" y="3" alignment-baseline="central" dominant-baseline="central" text-anchor="middle">${stats.rank.level || 'C+'}</text></g>`);
      }
    } else if (rankIcon === 'github') {
      const githubPath = octiconPaths['mark-github'];
      if (githubPath) {
        svg.push(`<g transform="translate(${cx - 32}, ${cy - 32})">`);
        svg.push(`<svg viewBox="0 0 16 16" width="64" height="64" fill="#${rankIconColor}"><path d="${githubPath}"/></svg>`);
        svg.push(`</g>`);
      } else {
        svg.push(`<g class="rank-text"><text x="-5" y="3" alignment-baseline="central" dominant-baseline="central" text-anchor="middle">${stats.rank.level || 'C+'}</text></g>`);
      }
    } else if (rankIcon === 'progress') {
      svg.push(`<text x="-5" y="-7" alignment-baseline="central" dominant-baseline="central" text-anchor="middle" class="rank-text" style="font-size: 12px;">${escapeXml(i18n.top || locales.en.top || 'TOP')}</text>`);
      svg.push(`<text x="-5" y="12" alignment-baseline="central" dominant-baseline="central" text-anchor="middle" class="rank-text" style="font-size: 16px;">${stats.rank.percentile}%</text>`);
    } else {
      svg.push(`<g class="rank-text"><text x="-5" y="3" alignment-baseline="central" dominant-baseline="central" text-anchor="middle">${stats.rank.level || 'C+'}</text></g>`);
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
    const valueX = labelX + maxLabelW + LABEL_VALUE_GAP;
    
    svg.push(`<text class="stat-label" x="${labelX}" y="12.5">${escapeXml(item.label)}:</text>`);
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

export function renderErrorCard(message, options = {}) {
  const theme = themes[options.theme] || themes.default;
  const defaultTheme = themes.default;
  const locale = options.locale || 'en';
  const i18n = locales[locale] || locales.en;

  const getColor = (prop, fallbackProp) => {
    if (theme[prop]) return theme[prop];
    if (fallbackProp && theme[fallbackProp]) return theme[fallbackProp];
    if (defaultTheme[prop]) return defaultTheme[prop];
    return defaultTheme[fallbackProp] || 'ffffff';
  };

  const fontFamily = "'Segoe UI', Ubuntu, Sans-Serif";
  const titleColor = cleanColor(options.title_color || theme.titleColor || defaultTheme.titleColor);
  const textColor = cleanColor(options.text_color || theme.textColor || defaultTheme.textColor);
  const iconColor = cleanColor(options.icon_color || theme.iconColor || defaultTheme.iconColor);
  const borderColor = cleanColor(options.border_color || theme.borderColor || defaultTheme.borderColor);
  const rawBgColor = options.bg_color || theme.bgColor || defaultTheme.bgColor;
  const borderRadius = options.border_radius || '4.5';
  const hideBorder = options.hide_border === 'true';

  let isGradient = false, gradientId = null, gradientAngle = 0, gradientStops = [];
  if (typeof rawBgColor === 'string' && rawBgColor.includes(',')) {
    isGradient = true;
    const parts = rawBgColor.split(',').map(p => p.trim());
    gradientAngle = parseInt(parts[0], 10) || 0;
    gradientStops = parts.slice(1).map(c => cleanColor(c));
    gradientId = `g${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }
  const bgColor = cleanColor(rawBgColor);

  const errorTitle = i18n.error || 'Error';
  const errorMessage = message || 'Unknown error';

  // Ikon error (SVG yang diberikan)
  const iconOriginalSize = 24;
  const iconScale = 3; // diperbesar 3x -> 72px
  const iconSize = iconOriginalSize * iconScale;
  const iconGap = 12; // jarak antara ikon dan judul

  // Lebar kartu
  const titleWidth = measureTextWidth(errorTitle, TITLE_FONT_SIZE);
  const cardWidth = Math.max(400, titleWidth + 2 * PADDING);
  const textAreaWidth = cardWidth - PADDING;

  // Wrap teks
  const wrappedLines = wrapText(errorMessage, textAreaWidth, METRIC_FONT_SIZE);
  const lineHeight = 22;

  // Tinggi kartu
  const titleBlockHeight = TITLE_FONT_SIZE + 8;
  const cardHeight = PADDING + iconSize + iconGap + titleBlockHeight + 10 + (wrappedLines.length * lineHeight) + PADDING - 2;

  // Posisi
  const iconX = (cardWidth - iconSize) / 2;
  const iconY = PADDING;
  const titleY = iconY + iconSize + iconGap + TITLE_FONT_SIZE;
  const startTextY = titleY + 8 + 10;

  const svg = [];
  svg.push(`<svg width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Error Card">`);
  svg.push(`<style>`);
  svg.push(`.header { font: 600 18px ${fontFamily}; fill: #${titleColor}; text-anchor: middle; }`);
  svg.push(`.error-text { font: 400 14px ${fontFamily}; fill: #${textColor}; text-anchor: middle; }`);
  svg.push(`</style>`);

  const bgFill = isGradient ? `url(#${gradientId})` : `#${bgColor}`;
  if (isGradient) {
    svg.push(`<defs><linearGradient id="${gradientId}" gradientTransform="rotate(${gradientAngle})">`);
    gradientStops.forEach((c, i) => {
      const offset = (i / (gradientStops.length - 1)) * 100;
      svg.push(`<stop offset="${offset}%" stop-color="#${c}"/>`);
    });
    svg.push(`</linearGradient></defs>`);
  }

  svg.push(`<rect x="0.5" y="0.5" rx="${borderRadius}" width="${cardWidth - 1}" height="${cardHeight - 1}" fill="${bgFill}" stroke="#${borderColor}" stroke-width="2" stroke-opacity="${hideBorder ? '0' : '1'}" />`);

  // Ikon error (diperbesar, menggunakan iconColor)
  svg.push(`<g transform="translate(${iconX}, ${iconY - 4}) scale(${iconScale})" stroke="#${iconColor}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`);
  svg.push(`<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />`);
  svg.push(`<path d="M14.5 16.05a3.5 3.5 0 0 0 -5 0" />`);
  svg.push(`<path d="M8 9l2 2" />`);
  svg.push(`<path d="M10 9l-2 2" />`);
  svg.push(`<path d="M14 9l2 2" />`);
  svg.push(`<path d="M16 9l-2 2" />`);
  svg.push(`</g>`);

  // Judul error
  svg.push(`<text x="50%" y="${titleY - 4}" class="header" text-anchor="middle">${escapeXml(errorTitle)}</text>`);

  // Pesan error
  let y = startTextY;
  wrappedLines.forEach(line => {
    svg.push(`<text x="50%" y="${y + METRIC_FONT_SIZE - 4}" class="error-text" text-anchor="middle">${escapeXml(line)}</text>`);
    y += lineHeight;
  });

  svg.push(`</svg>`);
  return svg.join('');
}
