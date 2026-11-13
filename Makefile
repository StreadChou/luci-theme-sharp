include $(TOPDIR)/rules.mk

LUCI_TITLE:=Sharp LuCI Theme
LUCI_DEPENDS:=+luci-base
LUCI_URL:=https://github.com/StreadChou/luci-theme-sharp
PKG_VERSION:=0.1.0
PKG_RELEASE:=2
PKG_LICENSE:=MIT

# Assets are already bundled; keep modern CSS and JavaScript intact.
LUCI_MINIFY_JS:=0
LUCI_MINIFY_CSS:=0

# All Sharp catalogs are bundled in root/ by npm run build. Avoid generating
# separate language packages which would own the same installed LMO files.
override LUCI_LANGUAGES :=

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
