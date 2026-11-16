import document from './oneday.html?raw';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const userId = request.headers.get('oai-authenticated-user-id');
  const scope = JSON.stringify('sites.' + (userId || 'guest')).replace(/</g, '\\u003c');
  const identity = `<script>window.__ONEDAY_SITES__=true;window.__ONEDAY_SCOPE__=${scope};</script>`;
  return new Response(document.replace('<!--__SITES_IDENTITY__-->', identity), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    },
  });
}
