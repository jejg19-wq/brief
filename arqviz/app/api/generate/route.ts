import { NextRequest, NextResponse } from 'next/server';
import { getFal } from '@/lib/fal';
import { ALLOWED_ENDPOINTS } from '@/lib/models';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Encola una generación en fal.ai y devuelve el request_id.
 * El cliente luego consulta /api/status hasta que termine.
 */
export async function POST(req: NextRequest) {
  try {
    const { endpoint, input } = (await req.json()) as {
      endpoint: string;
      input: Record<string, unknown>;
    };
    if (!endpoint || !ALLOWED_ENDPOINTS.has(endpoint)) {
      return NextResponse.json({ error: 'Modelo no permitido' }, { status: 400 });
    }
    if (!input || typeof input !== 'object') {
      return NextResponse.json({ error: 'Falta el input de la generación' }, { status: 400 });
    }
    const fal = getFal();
    const { request_id } = await fal.queue.submit(endpoint, { input });
    return NextResponse.json({ requestId: request_id });
  } catch (err) {
    console.error('generate error', err);
    const message = err instanceof Error ? err.message : 'Error al encolar la generación';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
