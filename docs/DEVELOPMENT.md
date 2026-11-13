# 开发指南

[文档目录](README.md) · [项目首页](../README.md)

Sharp 使用 Ucode 模板、原生 CSS 和 TypeScript，资源由 esbuild 构建。开发前请阅读 [AGENTS.md](../AGENTS.md)，了解界面约定、LuCI 适配限制和验证要求。

## 本地启动

需要 Node.js 22 或更高版本、C 编译器、curl，以及正在运行的 Docker Desktop / Docker Engine 和 Compose 插件。C 编译器只用于首次构建本地翻译工具（macOS 的 Xcode Command Line Tools 提供 `cc`；Linux 可使用 GCC/Clang），路由器不需要这些开发工具。

先进入项目根目录，检查是否已有运行中的 Sharp 服务，再启动开发流程：

```sh
cd luci-theme-sharp
docker compose -f dev/compose.yaml ps
npm ci
npm run dev
```

打开 **http://127.0.0.1:8090/cgi-bin/luci/**：

- 用户名：`root`
- 密码：`sharp-dev`

这是本地开发容器的账号，与真实路由器无关。服务仅绑定本机 `127.0.0.1`。

第一次启动会下载官方 OpenWrt 25.12.5 rootfs、核对 SHA256 并安装 LuCI，耗时取决于网络。支持 Docker 的 ARM64 和 AMD64 架构，下载缓存在 `.dev/cache/`。每次普通启动保留现有容器配置；重建或删除容器会丢失容器内的临时配置。

`npm run dev` 会监听 CSS、TypeScript 和翻译文件；保存文件后刷新浏览器即可看到效果。`.ut` 模板直接挂载到容器，同样在保存后刷新查看。主题的菜单定义和语言目录会同步到当前容器。`Ctrl+C` 结束监听，容器继续运行；用 `npm run dev:stop` 停止容器。

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动独立 LuCI 环境并监听源码 |
| `npm run dev:up` | 启动环境，不持续监听 |
| `npm run dev:sync` | 将已构建的语言文件和菜单同步到运行中的容器 |
| `npm run dev:stop` | 停止本项目的容器 |
| `npm run dev:logs` | 查看容器启动日志 |
| `npm run dev:rebuild` | 修改 Dockerfile 后重新构建开发镜像 |
| `npm run check` | TypeScript 类型检查及资源、翻译构建 |
| `npm run build` | 生成可部署的 JavaScript、CSS 和语言目录 |
| `npm run i18n` | 提取翻译模板并编译项目语言目录 |

若 8090 端口被占用，可用 `SHARP_PORT=8091 npm run dev` 指定其他端口。若 Docker 命令报引擎连接错误，先确认 Docker Desktop 已启动且引擎可用。

## 源码结构

使用 `.ut`、原生 CSS 和 TypeScript，没有 Vue 和 LESS 的编译依赖。TypeScript 通过 esbuild 输出浏览器 JavaScript；路由器不需要 Node.js。

```text
ucode/template/themes/sharp/
  head.ut       文档头、资源、首次绘制前的配色选择
  header.ut     顶部导航、搜索、右侧操作、内容容器
  footer.ut     页脚和交互脚本
  sysauth.ut    登录页
  settings.ut   Sharp 主题设置空白页
frontend/
  styles/
    tokens.css  亮暗配色变量
    shell.css   主题布局、导航和登录页
    luci.css    LuCI 原生表单、表格、弹窗等基础样式
  ts/
    navigation.ts  菜单、用户入口、原生页面子导航
    search.ts      菜单搜索和键盘操作
    dialogs.ts     搜索、手机导航和设置弹窗的焦点及关闭行为
    appearance.ts  浅色、深色、跟随系统
    i18n.ts        LuCI 翻译及数量文本接口
    layout.ts      页面标题、面包屑、标签栏及动态表格的布局适配
    main.ts        初始化、刷新、未应用配置提醒
htdocs/luci-static/sharp/  构建输出和 Logo
root/etc/uci-defaults/     注册并选择 Sharp 的安装脚本
root/usr/share/luci/menu.d/  系统菜单中的 Sharp 设置入口
po/                       语言注册表、中文翻译及英文翻译模板
root/usr/lib/lua/luci/i18n/  生成的 Sharp LMO 语言文件
dev/                      独立开发容器
scripts/                  构建和启动脚本
docs/                     开发、构建和多语言文档
Makefile                  OpenWrt 软件包定义
```

改颜色从 `tokens.css` 开始，改布局从 `shell.css` 和 `header.ut` 开始，改导航交互从 `navigation.ts` 开始。不要直接改生成的 `sharp.js` / `sharp.css`；构建会覆盖它们。生成文件随主题源码分发，让 OpenWrt 打包过程无需下载 npm 依赖。

## 修改与同步

| 修改内容 | 预览方式 |
| --- | --- |
| Ucode `.ut` 模板 | 已直接挂载到容器，保存后刷新浏览器 |
| CSS、TypeScript | 运行 `npm run build` 后刷新；`npm run dev` 会自动监听并构建 |
| 翻译、语言注册、菜单 JSON | 构建后运行 `npm run dev:sync`；`npm run dev` 会处理构建和同步 |
| 开发镜像定义 | 确需更新镜像时运行 `npm run dev:rebuild` |

没有自动刷新浏览器的保证。普通主题修改应复用当前容器，保留其中的语言和 UCI 配置；不要为样式修改重建容器。

生成的 JavaScript、CSS、POT、LMO 和语言注册脚本随源码分发。修改后通过构建脚本更新，保持生成文件与源码一致。`.dev/` 存放下载缓存、编译工具和临时验证材料，`node_modules/` 存放本地依赖，两者均不纳入版本控制。

## LuCI 页面适配

页面主体由 LuCI 和插件生成，主题负责外框、导航与样式。保留原生节点、事件、字段标识、轮询及保存、应用、撤销流程。

- 原生标签与后面的内容面板组保持相邻；适配异步加载和重新渲染。
- 允许 flex / grid 子元素收窄，使用 `min-width: 0` 和局部滚动处理长内容，避免通过全局隐藏横向溢出截掉内容。
- 表格保留原节点，只增加 `.sharp-table-scroll` 滚动外层；自行管理滚动的表格可以设置 `data-sharp-scroll="off"`。
- 新增样式使用现有变量，兼顾浅色、深色、触控尺寸和键盘焦点。

完整约定见 [AGENTS.md](../AGENTS.md)。

## 检查与验证

源码修改后，在项目根目录运行：

```sh
npm run check
```

这会执行 TypeScript 类型检查，构建 JavaScript、CSS 和语言目录。Docker 不可用时仍可执行此检查。

界面或交互修改还需要在真实 Sharp 开发服务上刷新验证，覆盖受影响的桌面、手机页面及亮暗配色。通用溢出修改可用 320px、390px 检查窄屏，响应式行为按需检查 900px 断点两侧。纯文档修改只需核对内容、命令与链接。

容器可能缺少无线、交换机或某些 UCI 配置。应区分环境错误和主题错误，保留真实错误提示，不为外观验证修改网络配置或执行重启、刷机等操作。无线硬件、实际路由配置和固件操作仍需在对应设备上验证。

报告检查结果时区分资源构建、浏览器验证和 OpenWrt 软件包编译。资源构建通过不代表 SDK 打包或真实路由器操作已通过。

## 相关文档

- [软件包构建](BUILD.md)：在 OpenWrt SDK 或源码树中生成安装包。
- [多语言](I18N.md)：主题文案、新增语言与翻译产物。
