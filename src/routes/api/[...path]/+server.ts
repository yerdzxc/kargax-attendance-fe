import type { RequestHandler } from './$types';
import { createHmac } from 'crypto';

const BACKEND = process.env.API_BACKEND_URL || 'http://localhost:3001';
const SECRET = process.env.SIGNING_SECRET || '';

function sign(body: string): { 'x-signature': string; 'x-signature-timestamp': string } {
  const timestamp = new Date().toISOString();
  const sig = createHmac('sha256', SECRET)
    .update(`${timestamp}:${body}`)
    .digest('hex');
  return { 'x-signature': sig, 'x-signature-timestamp': timestamp };
}

const FORWARD_HEADERS = [
  'content-type',
  'accept',
  'authorization',
  'x-signature',
  'x-signature-timestamp',
];

export const GET: RequestHandler = async ({ params, url, request }) => {
  return proxy('GET', params.path, url.searchParams, request.headers);
};

export const POST: RequestHandler = async ({ params, url, request }) => {
  const body = await request.text();
  return proxy('POST', params.path, url.searchParams, request.headers, body);
};

export const PUT: RequestHandler = async ({ params, url, request }) => {
  const body = await request.text();
  return proxy('PUT', params.path, url.searchParams, request.headers, body);
};

export const DELETE: RequestHandler = async ({ params, url, request }) => {
  return proxy('DELETE', params.path, url.searchParams, request.headers);
};

async function proxy(
  method: string,
  path: string | undefined,
  searchParams: URLSearchParams,
  headers: Headers,
  body?: string,
): Promise<Response> {
  const query = searchParams.toString();
  const target = `${BACKEND}/api/${path || ''}${query ? '?' + query : ''}`;

  const proxyHeaders: Record<string, string> = {
    host: new URL(BACKEND).host,
  };

  for (const key of FORWARD_HEADERS) {
    const val = headers.get(key);
    if (val) proxyHeaders[key] = val;
  }

  if (SECRET) {
    const signed = sign(body || '');
    proxyHeaders['x-signature'] = signed['x-signature'];
    proxyHeaders['x-signature-timestamp'] = signed['x-signature-timestamp'];
  }

  const init: RequestInit = { method, headers: proxyHeaders };
  if (body && method !== 'GET' && method !== 'HEAD') {
    init.body = body;
  }

  const res = await fetch(target, init);

  const responseHeaders: Record<string, string> = {};
  const forwardResHeaders = [
    'content-type',
    'content-disposition',
    'content-length',
    'cache-control',
  ];
  for (const key of forwardResHeaders) {
    const val = res.headers.get(key);
    if (val) responseHeaders[key] = val;
  }

  return new Response(res.body, {
    status: res.status,
    headers: responseHeaders,
  });
}
