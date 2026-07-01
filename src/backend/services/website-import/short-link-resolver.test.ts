import test from 'node:test';
import assert from 'node:assert/strict';

import { clearShortLinkResolutionCache, resolveGoogleMapsShortLink } from './short-link-resolver';

const lookup = async () => [{ address: '93.184.216.34', family: 4 }];

test('passes through non-Maps-shortener hosts unchanged (e.g. bit.ly), never issuing a request', async () => {
  let fetchCount = 0;
  const url = new URL('https://bit.ly/some-unrelated-page');
  const result = await resolveGoogleMapsShortLink(url, {
    lookup,
    fetcher: async () => {
      fetchCount += 1;
      return new Response('', { status: 200 });
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.wasShortLink, false);
    assert.equal(result.resolvedUrl.toString(), url.toString());
  }
  assert.equal(fetchCount, 0);
});

test('resolves maps.app.goo.gl through a redirect chain to the final Maps URL', async () => {
  clearShortLinkResolutionCache();
  const result = await resolveGoogleMapsShortLink(new URL('https://maps.app.goo.gl/abc123'), {
    lookup,
    fetcher: async (url) => {
      if (url.includes('maps.app.goo.gl')) {
        return new Response('', { status: 301, headers: { location: 'https://www.google.com/maps/place/Glow+Nail+Spa/@34.05,-118.25,17z' } });
      }
      return new Response('', { status: 200 });
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.wasShortLink, true);
    assert.equal(result.resolvedUrl.hostname, 'www.google.com');
    assert.equal(result.resolvedUrl.pathname.startsWith('/maps/place/'), true);
  }
});

test('falls back from HEAD to GET when the redirector rejects HEAD', async () => {
  clearShortLinkResolutionCache();
  let headAttempts = 0;
  let getAttempts = 0;
  const result = await resolveGoogleMapsShortLink(new URL('https://g.page/rejects-head-xyz'), {
    lookup,
    fetcher: async (url, init) => {
      if (!url.includes('g.page')) return new Response('', { status: 200 }); // final destination, terminal
      if (init?.method === 'HEAD') {
        headAttempts += 1;
        return new Response('', { status: 405 });
      }
      getAttempts += 1;
      return new Response('', { status: 302, headers: { location: 'https://www.google.com/maps/place/Resolved' } });
    },
  });
  assert.equal(headAttempts >= 1, true);
  assert.equal(getAttempts >= 1, true);
  assert.equal(result.ok, true);
});

test('returns SHORT_LINK_RESOLUTION_FAILED for a dead/expired short link instead of falling through silently', async () => {
  clearShortLinkResolutionCache();
  const result = await resolveGoogleMapsShortLink(new URL('https://maps.app.goo.gl/dead-link'), {
    lookup,
    fetcher: async () => new Response('Not Found', { status: 404 }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errorCode, 'SHORT_LINK_RESOLUTION_FAILED');
});

test('caches a resolution so a repeated paste does not re-issue the redirect request', async () => {
  clearShortLinkResolutionCache();
  let fetchCount = 0;
  const url = new URL('https://maps.app.goo.gl/repeat-me');
  const fetcher = async (target: string) => {
    fetchCount += 1;
    if (target.includes('maps.app.goo.gl')) {
      return new Response('', { status: 301, headers: { location: 'https://www.google.com/maps/place/Cached+Salon' } });
    }
    return new Response('', { status: 200 });
  };
  const first = await resolveGoogleMapsShortLink(url, { lookup, fetcher });
  const countAfterFirst = fetchCount;
  const second = await resolveGoogleMapsShortLink(url, { lookup, fetcher });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(fetchCount, countAfterFirst); // no additional network calls on the cached repeat
});
