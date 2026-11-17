import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, utimesSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function fixture(t, budget = '6') {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sharp-wallpaper-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bin = path.join(dir, 'bin');
  const cache = path.join(dir, 'cache');
  mkdirSync(bin);
  const executable = (name, body) => writeFileSync(path.join(bin, name), body, { mode: 0o755 });
  executable('fetch', `#!/bin/sh
printf '%s\\n' "$*" >> "$TEST_REQUESTS"
[ "$TEST_MODE" != failure ] || exit 1
[ "$TEST_MODE" != hang ] || exec sleep 10
while [ "$#" -gt 0 ]; do
  if [ "$1" = -O ]; then shift; output="$1"; fi
  shift
done
printf '%s' "$TEST_BODY" > "$output"
`);
  executable('date', `#!/usr/bin/env python3
import os,sys,time
print(int(os.stat(sys.argv[2]).st_mtime if sys.argv[1]=='-r' else time.time()))
`);
  executable('jsonfilter', `#!/usr/bin/env python3
import json,re,sys
try:
  with open(sys.argv[2]) as f: value=json.load(f)
  for key in re.findall(r'[a-zA-Z_]+|[0-9]+',sys.argv[4]):
    value=value[int(key)] if isinstance(value,list) else value[key]
  if isinstance(value,str): print(value)
except (ValueError,KeyError,IndexError,TypeError): sys.exit(1)
`);
  const script = path.join(dir, 'cgi');
  writeFileSync(script, readFileSync(new URL('../root/www/cgi-bin/sharp-wallpaper', import.meta.url), 'utf8')
    .replace('cache_dir=/var/run/sharp-wallpaper', `cache_dir='${cache}'`)
    .replace('downloader=/usr/libexec/wget-ssl', `downloader='${bin}/fetch'`)
    .replace('sleep 6;', `sleep ${budget};`));
  return {
    cache,
    requests: () => existsSync(path.join(dir, 'requests')) ? readFileSync(path.join(dir, 'requests'), 'utf8').trim().split('\n') : [],
    call({ source = 'bing', body = { images: [{ url: '/th?id=OHR.Test_1920x1080.jpg&pid=hp' }] }, mode = '', method = 'GET', query } = {}) {
      const response = execFileSync('sh', [script], {
        encoding: 'utf8', timeout: 3000,
        env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, REQUEST_METHOD: method,
          QUERY_STRING: query ?? `source=${source}`, TEST_REQUESTS: path.join(dir, 'requests'), TEST_MODE: mode, TEST_BODY: JSON.stringify(body) }
      });
      return { headers: response.split('\r\n\r\n')[0], ...JSON.parse(response.split('\r\n\r\n')[1]) };
    }
  };
}

test('Fixed providers resolve only their own HTTPS images and reuse the URL cache', t => {
  const f = fixture(t);
  assert.equal(f.call().url, 'https://www.bing.com/th?id=OHR.Test_1920x1080.jpg&pid=hp');
  assert.equal(f.call({ mode: 'failure' }).url, 'https://www.bing.com/th?id=OHR.Test_1920x1080.jpg&pid=hp');
  assert.equal(f.requests().length, 1);
  assert.ok(f.requests()[0].endsWith('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1'));
  const url = 'https://w.wallhaven.cc/full/ab/wallhaven-abc123.jpg';
  assert.equal(f.call({ source: 'wallhaven', body: { data: [{ path: url }] } }).url, url);
  assert.ok(f.requests()[1].includes('categories=100&purity=100'));
});

test('Failures cool down, expire and recover without using an expired image', t => {
  const f = fixture(t);
  assert.equal(f.call({ mode: 'failure' }).url, '');
  assert.equal(f.call().url, '');
  assert.equal(f.requests().length, 1);
  const expire = seconds => { const time = new Date(Date.now() - seconds * 1000); utimesSync(path.join(f.cache, 'bing.url'), time, time); };
  expire(121);
  assert.ok(f.call().url);
  expire(43201);
  assert.equal(f.call({ mode: 'failure' }).url, '');
  assert.equal(f.requests().length, 3);
});

test('CGI rejects extra parameters, arbitrary sources, POST and unsafe provider responses', t => {
  const f = fixture(t);
  for (const query of ['source=https://example.com', 'source=bing&url=http://127.0.0.1', 'source=unsplash', ''])
    assert.match(f.call({ query }).headers, /400/);
  assert.match(f.call({ method: 'POST' }).headers, /405/);
  assert.equal(f.requests().length, 0);
  for (const [source, body] of [
    ['bing', { images: [{ url: 'https://example.com/image.jpg' }] }],
    ['bing', { images: [{ url: '/th?id=OHR.Valid.jpg\n"unsafe' }] }],
    ['wallhaven', { data: [{ path: 'https://w.wallhaven.cc.evil/full/ab/wallhaven-abc123.jpg' }] }]
  ]) {
    rmSync(f.cache, { recursive: true, force: true });
    assert.equal(f.call({ source, body }).url, '');
  }
});

test('Concurrent requests use a fallback; stale locks and stalled providers recover', t => {
  const f = fixture(t, '0.2');
  mkdirSync(path.join(f.cache, 'bing.lock'), { recursive: true });
  assert.equal(f.call().url, '');
  assert.equal(f.requests().length, 0);
  const old = new Date(Date.now() - 22000);
  utimesSync(path.join(f.cache, 'bing.lock'), old, old);
  assert.ok(f.call().url);
  rmSync(f.cache, { recursive: true, force: true });
  const start = Date.now();
  assert.equal(f.call({ mode: 'hang' }).url, '');
  assert.ok(Date.now() - start < 2000);
  assert.equal(existsSync(path.join(f.cache, 'bing.lock')), false);
});
