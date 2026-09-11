/**
 * Contraseña del estudio.
 *
 * Por pedido del estudio, la app sale protegida de fábrica con la contraseña
 * "decostone" (usuario libre, por ejemplo "numan"). Si en Vercel se define la
 * variable STUDIO_PASSWORD, esa gana y la de fábrica deja de valer.
 */
export const DEFAULT_STUDIO_PASSWORD = 'decostone';

export function studioPassword(): string {
  return process.env.STUDIO_PASSWORD || DEFAULT_STUDIO_PASSWORD;
}
