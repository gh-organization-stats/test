/**
 * Memformat angka besar menjadi string pendek dengan suffix K, M, B, T.
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
 * Memformat ukuran dalam KB ke string yang mudah dibaca (KB, MB, GB).
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
 * Memecah teks menjadi beberapa baris agar tidak melebihi lebar maksimum.
 * @param {string} text - Teks yang akan di-wrap
 * @param {number} maxWidth - Lebar maksimum dalam piksel
 * @param {number} fontSize - Ukuran font dalam piksel
 * @returns {string[]} - Array baris teks
 */
export function wrapText(text, maxWidth, fontSize) {
    // Estimasi karakter per baris (asumsi font monospace atau proporsional rata-rata)
    const avgCharWidth = fontSize * 0.6;
    const maxChars = Math.floor(maxWidth / avgCharWidth);
    
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length > maxChars) {
            if (currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                // Kata tunggal lebih panjang dari maxChars, potong paksa
                lines.push(word.slice(0, maxChars - 3) + '...');
                currentLine = '';
            }
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }
    return lines.length ? lines : [text];
}
