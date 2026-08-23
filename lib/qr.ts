import fs from 'fs';
import path from 'path';
import type { QrCodeItem } from '@/app/api/qr-codes/route';

export function getLocalQrCodes(): QrCodeItem[] {
  try {
    const qrDir = path.join(process.cwd(), 'public', 'qr');

    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    const files = fs.readdirSync(qrDir);
    const validExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);

    const qrFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return validExtensions.has(ext);
    });

    // Natural sort filenames (e.g. qr1, qr2, qr10)
    qrFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    return qrFiles.map((filename, index) => {
      const parsed = path.parse(filename);
      const cleanName = parsed.name
        .replace(/^[\d_-]+/, '')
        .replace(/[_-]+/g, ' ')
        .trim();

      const formattedName = cleanName
        ? cleanName.charAt(0).toUpperCase() + cleanName.slice(1)
        : `QR Code ${index + 1}`;

      return {
        id: `qr-${index + 1}`,
        filename,
        src: `/qr/${encodeURIComponent(filename)}`,
        name: formattedName,
      };
    });
  } catch (error) {
    console.error('Error reading QR codes directory:', error);
    return [];
  }
}
