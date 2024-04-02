import type {ServerResponse, IncomingMessage} from 'node:http';
import {Readable} from 'node:stream';
import type {Response} from '@shopify/mini-oxygen';

/**
 * Creates a fully qualified URL from a Node request or a string.
 * In the case of a Node request, it uses the host header to determine the origin.
 */
export function toURL(req: string | IncomingMessage = '/', origin?: string) {
  const isRequest = typeof req !== 'string';
  const pathname = (isRequest ? req.url : req) || '/';

  return new URL(
    pathname,
    origin ||
      (isRequest && req.headers.host && `http://${req.headers.host}`) ||
      'http://example.com',
  );
}

/**
 * Turns a Node request into a Web request by using native Node APIs.
 */
export async function toWeb(
  req: IncomingMessage,
  headers?: Record<string, string>,
) {
  const {Request} = await import('@shopify/mini-oxygen');

  return new Request(toURL(req), {
    method: req.method,
    headers: {...headers, ...(req.headers as object)},
    body: req.headers['content-length'] ? Readable.toWeb(req) : undefined,
    duplex: 'half', // This is required when sending a ReadableStream as body
    redirect: 'manual', // Avoid consuming 300 responses here, return to browser
  });
}

/**
 * Reads from a Web response and writes to a Node response
 * using native Node APIs.
 */
export function pipeFromWeb(webResponse: Response, res: ServerResponse) {
  const headers = Object.fromEntries(webResponse.headers.entries());

  const setCookieHeader = 'set-cookie';
  if (headers[setCookieHeader]) {
    delete headers[setCookieHeader];
    res.setHeader(setCookieHeader, webResponse.headers.getSetCookie());
  }

  res.writeHead(webResponse.status, webResponse.statusText, headers);

  if (webResponse.body) {
    Readable.fromWeb(webResponse.body).pipe(res);
  } else {
    res.end();
  }
}
