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
for required in sharp.js sharp.css header.ut sharp.zh-cn.lmo 31_luci-theme-sharp-languages; do
  grep -Fq "name: $required" "$artifacts/package-metadata.txt"
done
cp "$package" "$artifacts/"
cd "$artifacts"
sha256sum ./*.apk > SHA256SUMS
