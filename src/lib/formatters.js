/**
 * Memformat angka besar menjadi string pendek dengan suffix K, M, B, T.
 * @param {number} num - Angka yang akan diformat
 * @returns {string} - String terformat (misal 1.2K, 3.5M)
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
 * @param {number} sizeKB - Ukuran dalam kilobyte
 * @returns {string} - String terformat (misal "15.2 MB")
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
