import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const compose = ['compose', '-f', 'dev/compose.yaml'];
const run = args => execFileSync('docker', [...compose, ...args], { cwd: root, stdio: 'pipe', timeout: 15000 });

/** Update files outside the existing theme mounts without recreating the container. */
export function syncDevSupport() {
  run(['exec', '-T', 'luci', 'mkdir', '-p', '/usr/lib/lua/luci/i18n', '/usr/share/luci/menu.d', '/usr/share/rpcd/acl.d', '/www/luci-static/sharp-custom', '/www/luci-static/resources/sharp', '/www/luci-static/resources/view/sharp', '/lib/upgrade/keep.d']);
  run(['cp', 'htdocs/luci-static/resources/sharp/branding.js', 'luci:/tmp/sharp-branding.js']);
  run(['cp', 'htdocs/luci-static/resources/view/sharp/basic.js', 'luci:/tmp/sharp-basic.js']);
  run(['cp', 'htdocs/luci-static/resources/sharp/login.js', 'luci:/tmp/sharp-login-settings.js']);
  run(['cp', 'htdocs/luci-static/resources/view/sharp/login.js', 'luci:/tmp/sharp-login-view.js']);
  run(['cp', 'root/www/cgi-bin/sharp-wallpaper', 'luci:/www/cgi-bin/sharp-wallpaper']);
  run(['exec', '-T', 'luci', 'chmod', '+x', '/www/cgi-bin/sharp-wallpaper']);
  // Native LuCI modules use the package database timestamp for cache versions.
  run(['exec', '-T', 'luci', 'sh', '-c', `
    changed=0
    for entry in 'sharp-branding.js sharp/branding.js' 'sharp-basic.js view/sharp/basic.js' 'sharp-login-settings.js sharp/login.js' 'sharp-login-view.js view/sharp/login.js'; do
      set -- $entry
      if ! cmp -s /tmp/$1 /www/luci-static/resources/$2; then
        cp /tmp/$1 /www/luci-static/resources/$2 || exit 1
        changed=1
      fi
      rm -f /tmp/$1
    done
    if [ "$changed" = 1 ]; then
      if [ -f /lib/apk/db/installed ]; then touch /lib/apk/db/installed;
      elif [ -f /usr/lib/opkg/status ]; then touch /usr/lib/opkg/status; fi
    fi
  `]);
  run(['cp', 'root/lib/upgrade/keep.d/luci-theme-sharp', 'luci:/lib/upgrade/keep.d/luci-theme-sharp']);
  run(['cp', 'root/usr/lib/lua/luci/i18n/.', 'luci:/usr/lib/lua/luci/i18n/']);
  run(['cp', 'root/usr/share/luci/menu.d/luci-theme-sharp.json', 'luci:/usr/share/luci/menu.d/luci-theme-sharp.json']);
  run(['cp', 'root/usr/share/rpcd/acl.d/luci-theme-sharp.json', 'luci:/tmp/sharp-acl.json']);
  run(['exec', '-T', 'luci', 'sh', '-c', 'if ! cmp -s /tmp/sharp-acl.json /usr/share/rpcd/acl.d/luci-theme-sharp.json; then cp /tmp/sharp-acl.json /usr/share/rpcd/acl.d/luci-theme-sharp.json && killall -HUP rpcd; fi; rm -f /tmp/sharp-acl.json']);
  run(['cp', 'root/etc/uci-defaults/31_luci-theme-sharp-languages', 'luci:/tmp/sharp-register-languages']);
  run(['exec', '-T', 'luci', 'sh', '-c', 'sh /tmp/sharp-register-languages && rm -f /tmp/sharp-register-languages /tmp/luci-indexcache.*']);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncDevSupport();
  console.log('Sharp views, menus, ACLs and translations synced to the running development container.');
}
