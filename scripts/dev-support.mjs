import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const compose = ['compose', '-f', 'dev/compose.yaml'];
const run = args => execFileSync('docker', [...compose, ...args], { cwd: root, stdio: 'pipe', timeout: 15000 });

/** Update files outside the existing theme mounts without recreating the container. */
export function syncDevSupport() {
  run(['exec', '-T', 'luci', 'mkdir', '-p', '/usr/lib/lua/luci/i18n', '/usr/share/luci/menu.d']);
  run(['cp', 'root/usr/lib/lua/luci/i18n/.', 'luci:/usr/lib/lua/luci/i18n/']);
  run(['cp', 'root/usr/share/luci/menu.d/luci-theme-sharp.json', 'luci:/usr/share/luci/menu.d/luci-theme-sharp.json']);
  run(['cp', 'root/etc/uci-defaults/31_luci-theme-sharp-languages', 'luci:/tmp/sharp-register-languages']);
  run(['exec', '-T', 'luci', 'sh', '-c', 'sh /tmp/sharp-register-languages && rm -f /tmp/sharp-register-languages /tmp/luci-indexcache.*']);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncDevSupport();
  console.log('Sharp menus and translations synced to the running development container.');
}
