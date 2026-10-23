export class RequestBodyTooLargeError extends Error {
  constructor() {
    super('Request body is too large.');
    this.name = 'RequestBodyTooLargeError';
  }
}

/**
 * Read a streamed request body with an actual byte cap. Content-Length alone
 * cannot be trusted because chunked requests may not provide it.
 */
export async function readTextBodyWithLimit(request: Request, maxBytes: number): Promise<string> {
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      throw new Error('Invalid request size.');
    }
    if (contentLength > maxBytes) {
      throw new RequestBodyTooLargeError();
    }
  }

  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(body);
}
