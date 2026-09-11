import { NextRequest, NextResponse } from 'next/server';
import { studioPassword } from '@/lib/auth';
/** HTTP Basic protection for the studio (default password in lib/auth.ts). Client presentations stay accessible by link. */
export function middleware(req: NextRequest) {
  const password = studioPassword();
  if (!password || req.nextUrl.pathname.startsWith('/p/') || req.nextUrl.pathname.startsWith('/_next/')) return NextResponse.next();
  const header = req.headers.get('authorization');
  try {
    if (header?.startsWith('Basic ')) {
      const decoded = atob(header.slice(6));
      if (decoded.slice(decoded.indexOf(':') + 1) === password) return NextResponse.next();
    }
  } catch { /* challenge invalid input */ }
  return new NextResponse('Acceso al estudio numan', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="numan", charset="UTF-8"', 'Cache-Control': 'no-store' } });
}
export const config = { matcher: ['/((?!favicon.ico).*)'] };
