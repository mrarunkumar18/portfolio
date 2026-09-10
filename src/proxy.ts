import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { nextUrl } = request;

  // Force HTTPS in production for live domains (skip localhost/127.0.0.1 local testing)
  const isLocalhost = nextUrl.hostname === 'localhost' || nextUrl.hostname === '127.0.0.1';
  if (process.env.NODE_ENV === 'production' && nextUrl.protocol === 'http:' && !isLocalhost) {
    const httpsUrl = nextUrl.clone();
    httpsUrl.protocol = 'https:';
    return NextResponse.redirect(httpsUrl, 308);
  }

  const response = NextResponse.next();

  // Harden transport/security policy (Initial safer HSTS without includeSubDomains/preload per requirements)
  response.headers.set('Strict-Transport-Security', 'max-age=31536000');
  response.headers.set('Content-Security-Policy', 'upgrade-insecure-requests; block-all-mixed-content');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

export const config = {
  matcher: '/:path*',
};