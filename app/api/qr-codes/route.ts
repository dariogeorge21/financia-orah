import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export interface QrCodeItem {
  id: string;
  filename: string;
  src: string;
  name: string;
}

export async function GET() {
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

    const qrCodes: QrCodeItem[] = qrFiles.map((filename, index) => {
      const parsed = path.parse(filename);
      // Format a clean readable label from filename (e.g. "gpay_primary" -> "Gpay Primary")
      const cleanName = parsed.name
        .replace(/^[\d_-]+/, '') // remove leading numbers/dashes if any
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

    return NextResponse.json({
      success: true,
      qrCodes,
      count: qrCodes.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to scan QR directory';
    return NextResponse.json({ success: false, error: message, qrCodes: [] }, { status: 500 });
  }
}
