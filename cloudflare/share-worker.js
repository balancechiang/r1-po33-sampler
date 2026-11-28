/*
 * User-owned, temporary Web Sampler file sharing for Cloudflare Workers + R2.
 * Bind a private R2 bucket as PROJECTS and set UPLOAD_TOKEN as a Worker secret.
 * No bucket credentials or signing keys are sent to the browser.
 */
const MAX_BYTES = 128 * 1024 * 1024;
const PREFIX = 'share/';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-File-Name, X-File-Size',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Type',
  'Vary': 'Origin'
};

function respond(body, status = 200, headers = {}) {
  return new Response(body, {status, headers: {...CORS, ...headers}});
}

function safeName(value) {
  let name;
  try { name = decodeURIComponent(value || ''); } catch { return null; }
  if (!name || name.length > 180 || /[\\/\x00-\x1f<>:"|?*]/.test(name)) return null;
  if (!/\.(wav|m4a|json|po33frame|po33\.gz)$/i.test(name)) return null;
  return name;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function contentType(name) {
  return /\.json$/i.test(name) ? 'application/json' :
    /\.wav$/i.test(name) ? 'audio/wav' :
    /\.m4a$/i.test(name) ? 'audio/mp4' : 'application/octet-stream';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return respond(null, 204);

    if (request.method === 'POST' && url.pathname === '/api/upload') {
      if (!env.PROJECTS || !env.UPLOAD_TOKEN) return respond('Worker is not configured', 503);
      const authorization = request.headers.get('Authorization') || '';
      if (authorization !== `Bearer ${env.UPLOAD_TOKEN}`) return respond('Unauthorized', 401);
      const name = safeName(request.headers.get('X-File-Name'));
      if (!name) return respond('Unsupported or invalid filename', 400);
      const length = Number(request.headers.get('X-File-Size') || request.headers.get('Content-Length'));
      if (!Number.isSafeInteger(length) || length < 1 || length > MAX_BYTES) return respond('File size is invalid or exceeds 128 MB', 413);
      if (!request.body) return respond('Empty upload', 400);
      const allowedTtl = new Set([3600, 21600, 86400]);
      const ttl = Number(url.searchParams.get('ttl') || 3600);
      if (!allowedTtl.has(ttl)) return respond('TTL must be 3600, 21600 or 86400 seconds', 400);

      const token = randomToken();
      const key = `${PREFIX}${token}/${name}`;
      const expiresAt = Math.floor(Date.now() / 1000) + ttl;
      let received = 0;
      const boundedBody = request.body.pipeThrough(new TransformStream({
        transform(chunk, controller) {
          received += chunk.byteLength;
          if (received > MAX_BYTES || received > length) return controller.error(new Error('Upload exceeded declared size limit'));
          controller.enqueue(chunk);
        },
        flush(controller) {
          if (received !== length) controller.error(new Error('Upload size did not match the declared size'));
        }
      }));
      await env.PROJECTS.put(key, boundedBody, {
        httpMetadata: {contentType: contentType(name)},
        customMetadata: {expiresAt: String(expiresAt), originalName: name}
      });
      const download = new URL(`/download/${token}/${encodeURIComponent(name)}`, url.origin);
      download.searchParams.set('expires', String(expiresAt));
      return respond(JSON.stringify({url: download.href, expiresAt, sizeBytes: length}), 201, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
    }

    if (request.method === 'GET' && url.pathname.startsWith('/download/')) {
      if (!env.PROJECTS) return respond('Worker is not configured', 503);
      const [, , token, ...parts] = url.pathname.split('/');
      const name = safeName(parts.join('/'));
      const expiresAt = Number(url.searchParams.get('expires'));
      if (!/^[A-Za-z0-9_-]{32}$/.test(token || '') || !name || !Number.isSafeInteger(expiresAt)) return respond('Invalid share link', 400);
      const object = await env.PROJECTS.get(`${PREFIX}${token}/${name}`);
      if (!object) return respond('File not found or expired', 404);
      if (Number(object.customMetadata?.expiresAt) !== expiresAt) return respond('Invalid share link', 403);
      if (Date.now() / 1000 >= expiresAt) {
        await env.PROJECTS.delete(`${PREFIX}${token}/${name}`).catch(() => {});
        return respond('This share link has expired', 410);
      }
      return new Response(object.body, {status: 200, headers: {
        ...CORS,
        'Content-Type': contentType(name),
        'Content-Length': String(object.size),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff'
      }});
    }

    return respond('Not found', 404);
  }
};
