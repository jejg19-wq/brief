import { NextRequest, NextResponse } from 'next/server';
import { getFal } from '@/lib/fal';
import { ALLOWED_ENDPOINTS } from '@/lib/models';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface FalFile { url?: string }
interface FalResultData {
  images?: FalFile[];
  image?: FalFile;
  video?: FalFile;
}

/** Consulta el estado de una generación; si terminó, devuelve las URLs. */
export async function GET(req: NextRequest) {
  const endpoint = req.nextUrl.searchParams.get('endpoint') ?? '';
  const requestId = req.nextUrl.searchParams.get('requestId') ?? '';
  if (!ALLOWED_ENDPOINTS.has(endpoint) || !requestId) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }
  try {
    const fal = getFal();
    const status = await fal.queue.status(endpoint, { requestId, logs: false });

    if (status.status === 'COMPLETED') {
      const result = await fal.queue.result(endpoint, { requestId });
      const data = result.data as FalResultData;
      const urls: string[] = [];
      if (Array.isArray(data.images)) {
        for (const img of data.images) if (img?.url) urls.push(img.url);
      }
      if (data.image?.url) urls.push(data.image.url);
      if (data.video?.url) urls.push(data.video.url);
      return NextResponse.json({ status: 'done', urls });
    }

    if (status.status === 'IN_PROGRESS') return NextResponse.json({ status: 'running' });
    return NextResponse.json({ status: 'queued' });
  } catch (err) {
    console.error('status error', err);
    return NextResponse.json({ status: 'error', error: 'La generación falló' }, { status: 200 });
  }
}
