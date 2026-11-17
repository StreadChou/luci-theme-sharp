#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
sdk="$project_root/.dev/release-sdk"
artifacts="$project_root/.dev/release-artifacts"
cache="$project_root/.dev/cache/openwrt-sdk"

: "${SHARP_SDK_FILE:?SDK filename is required}"
: "${SHARP_SDK_URL:?SDK base URL is required}"
: "${SHARP_SDK_SHA256:?SDK checksum is required}"
: "${SHARP_APK_VERSION:?Package version is required}"
: "${SHARP_PACKAGE_RELEASE:?Package revision is required}"

if [ -e "$sdk" ] || [ -e "$artifacts" ]; then
  echo 'Use a fresh checkout, or move .dev/release-sdk and .dev/release-artifacts before building.' >&2
  exit 1
fi
mkdir -p "$cache" "$sdk" "$artifacts"
archive="$cache/$SHARP_SDK_FILE"
if [ ! -f "$archive" ]; then
  trap 'rm -f "$archive.part"' EXIT
  curl --http1.1 -fL --retry 5 --retry-all-errors --connect-timeout 30 --max-time 1800 \
    "$SHARP_SDK_URL/$SHARP_SDK_FILE" -o "$archive.part"
  printf '%s  %s\n' "$SHARP_SDK_SHA256" "$archive.part" | sha256sum --check -
  mv "$archive.part" "$archive"
fi
printf '%s  %s\n' "$SHARP_SDK_SHA256" "$archive" | sha256sum --check -
tar --zstd -xf "$archive" -C "$sdk" --strip-components=1

cd "$sdk"
cp feeds.conf.default feeds.conf
./scripts/feeds update -a
./scripts/feeds install -a
mkdir -p package/luci-theme-sharp
rsync -a "$project_root/Makefile" "$project_root/LICENSE" \
  "$project_root/htdocs" "$project_root/ucode" "$project_root/root" "$project_root/po" \
  package/luci-theme-sharp/
sed -i -E "s/^PKG_VERSION:=.*/PKG_VERSION:=$SHARP_APK_VERSION/" package/luci-theme-sharp/Makefile

cat > .config <<'EOF'
CONFIG_ALL_NONSHARED=n
CONFIG_ALL_KMODS=n
CONFIG_ALL=n
CONFIG_AUTOREMOVE=n
CONFIG_PACKAGE_luci-theme-sharp=m
EOF
make defconfig
grep -Fxq 'CONFIG_PACKAGE_luci-theme-sharp=m' .config
make package/luci-theme-sharp/compile -j"$(nproc)" V=s

mapfile -t packages < <(find bin/packages -type f -name 'luci-theme-sharp-*.apk')
if [ "${#packages[@]}" -ne 1 ]; then
  echo "Expected one Sharp APK, found ${#packages[@]}." >&2
  exit 1
fi
package="${packages[0]}"
expected="luci-theme-sharp-$SHARP_APK_VERSION-r$SHARP_PACKAGE_RELEASE.apk"
if [ "$(basename "$package")" != "$expected" ]; then
  echo "Unexpected package filename: $package (expected $expected)." >&2
  exit 1
fi

# Inspect the actual APK, including its architecture and bundled translations.
staging_dir/host/bin/apk adbdump "$package" > "$artifacts/package-metadata.txt"
grep -Eq '^[[:space:]]*name: luci-theme-sharp$' "$artifacts/package-metadata.txt"
grep -Fxq "  version: $SHARP_APK_VERSION-r$SHARP_PACKAGE_RELEASE" "$artifacts/package-metadata.txt"
grep -Eq '^[[:space:]]*arch: (all|noarch)$' "$artifacts/package-metadata.txt"
require_package_file() {
  awk -v directory="$1" -v filename="$2" -v required_mode="${3:-}" '
    /^  - / { in_directory = ($0 == "  - name: " directory); in_file = 0 }
    in_directory && /^      - name: / {
      in_file = ($0 == "      - name: " filename)
      if (in_file && required_mode == "") found = 1
    }
    in_file && $0 == "          mode: " required_mode { found = 1 }
    END { exit !found }
  ' "$artifacts/package-metadata.txt" || {
    echo "Missing package file or incorrect permissions: $1/$2 ${3:-}" >&2
    return 1
  }
}
while read -r directory filename required_mode; do
  require_package_file "$directory" "$filename" "$required_mode"
done <<'EOF'
etc/uci-defaults 30_luci-theme-sharp 0755
etc/uci-defaults 31_luci-theme-sharp-languages
lib/upgrade/keep.d luci-theme-sharp
usr/lib/lua/luci/i18n sharp.zh-cn.lmo
usr/share/luci/menu.d luci-theme-sharp.json
usr/share/rpcd/acl.d luci-theme-sharp.json
usr/share/ucode/luci/template/themes/sharp header.ut
usr/share/ucode/luci/template/themes/sharp brand.ut
usr/share/ucode/luci/template/themes/sharp sysauth.ut
usr/share/ucode/luci/template/themes/sharp settings-main.ut
www/cgi-bin sharp-wallpaper 0755
www/luci-static/resources/sharp branding.js
www/luci-static/resources/sharp login.js
www/luci-static/resources/view/sharp basic.js
www/luci-static/resources/view/sharp login.js
www/luci-static/sharp sharp.js
www/luci-static/sharp sharp.css
www/luci-static/sharp login-background.svg
EOF
for dependency in luci-base wget-ssl ca-bundle jsonfilter; do
  grep -Eq "^    - $dependency([<=>~].*)?$" "$artifacts/package-metadata.txt"
done
cp "$package" "$artifacts/"
cd "$artifacts"
sha256sum ./*.apk > SHA256SUMS
