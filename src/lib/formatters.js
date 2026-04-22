
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
 * Estimasi lebar teks dengan mempertimbangkan karakter lebar dan sempit.
 * Menggunakan tabel lebar karakter sederhana untuk akurasi yang lebih baik.
 */
const CHAR_WIDTH_MAP = {
    // Karakter lebar penuh (umumnya huruf besar, angka, simbol tertentu)
    WIDE: 1.0,
    // Karakter sempit (huruf kecil, spasi, titik, dll.)
    NARROW: 0.6
};

function getCharWidth(char) {
    // Karakter yang cenderung lebih lebar
    if (/[A-Z0-9@#%&*()+=?<>{}[\]|]/.test(char)) {
        return CHAR_WIDTH_MAP.WIDE;
    }
    // Karakter sempit termasuk huruf kecil, spasi, tanda baca
    return CHAR_WIDTH_MAP.NARROW;
}

export function measureTextWidth(text, fontSize) {
    if (!text) return 0;
    const avgWidthPerChar = fontSize * 0.55; // Rata-rata proporsional
    let totalWidth = 0;
    for (const char of String(text)) {
        totalWidth += getCharWidth(char) * fontSize * 0.55;
    }
    return totalWidth;
}
