import { createFalClient } from '@fal-ai/client';

// Cliente fal.ai del lado del servidor. La FAL_KEY nunca llega al navegador.
export function getFal() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('Falta la variable de entorno FAL_KEY');
  return createFalClient({ credentials: key });
}
