# Sharp UI 改动报告

## 主题设置、品牌与主界面布局（2026-11-17）

- 原入口：`/admin/system/sharp` 使用 `ucode/template/themes/sharp/settings.ut` 显示空白页；登录页和页头的 Logo、文本固定在各自模板中，桌面只有顶部导航。
- 新入口：主题设置默认进入 `/admin/system/sharp/basic`，并提供 `/login` 和 `/main` 子路由。「基础设置」使用 `resources/view/sharp/basic.js`；「主界面」使用 `settings-main.ut`；共用品牌模板为 `brand.ut`。
- 配置与 API：品牌仅修改 `luci.sharp.brand_logo`、`brand_text`，使用原生 UCI 保存、应用和撤销。上传复用认证 `cgi-upload`，ACL 仅增加专用图片路径的写权限；图片使用新文件名并加入系统备份。桌面布局立即生效，仅保存在当前浏览器的 `sharp:desktop-layout`，不写 UCI。
- 界面：增加类 Argon 双层侧栏和布局示意卡片，导航继续来自真实 LuCI 菜单；三级标签显示在 Header 下方，原生内容和标签节点保留。宽度不超过 900px 时继续使用手机导航。
- 兼容性与合并关注点：原顶部导航仍可选择，品牌留空或图片失败时回退默认；不改变原生插件页面与后端业务。后续需核对 LuCI 菜单、认证上传、ACL、备份及模板容器结构。

## 自动刷新与配置提醒（2026-11-17）

- 原入口：顶栏刷新按钮执行整页刷新；未应用配置数量按钮打开原生变更弹窗。
- 新行为：`main.ts` 的刷新按钮代理原生 `poll-status` 点击，只切换自动轮询状态；新增 `pending.ts`，在配置数量变化时显示单条提醒，可关闭或打开原生变更弹窗，桌面两种布局与手机均支持。
- 字段与 API：复用 LuCI 原生指示器、`ui.changes.init()`、`ui.changes.changes` 和 `ui.changes.displayChanges()`；不增加 UCI 字段、轮询或后端接口。保存、应用及撤销语义不变。
- 兼容性与合并关注点：没有原生轮询指示器时隐藏刷新按钮；弹窗、焦点及提醒沿用统一 popover 生命周期。后续核对原生指示器、变更跟踪初始化和弹窗契约。

## 登录卡片重设计（2026-11-17）

- 原入口和新入口：登录页继续使用 `ucode/template/themes/sharp/sysauth.ut`；「系统 → Sharp 主题设置 → 登陆界面」的实时预览继续由 `view/sharp/login.js` 提供。
- 界面：品牌区、欢迎标题、设备名、带图标的输入框、主按钮和页脚重新布局，居中卡片与经典侧栏共用表单样式；亮暗配色、Logo、文本、背景和面板透明／模糊设置继续生效。设置预览同步显示新卡片。
- 交互：新增 `frontend/ts/login.ts`，切换原密码框的显示类型并同步无障碍标签，离开页面恢复掩码；无脚本时隐藏按钮，原生登录仍可用。
- 配置与 API：未新增 UCI 字段或接口。沿用 `luci.sharp` 品牌和登录外观字段；登录 POST、用户名／密码字段、认证插件扩展、资源及错误消息保持原生行为。不改变后端认证或 OpenClash 运行逻辑。
- 兼容性与合并关注点：核对 LuCI 登录模板字段和插件扩展契约；登录样式限定在主题容器内，设置预览与实际模板需要同步维护。

## 登录页外观设置

- 原入口：`/admin/system/sharp/login`，由 `ucode/template/themes/sharp/settings.ut` 提供空白占位页。
- 新入口：路由保持不变，改由 `htdocs/luci-static/resources/view/sharp/login.js` 提供原生 LuCI 表单、实时预览及恢复默认；`resources/sharp/login.js` 提供默认值，`resources/sharp/branding.js` 复用图片校验和转换。
- 配置：仅写入 `luci.sharp.login_layout`、`login_background`、`login_background_image`、`login_background_fit`、`login_background_dim`、`login_panel_opacity`、`login_panel_blur`。字段取值和默认值见 [开发指南](DEVELOPMENT.md#登录页外观配置)。Logo 和文本继续沿用基础设置。
- 登录页：`ucode/template/themes/sharp/sysauth.ut` 读取已提交配置；原生登录 POST、认证插件字段、资源和错误处理不变。默认仍为居中不透明卡片，背景改为随包内置壁纸；配置非法、图片缺失或解码失败时回退；登录脚本使用产物缓存版本。
- API：沿用 LuCI UCI 保存、应用和撤销，上传沿用认证的 `cgi-upload`；ACL 增加专用 `/www/luci-static/sharp-custom/background-*.jpg` 写权限。在线壁纸使用独立的只读固定来源 CGI（见下文）。新文件名避免在应用前覆盖现用图片，目录沿用系统备份。
- 兼容性：不依赖 Argon；内置和自定义背景无需外网，在线背景所需依赖见下文。不改动 OpenClash、网络和服务配置。面板颜色沿用 Sharp 亮暗配色，侧栏在窄屏占满宽度。
- 后续合并关注点：Sharp 登录模板的认证插件扩展、LuCI 原生 form/上传契约、菜单与 ACL、原生 JS 缓存标识，以及图片目录的备份规则。

## 登录背景来源（2026-11-17）

- 原入口和新入口：保持「系统 → Sharp 主题设置 → 登陆界面」及 `view/sharp/login.js`，背景由「默认纯色／自定义」扩展为「内置默认壁纸／纯色／必应每日壁纸／Wallhaven 风景图／自定义图片」。实时预览显示当前来源及失败回退状态，所有图片背景均可设置填充与暗化。
- 配置：沿用 `luci.sharp.login_background`，新增 `plain`、`bing`、`wallhaven` 枚举；`default` 现在表示随包的 `login-background.svg`。旧 `image`、路径及面板字段保持兼容，普通切换来源保留自定义路径；需要原纯色外观时选择 `plain`。
- API：新增匿名只读 `root/www/cgi-bin/sharp-wallpaper`，GET 仅接收精确的 `source=bing` 或 `source=wallhaven`，固定查询官方服务并校验图片域名。6 秒请求时限、响应大小限制、并发锁、12 小时成功缓存及 120 秒失败退避；无任意 URL 抓取，不修改配置。
- 行为：登录模板立即输出本地壁纸及原生表单，浏览器异步加载在线来源，失败回退内置图。保存、应用、撤销、认证插件和登录 POST 保持原生语义。新增 `wget-ssl`、`ca-bundle`、`jsonfilter` 包依赖；缓存仅写内存目录。不改 OpenClash 运行逻辑。
- 后续合并关注点：登录模板属性、静态壁纸打包、CGI 可执行权限及路径、下载器 TLS 与依赖、原生表单依赖条件和已应用配置读取。
