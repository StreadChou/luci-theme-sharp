import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../htdocs/luci-static/resources/sharp/branding.js', import.meta.url), 'utf8');
const Branding = new Function('_', 'baseclass', source)(message => message, {
  extend(methods) {
    class NativeModule {}
    Object.assign(NativeModule.prototype, methods);
    return NativeModule;
  }
});
const branding = new Branding();

test('Logo paths retain defaults and normalize web-root paths', () => {
  assert.equal(branding.normalizeLogoPath(undefined), '');
  assert.equal(branding.normalizeLogoPath('  '), '');
  assert.equal(branding.normalizeLogoPath(' /www/luci-static/sharp-custom/logo.png '), '/luci-static/sharp-custom/logo.png');
  assert.equal(branding.normalizeLogoPath('/luci-static/标识.SVG'), '/luci-static/标识.SVG');
});

test('Logo paths cannot escape public images or use executable URLs', () => {
  for (const path of [
    'https://example.com/logo.png', '//example.com/logo.png', 'javascript:alert(1)',
    'data:image/svg+xml,test', '/etc/shadow', '/cgi-bin/luci/admin/logout',
    '/luci-static/../secret.png', '/luci-static/./logo.png', '/luci-static/%2e%2e/logo.png',
    '/luci-static/logo.png?x=1', '/luci-static/logo.svg#x', '/luci-static/logo.html',
    '/luci-static/a\\logo.png', '/luci-static/a\x7f.png', '/luci-static/\nlogo.png', '/luci-static/a".png'
  ]) assert.equal(branding.normalizeLogoPath(path), null, path);
});

test('Unsupported or oversized uploads are rejected before image decoding', async () => {
  await assert.rejects(branding.prepareLogo({ name: 'logo.html', size: 100 }), /Choose a PNG/);
  await assert.rejects(branding.prepareLogo({ name: 'logo.png', size: 2 * 1024 * 1024 + 1 }), /no larger than 2 MB/);
});

test('Native LuCI modules remain valid loader functions', async () => {
  const view = await readFile(new URL('../htdocs/luci-static/resources/view/sharp/basic.js', import.meta.url), 'utf8');
  assert.doesNotThrow(() => new Function(view));
});

test('The CGI upload contract publishes readable PNGs under the dedicated path', () => {
  const blob = new Blob(['fixture'], { type: 'image/png' });
  const data = branding.createUpload(blob, '/luci-static/sharp-custom/logo-1234.png', 'test-session');
  assert.equal(data.get('sessionid'), 'test-session');
  assert.equal(data.get('filename'), '/www/luci-static/sharp-custom/logo-1234.png');
  assert.equal(data.get('filemode'), '0644');
  assert.equal(data.get('filedata').type, 'image/png');
  assert.equal(data.get('filedata').name, 'logo.png');
});
