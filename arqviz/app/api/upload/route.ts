import { NextRequest, NextResponse } from 'next/server';
import { getFal } from '@/lib/fal';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // below the Vercel request body ceiling
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
      return NextResponse.json({ error: 'El archivo supera los 4 MB' }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.slice(0,12).arrayBuffer());
    const valid = file.type === 'image/png' ? bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71
      : file.type === 'image/jpeg' ? bytes[0]===255 && bytes[1]===216 && bytes[2]===255
      : String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    if (!valid || file.size === 0) return NextResponse.json({error:'El contenido del archivo no coincide con su formato.'},{status:400});
    const fal = getFal();
    const url = await fal.storage.upload(file);
    return NextResponse.json({ url });
  } catch (err) {
    console.error('upload error', err);
    return NextResponse.json({ error: 'No se pudo subir el archivo' }, { status: 500 });
  }
}
