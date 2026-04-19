import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://127.0.0.1:3000';

export const dynamic = 'force-dynamic';

const proxyRequest = async (
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> => {
  const { path } = await context.params;
  const targetUrl = new URL(`${BACKEND_URL}/${path.join('/')}`);

  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  const headers = new Headers(request.headers);
  headers.delete('host');

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
    cache: 'no-store',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
  }

  try {
    const response = await fetch(targetUrl, init);
    const body = await response.text();
    const responseHeaders = new Headers(response.headers);

    return new NextResponse(body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json({ message: 'Backend unavailable' }, { status: 503 });
  }
};

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;
