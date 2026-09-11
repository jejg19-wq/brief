import { NextRequest, NextResponse } from 'next/server';
import { getFal } from '@/lib/fal';
import { prepareGeneration, POLICY_VERSION } from '@/lib/fidelity';
import { jobToken } from '@/lib/jobs';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') && req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 });
  let prepared;
  try {
    const raw = await req.text();
    if (raw.length > 65000) throw new Error('Solicitud demasiado grande.');
    prepared = prepareGeneration(JSON.parse(raw));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Solicitud inválida' }, { status: 400 });
  }
  try {
    const { request_id } = await getFal().queue.submit(prepared.endpoint, { input: prepared.input });
    return NextResponse.json({ requestId: request_id, jobToken: jobToken(prepared.endpoint, request_id), prompt: prepared.prompt, policyVersion: POLICY_VERSION });
  } catch {
    return NextResponse.json({ error: 'No se pudo confirmar la generación. Revisa la cola de fal antes de repetir para evitar un cobro duplicado.' }, { status: 502 });
  }
}
