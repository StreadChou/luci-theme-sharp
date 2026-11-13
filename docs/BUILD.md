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

## GitHub Actions 与版本发布

项目仓库为 [StreadChou/luci-theme-sharp](https://github.com/StreadChou/luci-theme-sharp)。工作流分为两部分：

- [Check theme](../.github/workflows/check.yml)：推送到 `main` 或创建、更新 PR 时执行 `npm ci`、`npm run check`，检查生成文件是否已提交，并核对各处版本号。
- [Release packages](../.github/workflows/release.yml)：推送 `v*` 标签时，先执行上述检查，再用官方 OpenWrt **25.12.5 x86/64 SDK** 编译架构无关的 APK，验证包版本、架构和关键资源，生成 SHA256 校验文件并发布 GitHub Release。

SDK 下载文件使用工作流内固定的 SHA256 校验，缓存仅用于减少重复下载。SDK 的默认 feeds 配置决定依赖来源。Actions 固定到具体提交，升级时应同时核对版本及来源。

在 Actions 页面手动运行 `Release packages` 并选择 `main`，只构建和上传 Actions artifact，不创建 Release。正式发布使用标签推送；不通过另一个工作流用默认 `GITHUB_TOKEN` 推送标签来串联发布。

### 发布步骤

1. 更新 `package.json`、`package-lock.json` 中的版本以及 `Makefile` 的 `PKG_VERSION`，三处必须一致。`PKG_RELEASE` 为正整数软件包修订号；首次发布沿用现有 `0.1.0-r2`。
2. 新增 `docs/releases/v<版本>.md`，写明项目变化、适用环境、安装步骤和验证范围。首次发布介绍见 [v0.1.0](releases/v0.1.0.md)。
3. 运行 `npm run check`，将源码、生成产物和发布说明一起提交并推送。
4. 创建带说明的标签，并用维护者自己的 GitHub 凭据推送。例如，准备好 `0.2.0` 版本后执行：

   ```sh
   git tag -a v0.2.0 -F docs/releases/v0.2.0.md
   git push origin v0.2.0
   ```

5. 等待 `Release packages` 的检查、打包和发布任务全部成功，检查 Release 附件中存在主题 APK、`SHA256SUMS` 和 `package-metadata.txt`。

支持 `v0.2.0-beta.1` 形式的 `alpha`、`beta`、`rc` 预发布标签。此时源码版本填写 `0.2.0-beta.1`，打包脚本自动转成 APK 的 `0.2.0_beta1`；GitHub Release 会标记为 Pre-release。标签与源码版本不匹配、缺少发布说明、生成文件未更新或包内容不完整时，发布会失败。

首次发布完成后不要移动已经发布的标签；修复后递增版本、提交并创建新标签。因下载等临时故障失败时，可以在 Actions 中重跑失败任务；已存在的 Release 不会被脚本覆盖。

工作流构建目录为 `.dev/release-sdk/`，产物目录为 `.dev/release-artifacts/`，SDK 缓存位于 `.dev/cache/openwrt-sdk/`，均不提交到 Git。Linux 本地复现时可参照工作流设置 `SHARP_SDK_*`、`SHARP_APK_VERSION` 和 `SHARP_PACKAGE_RELEASE` 后运行 `bash .github/scripts/build-package.sh`；构建脚本要求 SDK 和产物目录尚不存在，避免混入旧包。

## 验证范围

`npm run check` 检查前端类型并构建主题资源，不会运行 OpenWrt SDK，也不会生成路由器安装包。只有实际执行上述 SDK 编译并成功生成安装包，才能确认软件包编译通过；安装和真实设备功能需要另外验证。
