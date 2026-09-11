import { createHmac, timingSafeEqual } from 'node:crypto';
function sign(value: string) { return createHmac('sha256', process.env.FAL_KEY || 'demo').update(value).digest('base64url'); }
export function jobToken(endpoint: string, id: string) { return sign(endpoint + ':' + id); }
export function verifyJob(endpoint: string, id: string, token: string) {
  const a = Buffer.from(jobToken(endpoint, id)), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
