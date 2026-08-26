import { NextRequest, NextResponse } from 'next/server';
import { getFal } from '@/lib/fal';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/**
 * Sube el plano (u otra imagen) a fal storage y devuelve una URL
 * que los modelos pueden usar como referencia.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Formato no soportado. Sube el plano como PNG, JPG o WebP.' },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'El archivo supera los 25 MB' }, { status: 400 });
    }
    const fal = getFal();
    const url = await fal.storage.upload(file);
    return NextResponse.json({ url });
  } catch (err) {
    console.error('upload error', err);
    return NextResponse.json({ error: 'No se pudo subir el archivo' }, { status: 500 });
  }
}
