import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Informa al cliente si la app está en modo demo (sin FAL_KEY configurada).
 * En demo, todo el flujo funciona con generaciones simuladas y costo $0.
 */
export function GET() {
  return NextResponse.json({ demo: !process.env.FAL_KEY, version: '2.0.0', fidelity: 'server-enforced', models: ['Nano Banana Pro', 'Nano Banana 2', 'Seedance'], authConfigured: Boolean(process.env.STUDIO_PASSWORD) });
}
