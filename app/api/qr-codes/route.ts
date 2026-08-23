import { NextResponse } from 'next/server';
import { getLocalQrCodes } from '@/lib/qr';

export interface QrCodeItem {
  id: string;
  filename: string;
  src: string;
  name: string;
}

export async function GET() {
  try {
    const qrCodes = getLocalQrCodes();

    return NextResponse.json(
      {
        success: true,
        qrCodes,
        count: qrCodes.length,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to scan QR directory';
    return NextResponse.json({ success: false, error: message, qrCodes: [] }, { status: 500 });
  }
}
