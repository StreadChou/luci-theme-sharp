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
| `npm run dev:sync` | 将原生视图、菜单、权限和已构建的语言文件同步到运行中的容器 |
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
  brand.ut      登录页与页头共用的 Logo、文本及默认回退
  settings-main.ut  主界面的桌面端、手机端布局单选卡片
frontend/
  styles/
    tokens.css  亮暗配色变量
    shell.css   主题布局、导航和登录页
    sidebar.css 类argon 桌面双层侧栏和内容容器
    luci.css    LuCI 原生表单、表格、弹窗等基础样式
    settings.css  Sharp 布局选择卡片和 SVG 示意图的样式
    motion.css  控件、弹窗、配色及标签的过渡样式
  ts/
    navigation.ts  菜单、用户入口、原生页面子导航
    sidebar.ts     根据 LuCI 菜单生成双层侧栏及键盘导航
    desktop-layout.ts  桌面布局切换与浏览器偏好同步
    search.ts      菜单搜索和键盘操作
    dialogs.ts     搜索、手机导航和设置弹窗的焦点及关闭行为
    motion.ts      可中断的进出场动画、分组展开及减少动态效果支持
    appearance.ts  浅色、深色、跟随系统
    login.ts       登录密码显示切换及离开页面时恢复掩码
    i18n.ts        LuCI 翻译及数量文本接口
    layout.ts      页面标题、面包屑、标签栏及动态表格的布局适配
    main.ts        初始化、LuCI 自动刷新／暂停、未应用配置提醒
    pending.ts     配置变更计数、自动提醒、关闭及原生配置弹窗入口
htdocs/luci-static/sharp/  构建输出、Logo 和内置 login-background.svg 壁纸
htdocs/luci-static/resources/view/sharp/basic.js  基础设置原生 LuCI 表单
htdocs/luci-static/resources/sharp/branding.js    图片路径校验、Logo／背景上传转换
htdocs/luci-static/resources/view/sharp/login.js  登录外观原生 LuCI 表单和预览
htdocs/luci-static/resources/sharp/login.js       登录外观默认值与数值回退
root/www/cgi-bin/sharp-wallpaper  登录页在线壁纸地址解析（固定来源）
root/etc/uci-defaults/     注册并选择 Sharp 的安装脚本
root/usr/share/luci/menu.d/  Sharp 设置入口及基础设置、登陆界面、主界面子路由
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
| 原生 LuCI JS、翻译、语言注册、菜单 JSON、ACL | 构建后运行 `npm run dev:sync`；`npm run dev` 会处理构建和同步 |
| 开发镜像定义 | 确需更新镜像时运行 `npm run dev:rebuild` |

没有自动刷新浏览器的保证。普通主题修改应复用当前容器，保留其中的语言和 UCI 配置；不要为样式修改重建容器。

生成的 JavaScript、CSS、POT、LMO 和语言注册脚本随源码分发。修改后通过构建脚本更新，保持生成文件与源码一致。`.dev/` 存放下载缓存、编译工具和临时验证材料，`node_modules/` 存放本地依赖，两者均不纳入版本控制。

## LuCI 页面适配

页面主体由 LuCI 和插件生成，主题负责外框、导航与样式。保留原生节点、事件、字段标识、轮询及保存、应用、撤销流程。

- 顶栏自动刷新按钮代理原生 `[data-indicator="poll-status"]` 的点击事件；监听指示器的插入、移除、文字及 `data-style` 变化，同步刷新／暂停图标和提示。原生指示器不存在时隐藏按钮。保留原节点和 LuCI 轮询机制，不整页刷新或建立第二套计时器；未应用配置入口独立保留。
- 配置提醒监听同一组原生指示器变化，只有数量变化且非零时自动出现；同一页面内关闭后不因重复同步而重现。`bindPopover()` 的 `toggleTrigger: false` 允许程序打开提醒，同时保留计数按钮直接打开原生配置弹窗的点击行为。提醒不抢焦点；保存进度或主题弹窗尚未关闭时，等待关闭后再显示。验证时覆盖数量增减、归零、重复同步、X/Escape 关闭、弹窗互斥和手机窄屏。
- 原生标签与后面的内容面板组保持相邻；适配异步加载和重新渲染。
- 允许 flex / grid 子元素收窄，使用 `min-width: 0` 和局部滚动处理长内容，避免通过全局隐藏横向溢出截掉内容。
- 表格保留原节点，只增加 `.sharp-table-scroll` 滚动外层；自行管理滚动的表格可以设置 `data-sharp-scroll="off"`。
- 新增样式使用现有变量，兼顾浅色、深色、触控尺寸和键盘焦点。

完整约定见 [AGENTS.md](../AGENTS.md)。

## 桌面布局

主界面设置提供 `default`（顶部导航）和 `argon`（双层侧栏）两种桌面布局。`head.ut` 在加载样式前读取 `sharp:desktop-layout` 并设置根节点的 `data-sharp-desktop-layout`；`desktop-layout.ts` 负责单选卡片、跨标签页同步和从浏览器历史恢复时的偏好同步。选择立即生效，只保存在当前浏览器，不写 UCI，也不计入原生表单未保存状态。类argon布局把三级页面标签放在 Header 下方的全宽标签带中，并隐藏右侧面包屑；默认布局保留面包屑与标签同行的布局。

两种桌面导航和手机抽屉均使用同一份 LuCI 菜单树。侧栏一级分类支持上下方向键、Home/End，向右进入二级链接，向左或 Escape 返回分类按钮。未知分类使用通用图标；具体业务菜单、权限和路由不硬编码。侧栏由独立外框承载，原生内容节点不搬移或克隆；宽度不超过 900px 时隐藏侧栏并沿用手机导航。

修改布局时验证即时切换、刷新及页面跳转、浏览器历史、900px 断点两侧、侧栏键盘操作和亮暗配色，并确认原生标签、表单和页面局部滚动正常。

## 交互动效

动效参数集中在 `frontend/styles/tokens.css`：控件反馈默认 120ms，弹层进入 180ms、退出 120ms；手机抽屉和导航分组在 `motion.css` 中使用略长的时长。位置动画使用独立的 `translate` 属性，保留下拉框原有的定位变换与 Header 下方 4px 间距。

`motion.ts` 统一管理动画中断和清理。快速反向操作从当前画面继续，不累计定时器；原生 LuCI 弹窗接管及窗口跨越手机断点时立即关闭主题弹层。原生标签只对当前内容淡入，不改变节点或面板关系，也不延迟导航和业务操作。

系统开启“减少动态效果”后跳过进出场和展开动画，并立即完成在途动画的清理。修改动效时验证连续开关、Escape、键盘导航、焦点恢复、遮罩关闭及窗口缩放；不要对所有元素添加 `transition: all`。

## 检查与验证

源码修改后，在项目根目录运行：

```sh
npm run check
```

这会执行 TypeScript 类型检查、`npm test` 回归检查，构建 JavaScript、CSS 和语言目录。Docker 不可用时仍可执行此检查。

基础设置通过原生 `form.Map('luci')` 仅修改 `luci.sharp.brand_logo`、`luci.sharp.brand_text`，保留 LuCI 保存、应用、撤销和权限控制。上传复用认证的 `cgi-upload`，先在浏览器将图片转换为最大 512 像素的 PNG，再写入 `/www/luci-static/sharp-custom/logo-*.png`；每次使用新文件名，上传本身不会替换当前使用的 Logo。该目录与只读主题挂载分离，升级备份通过 `root/lib/upgrade/keep.d/luci-theme-sharp` 保留。ACL 只增加对应上传文件的写权限。原生视图文案与 TypeScript、Ucode 模板一起提取翻译；修改原生 JS 后执行 `dev:sync` 并刷新；持续运行的 `npm run dev` 会随翻译输入变化自动同步。`dev:sync` 在原生 JS 变化时更新开发容器的软件包数据库时间戳，以刷新 LuCI 模块缓存标识，不改变包元数据内容；首次接入 ACL 时按需重载 rpcd。

界面或交互修改还需要在真实 Sharp 开发服务上刷新验证，覆盖受影响的桌面、手机页面及亮暗配色。通用溢出修改可用 320px、390px 检查窄屏，响应式行为按需检查 900px 断点两侧。纯文档修改只需核对内容、命令与链接。

容器可能缺少无线、交换机或某些 UCI 配置。应区分环境错误和主题错误，保留真实错误提示，不为外观验证修改网络配置或执行重启、刷机等操作。无线硬件、实际路由配置和固件操作仍需在对应设备上验证。

报告检查结果时区分资源构建、浏览器验证和 OpenWrt 软件包编译。资源构建通过不代表 SDK 打包或真实路由器操作已通过。

## 相关文档

- [软件包构建](BUILD.md)：在 OpenWrt SDK 或源码树中生成安装包。
- [多语言](I18N.md)：主题文案、新增语言与翻译产物。

## 登录页外观配置

登录页配置复用 `luci` 的 `sharp` section，不读取或写入 Argon 配置。实现参考 Argon 的登录布局、图片背景和玻璃面板设置概念，未复制其模板、样式或后端。参考源码为 [jerrykuku/luci-theme-argon](https://github.com/jerrykuku/luci-theme-argon/tree/a121960d2adbe9d57333db3f4e045467dcb375c9)，设置入口为 `htdocs/luci-static/resources/view/argon-config.js`。

| UCI 字段 | 取值／缺省 |
| --- | --- |
| `login_layout` | `centered`（缺省）／`sidebar` |
| `login_background` | `default`（缺省，内置壁纸）／`plain`（原纯色外观）／`bing`／`wallhaven`／`image` |
| `login_background_image` | 本机公开图片路径，缺省为空 |
| `login_background_fit` | `cover`（缺省）／`contain` |
| `login_background_dim` | 0～80 的整数，缺省 20 |
| `login_panel_opacity` | 0～100 的整数，缺省 100 |
| `login_panel_blur` | 0～30 的整数，缺省 0 |

`sysauth.ut` 在登录前读取已提交的 UCI 值，枚举及数值采用白名单和范围校验；路径使用与品牌 Logo 相同的校验，并检查文件是否存在。图片通过独立 `img` 显示，不拼接用户提供的 CSS；内置 SVG 壁纸始终作为底图，客户端预加载在线图片，成功后替换，损坏或超时仍显示内置壁纸。`plain` 显式保留原纯色外观。面板颜色跟随现有外观变量，登录页脚本按产物时间戳和大小携带缓存版本。保留原生登录 POST、认证插件字段、资源和错误消息。

居中卡片和侧栏共用品牌区、欢迎标题、设备名、带图标的输入框及主按钮，样式限定在登录容器和 `#sharp-login-form` 内。`frontend/ts/login.ts` 只切换原密码输入框的 `type`，同步「显示密码／隐藏密码」标签，在 `pagehide` 时恢复掩码；没有 JavaScript 时隐藏切换按钮，原生表单仍可提交。设置页微缩预览同步面板结构和配色，认证插件字段及 HTML 继续在原生表单中输出。

背景上传通过认证的 `cgi-upload` 写入新的 `background-*.jpg`，文件权限为 0644；ACL 只增加这一文件模式的写权限。浏览器先校验大小、解码尺寸并转为静态 JPEG，不覆盖当前图片；图片目录沿用系统备份条目。原生保存、应用和撤销仅修改本页字段，隐藏选项保留，恢复默认仅修改表单，仍需保存并应用；通过原生保存回调重置被依赖条件隐藏的背景字段，普通切换背景仍保留这些字段。

验证登录外观时覆盖布局、内置／纯色／在线／自定义背景、来源切换与失败回退、浅深色、手机／短屏、数值和路径校验，以及保存、应用、撤销和真实登录。不要为了测试去清除其他页面的待应用配置。

在线来源参考 Argon 的 `login_background.ut` 和 `luci.argon_wallpaper`，实现独立维护。`GET /cgi-bin/sharp-wallpaper?source=bing|wallhaven` 只解析这两个固定服务的图片地址，不接受任意 URL、额外参数或 POST，不修改 UCI。接口在登录前可访问，用于异步背景和已登录的设置预览；认证页面渲染不调用外网。必应查询每日图片；Wallhaven 仅查询风景、general 分类及 SFW 图片。返回值仅允许各自图片域名的 HTTPS URL。图片由浏览器加载，不发送 Referer，不需要 API 密钥。

解析器优先使用 `/usr/libexec/wget-ssl`，源码部署可回退到支持 TLS 的 `uclient-fetch`；安装包新增 `wget-ssl`、`ca-bundle`、`jsonfilter` 依赖。每次服务端请求总时限 6 秒、响应文件最大 512 KiB；同源请求合并，成功地址缓存 12 小时，失败缓存 120 秒，锁超过 20 秒可恢复。缓存位于 `/var/run/sharp-wallpaper/`，不写闪存，也不加入备份。浏览器解析请求限时 8 秒、图片预加载限时 10 秒；切换来源或离开页面取消旧请求，设置数值变化不重复请求在线来源。默认与自定义图片保持离线可用，在线服务可用性不作为登录前提。
