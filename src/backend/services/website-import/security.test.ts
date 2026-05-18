import test from 'node:test';
import assert from 'node:assert/strict';

import { isPrivateOrLocalIp, preflightUrl } from './security';

test('preflight rejects localhost and non-http schemes', async () => {
  await assert.rejects(() => preflightUrl('http://localhost:3000'));
  await assert.rejects(() => preflightUrl('file:///etc/passwd'));
  await assert.rejects(() => preflightUrl('javascript:alert(1)'));
  await assert.rejects(() => preflightUrl('mailto:test@example.com'));
  await assert.rejects(() => preflightUrl('tel:+15555550123'));
  await assert.rejects(() => preflightUrl('ftp://example.com/file'));
  await assert.rejects(() => preflightUrl('data:text/html,hello'));
});

test('preflight rejects private and metadata IPs', async () => {
  assert.equal(isPrivateOrLocalIp('10.0.0.1'), true);
  assert.equal(isPrivateOrLocalIp('172.16.0.1'), true);
  assert.equal(isPrivateOrLocalIp('192.168.1.1'), true);
  assert.equal(isPrivateOrLocalIp('100.64.0.1'), true);
  assert.equal(isPrivateOrLocalIp('224.0.0.1'), true);
  assert.equal(isPrivateOrLocalIp('169.254.169.254'), true);
  assert.equal(isPrivateOrLocalIp('fc00::1'), true);
  assert.equal(isPrivateOrLocalIp('fe80::1'), true);
  await assert.rejects(() => preflightUrl('http://169.254.169.254/latest/meta-data'));
});

test('preflight rejects DNS records resolving to private IP and allows public https', async () => {
  await assert.rejects(() => preflightUrl('https://example.test', { lookup: async () => [{ address: '127.0.0.1', family: 4 }] }));
  const url = await preflightUrl('example.com/path?utm_source=x#frag', { lookup: async () => [{ address: '93.184.216.34', family: 4 }] });
  assert.equal(url.toString(), 'https://example.com/path');
});


test('preflight rejects IPv4-mapped IPv6 private and metadata addresses', async () => {
  assert.equal(isPrivateOrLocalIp('::ffff:127.0.0.1'), true);
  assert.equal(isPrivateOrLocalIp('::ffff:10.0.0.1'), true);
  assert.equal(isPrivateOrLocalIp('::ffff:192.168.1.1'), true);
  assert.equal(isPrivateOrLocalIp('::ffff:172.16.0.1'), true);
  assert.equal(isPrivateOrLocalIp('::ffff:169.254.169.254'), true);
  assert.equal(isPrivateOrLocalIp('::ffff:0.0.0.0'), true);
  await assert.rejects(() => preflightUrl('https://example.test', { lookup: async () => [{ address: '::ffff:127.0.0.1', family: 6 }] }));
});

test('preflight rejects parser trick URLs for private hosts and unsupported schemes', async () => {
  // WHATWG URL normalizes these legacy IP forms to 127.0.0.1 in Node, then private-IP blocking handles them.
  await assert.rejects(() => preflightUrl('http://2130706433'));
  await assert.rejects(() => preflightUrl('http://0177.0.0.1'));
  await assert.rejects(() => preflightUrl('http://0x7f.0.0.1'));
  await assert.rejects(() => preflightUrl('http:\\\\127.0.0.1\\admin'));
  await assert.rejects(() => preflightUrl('JaVaScRiPt:alert(1)'));
  await assert.rejects(() => preflightUrl('\u0000https://example.com'));
});

test('preflight treats encoded scheme text as a hostname, not an executable scheme', async () => {
  await assert.rejects(() => preflightUrl('javascript%3Aalert.example', { lookup: async () => { throw new Error('dns_lookup_failed'); } }));
});
