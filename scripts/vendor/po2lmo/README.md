# LuCI PO to LMO build tool

Source: OpenWrt LuCI, `openwrt-25.12`, `modules/luci-base/src/`.

- `po2lmo.c` and `lib/lmo.h` are unmodified upstream files.
- `lib/hash.c` contains the original `sfh_hash()` from `lib/lmo.c`. Sharp omits the runtime catalog reader and plural-expression parser, which the converter does not call. The include of `plural_formula.h` is replaced by a comment documenting this adaptation.

Upstream sources:

- https://github.com/openwrt/luci/blob/openwrt-25.12/modules/luci-base/src/po2lmo.c
- https://github.com/openwrt/luci/blob/openwrt-25.12/modules/luci-base/src/lib/lmo.h
- https://github.com/openwrt/luci/blob/openwrt-25.12/modules/luci-base/src/lib/lmo.c

Copyright (C) 2009–2012 Jo-Philipp Wich. Hash function copyright (C) 2004–2008 Paul Hsieh. Distributed under the Apache License 2.0, included in `LICENSE` and in the source headers.

This tool is compiled on the development computer and cached under `.dev/tools/`. It is not installed on the router. Generated `.lmo` catalogs are bundled with the theme, so OpenWrt package builds do not need Node.js or this host compiler.
