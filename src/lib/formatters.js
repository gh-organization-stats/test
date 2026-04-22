
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

/**
 * Estimasi lebar teks dalam piksel (untuk perhitungan layout SVG).
 * @param {string} text - Teks yang diukur
 * @param {number} fontSize - Ukuran font (px)
 * @returns {number} - Estimasi lebar
 */
export function measureTextWidth(text, fontSize = 13) {
    if (!text) return 0;
    const avgCharWidth = fontSize * 0.6; // Rata-rata karakter proporsional
    return String(text).length * avgCharWidth;
}
