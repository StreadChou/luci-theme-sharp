# Sharp 开发指引

本文件适用于整个 `luci-theme-sharp` 项目，供新会话中的 AI 开发者直接接手。先阅读本文件、[README.md](README.md) 和 [docs/README.md](docs/README.md)，再查看任务涉及的源码；不需要依赖创建项目时的聊天记录。下述设计约定是当前已确定的行为，后续用户明确调整需求时，同步更新实现和相关文档。

## 项目定位

- Sharp 是独立开发的 OpenWrt LuCI 主题，负责页面外框、导航、交互和原生内容的样式适配。
- 技术栈：Ucode `.ut` 模板、原生 CSS、TypeScript；使用 esbuild 构建。当前没有 Vue、LESS 或独立 SPA 路由，优先延续现有结构。
- 开发基线是 OpenWrt 25.12 的 Ucode 版 LuCI，不是旧版 Lua `.htm` 主题。精确的开发镜像版本以 `scripts/dev.mjs`、`dev/Dockerfile` 为准。
- 页面主体仍由 LuCI 及插件提供，通常是运行时生成的 DOM。主题可以调整模板和布局，但不要把原生页面整体替换为静态演示页，也不要绕过权限、保存、应用和撤销流程。
- Sharp 的主题实现独立维护；开发与验证仅使用本项目目录及 `dev/compose.yaml` 定义的服务。
- 与用户默认用中文沟通。用户提出修改需求时直接完成合理范围内的实现与验证；只在缺少关键需求或确有操作风险时询问。

## 开始工作与本地环境

1. 确认工作目录是本文件所在的 Sharp 项目根目录，先检查 `git status --short`。保留已有改动和未跟踪文件，不使用 `reset --hard`、`clean` 等方式清理用户工作。
2. 阅读相关模块；源码中的实际结构优先于对 LuCI 的印象。查找文件和文本优先使用 `rg`。
3. 需要运行页面时，先用 `docker compose -f dev/compose.yaml ps` 查看现有 Sharp 服务。不要假设新会话开始时容器或文件监听器一定已运行。

默认开发地址：`http://127.0.0.1:8090/cgi-bin/luci/`。本地开发账号为 `root`，密码为 `sharp-dev`；这不是实际路由器的凭据。若配置了 `SHARP_PORT`，以实际端口映射为准。

环境需要 Node.js 22+、C 编译器及 Docker Engine/Desktop + Compose。C 编译器仅用于构建本机翻译工具；路由器运行主题不需要 Node.js 或编译器。

在项目根目录执行：

| 命令 | 使用场景 |
| --- | --- |
| `npm ci` | 首次准备或需要按锁文件安装依赖时 |
| `npm run dev` | 启动开发服务，并监听 CSS、TypeScript 和翻译输入 |
| `npm run dev:up` | 启动服务，不保持文件监听 |
| `npm run check` | TypeScript 类型检查及资源、翻译构建 |
| `npm run build` | 仅构建资源和翻译目录 |
| `npm run i18n` | 提取翻译模板、编译语言目录及生成语言注册脚本 |
| `npm run dev:sync` | 将原生视图、菜单、权限和已构建的翻译同步到运行中的 Sharp 容器 |
| `npm run dev:logs` | 查看 Sharp 容器日志 |
| `npm run dev:stop` | 停止 Sharp 开发服务 |
| `npm run dev:rebuild` | 开发镜像确需更新时重新构建；普通主题修改不需要 |

`.ut` 模板和 `htdocs/luci-static/sharp/` 已直接挂载到容器。CSS/TS 修改后构建并刷新浏览器即可；模板修改后刷新即可。原生 LuCI JS、菜单 JSON、ACL 和翻译目录需要同步，持续运行的 `npm run dev` 会处理同步，否则构建后执行 `npm run dev:sync`。没有自动刷新浏览器的保证。

优先复用现有容器，保留其中的语言和 UCI 配置。不要因为样式修改重建容器，不要擅自重启 Docker Desktop、操作其他项目容器或删除开发数据。Docker 不可用时，继续完成能做的代码和构建检查，并明确报告无法进行真实页面验证，不要宣称浏览器验证通过。

## 修改入口与构建产物

| 路径 | 职责 |
| --- | --- |
| `ucode/template/themes/sharp/head.ut` | 文档头、资源地址、首次绘制时的外观状态 |
| `ucode/template/themes/sharp/header.ut` | 桌面与手机顶栏、搜索和手机弹窗、内容容器 |
| `ucode/template/themes/sharp/footer.ut` | 页脚和主题脚本入口 |
| `ucode/template/themes/sharp/sysauth.ut` | 登录页 |
| `ucode/template/themes/sharp/settings-main.ut` | 主界面布局选项 |
| `ucode/template/themes/sharp/brand.ut` | 登录页与桌面、手机页头共用的 Logo、文本和默认回退 |
| `htdocs/luci-static/resources/view/sharp/basic.js`、`resources/sharp/branding.js` | 基础设置原生 LuCI 表单、图片路径校验和上传图片转换 |
| `htdocs/luci-static/resources/view/sharp/login.js`、`resources/sharp/login.js` | 登录外观表单、实时预览及配置默认值 |
| `frontend/styles/tokens.css` | 配色、间距等变量；亮暗主题共用的设计参数 |
| `frontend/styles/shell.css` | 主题外框、导航、弹窗、响应式布局 |
| `frontend/styles/sidebar.css`、`frontend/ts/sidebar.ts` | 类argon 桌面双层侧栏、真实菜单和键盘操作 |
| `frontend/styles/luci.css` | LuCI 原生表单、表格、标签、错误和模态框样式 |
| `frontend/styles/settings.css` | Sharp 设置页的布局选择卡片和示意图 |
| `frontend/styles/motion.css`、`frontend/ts/motion.ts` | 动效样式、可中断的进出场动画及手机导航分组展开 |
| `frontend/ts/main.ts` | 初始化、LuCI 自动刷新／暂停及未应用配置提醒 |
| `frontend/ts/pending.ts` | 配置变更计数、单条自动提醒及原生配置弹窗入口 |
| `frontend/ts/navigation.ts` | 真实菜单树、桌面/手机导航、子页面入口、用户菜单 |
| `frontend/ts/dom.ts` | DOM 辅助函数、下拉框定位与键盘/关闭行为 |
| `frontend/ts/layout.ts` | 标题、面包屑、默认标签、原生标签和表格滚动适配 |
| `frontend/ts/search.ts` | 菜单搜索 |
| `frontend/ts/dialogs.ts` | 手机抽屉、设置及搜索弹窗的焦点和关闭行为 |
| `frontend/ts/appearance.ts` | 浅色、深色、跟随系统及偏好存储 |
| `frontend/ts/login.ts` | 登录密码显示切换、无障碍标签及离开页面时恢复掩码 |
| `frontend/ts/desktop-layout.ts` | 桌面布局即时切换、浏览器偏好同步及断点焦点处理 |
| `frontend/ts/i18n.ts`、`frontend/ts/luci.d.ts` | 翻译接口、LuCI 类型声明 |
| `po/` | 语言注册表、翻译源文件及提取模板 |
| `root/usr/share/luci/menu.d/` | Sharp 自己的菜单定义 |
| `scripts/`、`dev/`、`Makefile` | 构建、开发环境和 OpenWrt 打包 |
| `.github/workflows/`、`.github/scripts/` | GitHub 检查、SDK 打包、版本校验及 Release 发布 |
| `docs/releases/` | 随版本维护的发布说明，首版包含项目介绍 |
| `docs/` | 开发指南、软件包构建和多语言文档；入口为 `docs/README.md` |

修改源文件后通过脚本生成产物，不直接手改 `htdocs/luci-static/sharp/sharp.js`、`sharp.css`、`po/templates/sharp.pot`、`root/usr/lib/lua/luci/i18n/sharp.*.lmo` 或 `root/etc/uci-defaults/31_luci-theme-sharp-languages`。这些生成文件随源码分发，打包无需安装 npm 依赖；代码交付时保持它们与源文件一致。

`.dev/` 用于缓存、构建工具、截图和临时验证材料，不作为生产代码或必须存在的开发依赖。不要提交 `node_modules/` 或 `.dev/`。保留 `scripts/vendor/po2lmo/` 中官方工具的来源、修改说明和 Apache-2.0 许可证。

## 已确定的界面约定

- 整体是顶部 Header 加下方内容区，顶栏和下拉框使用直角；Header 与内容之间有分割线和阴影。桌面支持「默认(类OpenWrt)」与「类argon」两种布局，内容节点、表单和子页面标签保持原生行为。
- 默认桌面顶栏左侧为 Logo、一级导航及二级下拉菜单、搜索；右侧为自动刷新／暂停、未应用配置数量、外观和用户菜单。二级下拉菜单不重复添加分类标题。
- 类argon 桌面布局使用 56px 高的紧凑顶栏，保留 Logo、搜索及右侧操作，导航位于左侧双栏：一级菜单图标在上、文字在下，点击后在右栏显示对应二级菜单。菜单仍来自 LuCI 菜单树，未知分类使用通用图标。顶栏和侧栏随滚动保持可用，侧栏位置随顶栏实际高度同步，侧栏两列各自滚动；宽度不超过 900px 时恢复现有手机导航。
- 导航、外观和用户下拉框统一调用 `bindPopover()`，以 Header 底部为定位基准；间距由 `--sharp-popover-gap` 控制，当前为 **4px**。不要重新为小按钮增加各自的 `top` 偏移。
- 搜索通过 dialog 展示，打开时聚焦输入框；支持关闭按钮、Escape、遮罩关闭及焦点恢复。菜单和搜索条目来自 LuCI 菜单树，不写死业务菜单。
- 动效使用短时过渡，菜单和弹窗支持中断、反向及快速重开；关闭后释放焦点和滚动锁。尊重 `prefers-reduced-motion`，切换为减少动态效果时立即完成在途动画。原生 LuCI 弹窗接管和响应式断点切换不等待退出动画。
- **宽度不超过 900px** 使用手机布局：左侧菜单按钮、中间 Logo、右侧依次为搜索、未应用配置数量按钮和设置图标；无未应用配置时隐藏数量按钮。窄屏为右侧按钮预留空间，避免挤压 Logo。主菜单为纵向抽屉；外观和用户操作集中在手机设置弹窗中，不提供自动刷新控制入口，设置图标不显示未应用配置提示点。
- 桌面用户菜单和手机设置弹窗的账号区域仅显示用户名，不显示设备名。桌面自动刷新与未应用配置为独立按钮，保持间距，不使用负边距叠放。
- 桌面自动刷新按钮代理 LuCI 原生 `poll-status` 指示器的点击操作，切换原生轮询的刷新／暂停状态；图标和提示同步原生状态，无指示器时隐藏。保留原生节点及事件，不执行整页刷新、不另建轮询定时器。
- 配置变更数量以 LuCI 原生指示器及 `ui.changes.changes` 为准。当前页面中数量变化且不为 0 时，在计数按钮下方自动显示「你有 N 项配置尚未保存」和右侧关闭按钮，复用 `bindPopover()` 的定位、动效、互斥及关闭行为；不抢焦点。点击提醒或计数按钮均打开原生配置变更弹窗。关闭后相同数量不重复弹出，下一次数量变化时重新提醒；归零时隐藏计数及提醒。已有弹窗时延迟到弹窗关闭再显示。所有桌面布局和手机视图均支持。
- 内容区不显示重复的大页面标题和右上角设备名。隐藏标题时保留无障碍语义，不影响卡片、内容分节、错误或弹窗标题。
- 默认桌面布局的面包屑位于首个可见标签栏右侧；类argon桌面布局将三级标签放到 Header 下方的全宽标签带，并隐藏「一级 / 二级」面包屑；手机隐藏面包屑，标签使用整行宽度。
- 有原生标签就使用原生标签。无原生标签时补一个当前选中的默认标签，名称取已翻译的导航项文本，例如「概览」，不靠拆分面包屑字符串推断。异步加载出原生标签后，默认标签应隐藏，不能出现两套重复标签。
- 所有标签栏保持单行，超长时只在自身区域横向滚动；当前项和键盘聚焦项自动可见，不能带动整页横向滚动。
- 当前不实现顶栏三级菜单、可关闭的多标签工作区或 keep-alive 页面缓存。
- 「系统 → Sharp 主题设置」入口为 `/cgi-bin/luci/admin/system/sharp`，通过 LuCI 子路由显示「基础设置」「登陆界面」「主界面」三个标签，分别对应 `/basic`、`/login`、`/main`，默认进入「基础设置」。「基础设置」使用原生 LuCI 表单配置 `luci.sharp.brand_logo`、`luci.sharp.brand_text`，支持本机静态图片路径、上传、预览和恢复默认，沿用保存、应用及撤销，配置对登录页和所有浏览器的页头生效；上传只写专用 `/www/luci-static/sharp-custom/logo-*.png`，转换为最大 512 像素的 PNG，使用新文件名，不覆盖当前图片；图片目录加入系统备份。「登陆界面」使用原生 `resources/view/sharp/login.js` 表单，配置 `luci.sharp.login_*`：居中卡片／经典左侧栏、内置默认壁纸／纯色／必应每日壁纸／Wallhaven 风景图／本机图片背景、铺满／完整显示、暗化 0～80%、面板不透明度 0～100% 和模糊 0～30px，默认保持居中、不透明面板。背景上传复用图片模块，最大 10 MB／4000 万像素，转换为最大边长 2560 像素的 JPEG，专用路径为 `/www/luci-static/sharp-custom/background-*.jpg`。预览即时更新，应用后在下次打开登录页时生效；隐藏的图片设置保留；服务端校验和图片加载失败均安全回退。不得改变原生认证字段、插件扩展或登录错误行为。「主界面」提供桌面端布局「默认(类OpenWrt)」「类argon」和手机端布局「默认」的单选示意卡片。桌面布局立即生效，保存在当前浏览器的 `sharp:desktop-layout`，首次绘制前读取，刷新和导航后保留；不写 UCI、不触发未保存配置提醒。手机布局独立且目前只有默认选项。主界面布局选择不添加保存按钮，主题设置不提供语言选择器；它与手机快捷设置弹窗是两个独立入口。

## LuCI 适配要点

- 优先做通用修复，覆盖正常内容、长报错、长文本和窄屏，不只为截图中的某个路由写特例。
- 原生 `.cbi-tabmenu` 必须紧挨其后面的内容面板组；LuCI 通过 `nextElementSibling` / `previousElementSibling` 找到它们。不要把标签列表单独搬走或在列表与面板之间插入面包屑。当前实现将面包屑插在标签列表之前。
- 原生标签初始化时，未选中的面板可能尚无 `data-tab-active`；在已初始化的组内，只显示标记为 `true` 的面板。不要仅隐藏显式写着 `false` 的面板，也不要误伤标签项自身。
- 保留原生节点、事件、字段标识和轮询更新。表格通过 `.sharp-table-scroll` 外层滚动，不克隆或替换原表格；自行管理滚动的表格可用 `data-sharp-scroll="off"` 退出主题包装。
- flex/grid 子元素允许收窄，使用 `min-width: 0`、合理的 `max-width` 和局部滚动。长日志、表格、标签分别管理溢出；不要用全局 `overflow-x: hidden` 掩盖出框问题。模态框打开时的页面滚动锁定不属于此限制。
- 使用现有 CSS 变量兼容亮暗配色，保留触控尺寸、可见焦点和键盘操作。不要为所有 `h2`、所有按钮或所有原生下拉组件添加无边界的覆盖。
- 处理异步渲染和重新渲染；使用 MutationObserver/ResizeObserver 时避免重复包装、重复注册及自身属性修改引发的循环，布局测量适当通过 `requestAnimationFrame` 合并。
- 容器缺少无线、交换机或某些 UCI 配置时可能出现原生 RPC 错误。先区分环境问题和主题问题；不要靠隐藏错误或伪造数据让页面看起来通过，也不要为外观验证去修改路由配置。

## 中英文与新增语言

- 主题跟随 LuCI 当前语言，英文为源文案和回退语言；简体中文随主题内置。未来语言通过 PO 目录扩展，不引入另一套前端语言切换系统。
- TypeScript 文案使用 `t('English message')`；数量文案使用 `tn(count, 'singular', 'plural')`，并提供完整句子，不拼接语言片段。
- 原生 LuCI 视图和辅助 JS 使用 `_('English message', 'sharp')`，保留 LuCI loader 的 `require` 指令和返回值，不作为普通静态脚本加载；提取器会一起扫描 `htdocs/luci-static/resources/`。
- `.ut` 中主题文案使用 `_('English message', 'sharp')`；对应 PO 条目带 `msgctxt "sharp"`。新文案同时补充 `po/zh_Hans/sharp.po`，包括提示、空状态和无障碍标签。
- 原生菜单和插件文案继续走它们原有的翻译上下文。菜单 JSON 不支持上下文，项目菜单标题（包括 `Sharp theme settings` 及其子页面标题）使用无上下文条目，不能机械地为所有 `_()` 调用加上 `sharp`。
- 新增语言时更新 `po/languages.json` 和对应的 `po/<language>/sharp.po`，正确填写 Language 与复数规则；运行构建，并在需要预览时同步到容器。详细流程见 [docs/I18N.md](docs/I18N.md)。

## 验证与交付

- 源码变更完成后运行 `npm run check`。纯文档修改检查内容、命令和文件引用即可，无需启动 Docker 或重复构建。不要为简单样式改动增加只复刻实现的测试。
- GitHub 发布使用 `v<版本>` 标签，版本须与 `Makefile`、`package.json` 和 `package-lock.json` 一致，并提供 `docs/releases/<标签>.md`。`main` 提交和 PR 执行检查；标签推送执行 SDK 打包及发布。手动运行发布工作流并选择分支只生成 artifact。发布流程见 `docs/BUILD.md`，已发布标签不移动。
- 涉及界面或交互时，在真实 Sharp 开发服务上刷新验证，不能只看静态截图或构建成功。选择与改动有关的页面，不必每次重复全量验证。
- 通用标签修改可用「概览」（默认标签）、「启动项」（异步原生标签）、「管理权」（路由子标签）检查；Sharp 设置页的三个子标签也使用路由导航。检查切换后内容和选中态一致，没有重复标签。
- 响应式修改至少覆盖相关桌面和手机宽度；通用溢出改动可用 320/390px 检查窄屏，并按需检查 900px 断点两侧。关注页面宽度、局部滚动、弹层遮挡及亮暗配色。
- 修改下拉框和 dialog 时，验证定位、打开/关闭、互斥、Escape、键盘导航、焦点恢复和窗口缩放中受影响的行为。无需为验证外观而执行重启、改密码、保存网络配置等业务动作。
- 容器预览不能证明无线、刷机或真实路由器操作可用；没有实际运行 OpenWrt SDK 打包就不要宣称软件包编译通过。
- 在可用时保存能说明改动的截图到 `.dev/`。报告具体改了什么、实际验证了什么，以及确实存在的限制；明确区分构建通过、浏览器验证和未验证事项。
- README 面向主题用户，仅保留安装、设置项、效果展示及文档入口，不加入开发流程或新特性清单。开发、构建和多语言资料集中在 `docs/`；新增命令、依赖、目录或改变开发流程时更新对应文档和索引，用户操作变化时同步 README；改变 AI 开发约定时同步本文件。不要把临时会话状态、浏览器 tab ID 或过期的运行结论当作项目规范。

- 在线登录壁纸使用 `root/www/cgi-bin/sharp-wallpaper` 的固定必应／Wallhaven 来源。保留随包 SVG 回退、异步加载、请求限时、缓存和可执行权限，不接受任意 URL。依赖和 API 细节见 `docs/DEVELOPMENT.md`。
- 登录卡片与经典侧栏共用品牌区、欢迎标题、设备名和带图标的表单，保持直角风格；设置页预览同步实际结构。密码显示按钮仅在脚本初始化后出现，保留原密码字段和原生提交，离开页面时恢复掩码。
