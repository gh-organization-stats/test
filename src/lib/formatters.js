/**
 * Memformat angka besar menjadi string pendek (K, M, B, T).
 */
export function formatNumber(num) {
    if (num >= 1_000_000_000_000) {
        return (num / 1_000_000_000_000).toFixed(1).replace(/\.0$/, '') + 'T';
    }
    if (num >= 1_000_000_000) {
        return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    }
    if (num >= 1_000_000) {
        return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1_000) {
        return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
}

/**
 * Memformat ukuran dalam KB ke string yang mudah dibaca.
 */
export function formatSize(sizeKB) {
    if (sizeKB >= 1024 * 1024) {
        return (sizeKB / (1024 * 1024)).toFixed(2) + ' GB';
    }
    if (sizeKB >= 1024) {
        return (sizeKB / 1024).toFixed(2) + ' MB';
    }
    return sizeKB + ' KB';
}

/**
 * Memecah teks menjadi beberapa baris.
 */
export function wrapText(text, maxWidth, fontSize) {
    const avgCharWidth = fontSize * 0.6;
    const maxChars = Math.floor(maxWidth / avgCharWidth);
    
    const words = String(text).split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length > maxChars) {
            if (currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                lines.push(word.slice(0, maxChars - 3) + '...');
                currentLine = '';
            }
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines.length ? lines : [String(text)];
}

// ===== FUNGSI INI DIAMBIL PERSIS DARI github-readme-stats =====
const thin = 0.4;
const normal = 0.55;
const wide = 0.7;

const CHAR_WIDTH_MAP = {
    // Huruf besar
    A: wide, B: wide, C: wide, D: wide, E: wide, F: wide, G: wide, H: wide, I: thin, J: wide, K: wide, L: wide, M: wide,
    N: wide, O: wide, P: wide, Q: wide, R: wide, S: wide, T: wide, U: wide, V: wide, W: wide, X: wide, Y: wide, Z: wide,
    // Huruf kecil
    a: normal, b: normal, c: normal, d: normal, e: normal, f: thin, g: normal, h: normal, i: thin, j: thin, k: normal,
    l: thin, m: wide, n: normal, o: normal, p: normal, q: normal, r: thin, s: normal, t: thin, u: normal, v: normal,
    w: wide, x: normal, y: normal, z: normal,
    // Angka
    '0': wide, '1': thin, '2': normal, '3': normal, '4': normal, '5': normal, '6': normal, '7': normal, '8': normal, '9': normal,
    // Simbol umum
    ' ': thin, '.': thin, ',': thin, ':': thin, ';': thin, '!': thin, '?': normal, '"': normal, "'": thin, '-': thin,
    '_': normal, '@': wide, '#': wide, '$': normal, '%': wide, '&': wide, '*': normal, '(': thin, ')': thin, '+': normal,
    '=': normal, '<': normal, '>': normal, '/': thin, '\\': thin, '|': thin
};

export function measureTextWidth(text, fontSize) {
    if (!text) return 0;
    let width = 0;
    for (const char of String(text)) {
        const multiplier = CHAR_WIDTH_MAP[char] || normal;
        width += multiplier * fontSize;
    }
    return width;
}
