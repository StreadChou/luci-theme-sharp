import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { buildAssets, root } from './build.mjs';
import { syncDevSupport } from './dev-support.mjs';

process.chdir(root);
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit', ...options });
const compose = ['compose', '-f', 'dev/compose.yaml'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function prepare() {
  let arch;
  try {
    arch = run('docker', ['info', '--format', '{{.Architecture}}'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], timeout: 15000
    }).trim();
  } catch (error) {
    throw new Error(error.code === 'ENOENT'
      ? '未找到 Docker。请安装 Docker Desktop / Docker Engine 和 Compose 后重试。'
      : '无法连接 Docker 引擎。请在 Docker 恢复可用后重新运行 npm run dev；仍可运行 npm run check 检查和构建项目。');
  }
  const target = ['aarch64', 'arm64'].includes(arch) ? ['arm64', 'armsr/armv8', 'armsr-armv8']
    : ['x86_64', 'amd64'].includes(arch) ? ['amd64', 'x86/64', 'x86-64'] : null;
  if (!target) throw new Error(`Unsupported Docker architecture: ${arch}`);
  const [platform, folder, prefix] = target;
  const directory = path.join(root, '.dev/cache');
  await mkdir(directory, { recursive: true });
  const archive = path.join(directory, `openwrt-${platform}.tar.gz`);
  const base = `https://downloads.openwrt.org/releases/25.12.5/targets/${folder}`;
  const name = `openwrt-25.12.5-${prefix}-rootfs.tar.gz`;
  let expected = await readFile(`${archive}.sha256`, 'utf8').catch(() => '');
  if (!/^[a-f0-9]{64}$/.test(expected)) {
    const manifest = run('curl', ['-fsSL', '--retry', '2', '--connect-timeout', '10', '--max-time', '60', `${base}/sha256sums`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
    expected = manifest.split('\n').find(line => line.endsWith(` *${name}`))?.split(' ')[0];
    if (!expected || !/^[a-f0-9]{64}$/.test(expected)) throw new Error('Official rootfs checksum not found.');
    await writeFile(`${archive}.sha256`, expected);
  }
  const cached = await readFile(archive).catch(() => null);
  if (!cached || digest(cached) !== expected) {
    console.log('首次启动：下载官方 OpenWrt 25.12.5 开发环境…');
    run('curl', ['-fL', '--retry', '2', '--connect-timeout', '10', '--max-time', '180', `${base}/${name}`, '-o', `${archive}.download`]);
    if (digest(await readFile(`${archive}.download`)) !== expected) {
      await rm(`${archive}.download`, { force: true });
      throw new Error('Rootfs checksum mismatch.');
    }
    await rename(`${archive}.download`, archive);
  }
  process.env.SHARP_ROOTFS = path.basename(archive);
}

try {
  await prepare();
  await buildAssets();
  run('docker', [...compose, 'up', '-d', ...(process.argv.includes('--rebuild') ? ['--build'] : [])], { timeout: 900000 });
  syncDevSupport();
  const url = `http://127.0.0.1:${process.env.SHARP_PORT || '8090'}/cgi-bin/luci/`;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      const html = await res.text();
      if (!html.includes('class="sharp-login"') || ![200, 403].includes(res.status)) throw new Error(`HTTP ${res.status}`);
      break;
    } catch (error) {
      if (attempt >= 20) throw new Error(`Sharp 未正常启动：${error.message}。运行 npm run dev:logs 查看原因。`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  console.log(`\nSharp 已启动：${url}\n账号：root\n密码：sharp-dev\n`);
  if (!process.argv.includes('--detach')) {
    const contexts = await buildAssets(true, syncDevSupport);
    console.log('正在监听 CSS / TypeScript / 翻译目录。修改后刷新浏览器。Ctrl+C 结束监听；npm run dev:stop 停止容器。');
    process.on('SIGINT', async () => { await Promise.all(contexts.map(ctx => ctx.dispose())); process.exit(0); });
  }
} catch (error) {
  console.error(error.code === 'ETIMEDOUT'
    ? '开发环境启动超时。请检查 Docker 引擎与下载网络，恢复后重试；容器日志可通过 npm run dev:logs 查看。'
    : error.message);
  process.exitCode = 1;
}
