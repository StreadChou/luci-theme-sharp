import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const moduleFrom = async path => new (new Function('_', 'baseclass', await readFile(new URL(path, import.meta.url), 'utf8'))(message => message, {
  extend(methods) { class NativeModule {} Object.assign(NativeModule.prototype, methods); return NativeModule; }
}))();
const login = await moduleFrom('../htdocs/luci-static/resources/sharp/login.js');
const images = await moduleFrom('../htdocs/luci-static/resources/sharp/branding.js');

test('Missing and invalid login preferences preserve the existing default login', () => {
  assert.deepEqual(login.normalize({}), { layout: 'centered', background: 'default', fit: 'cover', dim: 20, opacity: 100, blur: 0 });
  const invalid = { login_layout: 'unknown', login_background: 'https://example.com', login_background_fit: 'x' };
  for (const value of ['-1', '101', '1.5', '1e1', '10px', '0; color:red', undefined, null]) {
    assert.deepEqual(login.normalize({ ...invalid, login_panel_opacity: value }), login.normalize({}));
  }
});

test('Login settings retain boundary values, including transparent panels', () => {
  assert.deepEqual(login.normalize({ login_layout: 'sidebar', login_background: 'image', login_background_fit: 'contain',
    login_background_dim: '80', login_panel_opacity: '0', login_panel_blur: '30' }),
  { layout: 'sidebar', background: 'image', fit: 'contain', dim: 80, opacity: 0, blur: 30 });
  assert.equal(login.normalize({ login_background_dim: '81' }).dim, 20);
  assert.equal(login.normalize({ login_panel_blur: '31' }).blur, 0);
});

test('Background sources accept the known providers and reject arbitrary URLs', () => {
  for (const source of ['default', 'plain', 'bing', 'wallhaven', 'image'])
    assert.equal(login.normalize({ login_background: source, login_background_image: '/luci-static/custom.jpg' }).background, source);
  assert.equal(login.normalize({ login_background: 'https://example.com' }).background, 'default');
});

test('Background uploads use their own limits and publish a readable JPEG', async () => {
  await assert.rejects(images.prepareBackground({ name: 'background.png', size: 10 * 1024 * 1024 + 1 }), /10 MB/);
  await assert.rejects(images.prepareBackground({ name: 'background.mp4', size: 100 }), /Choose a PNG/);
  const data = images.createUpload(new Blob(['fixture'], { type: 'image/jpeg' }), '/luci-static/sharp-custom/background-test.jpg', 'test-session');
  assert.equal(data.get('filename'), '/www/luci-static/sharp-custom/background-test.jpg');
  assert.equal(data.get('filemode'), '0644');
  assert.equal(data.get('filedata').name, 'background.jpg');
  assert.equal(data.get('filedata').type, 'image/jpeg');
});

test('The login view is a valid native LuCI loader module', async () => {
  const source = await readFile(new URL('../htdocs/luci-static/resources/view/sharp/login.js', import.meta.url), 'utf8');
  assert.doesNotThrow(() => new Function(source));
});
