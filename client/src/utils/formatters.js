/**
 * Format bytes to human readable string (e.g. 1.5 MB, 320 KB)
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format ISO date string into Czech localized date/time
 */
export function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return dateString;
  }
}

/**
 * Categorize file extension for preview and icon picking
 */
export function getFileCategory(filename = '') {
  const ext = filename.split('.').pop().toLowerCase();

  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
  const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi'];
  const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'];
  const pdfExts = ['pdf'];
  const codeExts = [
    'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'scss', 'json', 'py', 'sh', 'bash',
    'sql', 'xml', 'yaml', 'yml', 'md', 'txt', 'log', 'ini', 'conf', 'env', 'csv'
  ];
  const archiveExts = ['zip', 'rar', 'tar', 'gz', '7z', 'bz2', 'iso'];

  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  if (pdfExts.includes(ext)) return 'pdf';
  if (codeExts.includes(ext)) return 'code';
  if (archiveExts.includes(ext)) return 'archive';

  return 'other';
}
