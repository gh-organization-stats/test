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
 * Fungsi untuk mengukur lebar teks. Meniru logika di github-readme-stats.
 */
export function measureTextWidth(text, fontSize) {
    if (!text) return 0;
    const charWidths = {
        thin: 0.4,
        normal: 0.55,
        wide: 0.7
    };
    let width = 0;
    for (const char of String(text)) {
        // Karakter lebar: huruf besar, angka, simbol tertentu
        if (/[A-Z0-9@#%&*()+=?<>{}[\]|]/.test(char)) {
            width += charWidths.wide * fontSize;
        }
        // Karakter sempit: huruf kecil, spasi, titik, koma, dll.
        else if (/[a-z\s.,;:'"!-]/.test(char)) {
            width += charWidths.thin * fontSize;
        }
        // Default
        else {
            width += charWidths.normal * fontSize;
        }
    }
    return width;
}
