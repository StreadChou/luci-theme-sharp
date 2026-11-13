# 软件包构建

[文档目录](README.md) · [项目首页](../README.md)

Sharp 的开发基线是 OpenWrt 25.12 的 Ucode 版 LuCI。使用与目标固件版本和架构匹配的 OpenWrt SDK 或源码树，并准备好 LuCI feed。浏览器资源构建与路由器软件包编译是两个步骤。

## 准备主题资源

在主题项目根目录执行：

```sh
npm ci
npm run check
```

本步骤需要 Node.js 22+ 和 C 编译器，用于生成 JavaScript、CSS、翻译模板、LMO 语言目录和语言注册脚本。安装及开发环境说明见[开发指南](DEVELOPMENT.md)。

这些生成文件随源码分发。若使用的是已包含完整生成文件且与源码一致的项目副本，SDK 打包本身不需要运行 npm；修改过源码时必须先重新构建。

## 放入 SDK 或源码树

将主题目录复制到 SDK 或源码树的 `package/luci-theme-sharp/`，保留 `Makefile`、`htdocs/`、`ucode/`、`root/`、`po/` 及源码文件。不要复制 `.git/`、`.dev/` 或 `node_modules/`。

按所用 SDK 或源码树的说明准备 feeds，确保可以找到 `luci-base` 和 `feeds/luci/luci.mk`。主题的依赖和打包设置见 [Makefile](../Makefile)。

## 编译

以下命令在 OpenWrt SDK 或源码树根目录执行：

```sh
make menuconfig
```

在 LuCI 的 Themes 分类中选中 `luci-theme-sharp`。使用 `M` 生成可安装的软件包；在完整源码树中使用 `*` 可将主题编入固件。保存后执行：

```sh
make defconfig
make package/luci-theme-sharp/compile V=s
```

安装包输出到 SDK 或源码树的 `bin/packages/` 下，具体文件名和包格式以所用 OpenWrt 构建环境为准。将匹配目标固件的安装包上传到路由器后，按[安装说明](../README.md#安装)操作。

简体中文翻译包含在主题包内，无需另行构建 Sharp 中文语言包。路由器安装和运行主题不需要 Node.js 或 C 编译器。

## 验证范围

`npm run check` 检查前端类型并构建主题资源，不会运行 OpenWrt SDK，也不会生成路由器安装包。只有实际执行上述 SDK 编译并成功生成安装包，才能确认软件包编译通过；安装和真实设备功能需要另外验证。
