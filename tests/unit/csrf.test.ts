import { describe, it, expect } from 'vitest';
import { validateCsrf } from '@/src/server/auth/rbac';
import { NextRequest } from 'next/server';

function createMockRequest(options: {
  method?: string;
  origin?: string;
  referer?: string;
  host?: string;
  forwardedHost?: string;
  secFetchSite?: string;
  url?: string;
}): NextRequest {
  const headers = new Headers();
  if (options.origin) headers.set('origin', options.origin);
  if (options.referer) headers.set('referer', options.referer);
  if (options.host) headers.set('host', options.host);
  if (options.forwardedHost) headers.set('x-forwarded-host', options.forwardedHost);
  if (options.secFetchSite) headers.set('sec-fetch-site', options.secFetchSite);

  const url = options.url || 'http://localhost:3000/api/orders';
  return new NextRequest(url, {
    method: options.method || 'POST',
    headers,
  });
}

describe('Unit: CSRF Validation', () => {
  it('allows safe HTTP methods (GET, HEAD, OPTIONS)', () => {
    expect(validateCsrf(createMockRequest({ method: 'GET', origin: 'http://evil.com' }))).toBe(true);
    expect(validateCsrf(createMockRequest({ method: 'HEAD', origin: 'http://evil.com' }))).toBe(true);
    expect(validateCsrf(createMockRequest({ method: 'OPTIONS', origin: 'http://evil.com' }))).toBe(true);
  });

  it('allows requests with sec-fetch-site: same-origin', () => {
    const req = createMockRequest({
      method: 'POST',
      secFetchSite: 'same-origin',
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
    });
    expect(validateCsrf(req)).toBe(true);
  });

  it('allows matching localhost origins and loopback addresses', () => {
    const req1 = createMockRequest({
      method: 'POST',
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
    });
    expect(validateCsrf(req1)).toBe(true);

    const req2 = createMockRequest({
      method: 'POST',
      origin: 'http://127.0.0.1:3000',
      host: 'localhost:3000',
    });
    expect(validateCsrf(req2)).toBe(true);

    const req3 = createMockRequest({
      method: 'POST',
      origin: 'http://localhost:3000',
      host: '127.0.0.1:3000',
    });
    expect(validateCsrf(req3)).toBe(true);
  });

  it('allows reverse proxies using x-forwarded-host', () => {
    const req = createMockRequest({
      method: 'POST',
      origin: 'https://mycafe.com',
      host: 'localhost:3000',
      forwardedHost: 'mycafe.com',
    });
    expect(validateCsrf(req)).toBe(true);
  });

  it('allows requests using referer fallback when origin is omitted', () => {
    const req = createMockRequest({
      method: 'POST',
      referer: 'http://localhost:3000/order',
      host: 'localhost:3000',
    });
    expect(validateCsrf(req)).toBe(true);
  });

  it('rejects malicious cross-origin POST requests', () => {
    const req = createMockRequest({
      method: 'POST',
      origin: 'https://malicious-site.com',
      host: 'mycafe.com',
      url: 'https://mycafe.com/api/orders',
    });
    expect(validateCsrf(req)).toBe(false);
  });
});
