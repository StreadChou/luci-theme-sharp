'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require request';
'require rpc';
'require sharp.branding as images';
'require sharp.login as login';

return view.extend({
    load() {
        return uci.load('luci');
    },

    render() {
        if (!uci.get('luci', 'sharp')) uci.add('luci', 'sharp', 'sharp');
        const m = new form.Map('luci', _('Sharp theme settings'),
            _('Customize the login layout and background. Save and apply, then reopen the login page to see your changes.', 'sharp'));
        const s = m.section(form.NamedSection, 'sharp', 'sharp', _('Login appearance', 'sharp'));
        s.addremove = false;
        const fields = {};
        let uploading = false;
        let restoreBackgroundDefaults = false;
        let updatePreview = () => {};
        const save = m.save.bind(m);
        m.save = (callback, silent) => {
            if (uploading) return Promise.reject(new Error(_('Wait for the image upload to finish.', 'sharp')));
            return save(async (...args) => {
                // Native LuCI skips retained, hidden fields. An explicit reset must
                // restore those fields too, after validation and before UCI save.
                if (restoreBackgroundDefaults && fields.login_background.formvalue('sharp') === 'default') {
                    for (const name of ['login_background_image', 'login_background_fit', 'login_background_dim']) {
                        if (login.defaults[name] === '') uci.unset('luci', 'sharp', name);
                        else uci.set('luci', 'sharp', name, login.defaults[name]);
                    }
                }
                if (callback) return callback(...args);
            }, silent).then(result => {
                restoreBackgroundDefaults = false;
                updatePreview();
                return result;
            });
        };
        const reset = m.reset.bind(m);
        m.reset = (...args) => {
            restoreBackgroundDefaults = false;
            return Promise.resolve(reset(...args)).then(result => { updatePreview(); return result; });
        };

        const defaultImage = L.media('login-background.svg');
        const background = E('img', { alt: '', hidden: true, referrerpolicy: 'no-referrer' });
        const shade = E('div', { 'class': 'sharp-login-shade' });
        const brandImage = E('img', { src: images.normalizeLogoPath(uci.get('luci', 'sharp', 'brand_logo')) || L.media('logo.svg'), alt: '' });
        brandImage.addEventListener('error', () => {
            if (brandImage.getAttribute('src') !== L.media('logo.svg')) brandImage.src = L.media('logo.svg');
        });
        const preview = E('div', { 'class': 'sharp-login-preview', 'aria-hidden': 'true' }, [
            E('div', { 'class': 'sharp-login-backdrop' }, [E('img', { src: defaultImage, alt: '' }), background, shade]),
            E('div', { 'class': 'sharp-login-panel-sample' }, [
                E('div', { 'class': 'sharp-login-header-sample' }, [
                    E('div', { 'class': 'sharp-login-brand-sample' }, [brandImage, E('strong', {}, [(uci.get('luci', 'sharp', 'brand_text') || '').trim() || 'SHARP'])]),
                    E('small', {}, [_('Control panel', 'sharp')])
                ]),
                E('div', { 'class': 'sharp-login-heading-sample' }, [
                    E('strong', {}, [_('Welcome back', 'sharp')]), E('small', {}, ['OpenWrt'])
                ]),
                E('div', { 'class': 'sharp-login-form-sample' }, [
                    E('div', {}, [E('span', {}, [_('Username', 'sharp')]),
                        E('i', {}, [E('span', { 'class': 'sharp-login-symbol-sample' }), E('span', {}, ['root'])])]),
                    E('div', {}, [E('span', {}, [_('Password', 'sharp')]),
                        E('i', {}, [E('span', { 'class': 'sharp-login-symbol-sample' }), E('span', {}, ['••••••••']), E('span', { 'class': 'sharp-login-eye-sample' })])]),
                    E('b', {}, [E('span', {}, [_('Log in', 'sharp')]), E('span', {}, ['→'])])
                ]),
                E('div', { 'class': 'sharp-login-foot-sample' }, [E('span', {}, ['OpenWrt']), E('span', {}, ['LuCI · Sharp'])])
            ])
        ]);
        const status = E('p', { 'class': 'cbi-value-description', role: 'status', 'aria-live': 'polite' });
        let previewKey = '';
        let cancelPreview = () => {};
        const fallbackMessage = _('The background could not be loaded. The built-in wallpaper is shown.', 'sharp');
        const showBackground = (key, path, online) => {
            cancelPreview();
            const controller = new AbortController();
            let cancelled = false;
            let pendingImage;
            let timer;
            cancelPreview = () => {
                cancelled = true;
                controller.abort();
                clearTimeout(timer);
                if (pendingImage) { pendingImage.onload = pendingImage.onerror = null; pendingImage.src = ''; }
            };
            background.hidden = true;
            status.textContent = online ? _('Loading online wallpaper…', 'sharp') : '';
            const show = url => {
                if (controller.signal.aborted) return;
                if (!url) { status.textContent = fallbackMessage; return; }
                pendingImage = new Image();
                timer = setTimeout(() => { cancelPreview(); status.textContent = fallbackMessage; }, 10000);
                pendingImage.referrerPolicy = 'no-referrer';
                pendingImage.onload = () => {
                    clearTimeout(timer);
                    if (key !== previewKey || controller.signal.aborted) return;
                    background.src = url;
                    background.hidden = false;
                    status.textContent = '';
                };
                pendingImage.onerror = () => { clearTimeout(timer); status.textContent = fallbackMessage; };
                pendingImage.src = url;
            };
            if (!online) { if (path) show(path); return; }
            timer = setTimeout(() => controller.abort(), 8000);
            fetch(L.env.cgi_base + '/sharp-wallpaper?source=' + key, {
                signal: controller.signal, credentials: 'omit', cache: 'no-store'
            }).then(async response => {
                const result = response.ok ? await response.json() : {};
                clearTimeout(timer);
                if (key !== previewKey || controller.signal.aborted) return;
                const allowed = key === 'bing' ? /^https:\/\/www\.bing\.com\/th\?id=OHR\.[A-Za-z0-9_.=&-]+$/
                    : /^https:\/\/w\.wallhaven\.cc\/full\/[a-z0-9]{2}\/wallhaven-[a-z0-9]{6}\.(jpg|png)$/;
                show(typeof result.url === 'string' && allowed.test(result.url) ? result.url : '');
            }).catch(() => {
                if (!cancelled && key === previewKey) status.textContent = fallbackMessage;
            });
        };
        window.addEventListener('pagehide', () => cancelPreview(), { once: true });
        let o = s.option(form.DummyValue, '_preview', _('Preview', 'sharp'));
        o.renderWidget = () => E('div', { 'class': 'sharp-login-preview-wrap' }, [preview, status,
            E('p', { 'class': 'cbi-value-description' }, [_('Preview follows the current light or dark appearance. Logo and text are configured in Basic settings.', 'sharp')])]);

        const option = (Type, name, title, description) => {
            const field = s.option(Type, name, title, description);
            field.default = login.defaults[name];
            field.rmempty = false;
            fields[name] = field;
            return field;
        };
        o = option(form.ListValue, 'login_layout', _('Login panel layout', 'sharp'));
        o.value('centered', _('Centered card (default)', 'sharp'));
        o.value('sidebar', _('Classic sidebar', 'sharp'));

        o = option(form.ListValue, 'login_background', _('Background', 'sharp'));
        o.value('default', _('Built-in wallpaper (default)', 'sharp'));
        o.value('plain', _('Solid color', 'sharp'));
        o.value('bing', _('Bing daily wallpaper', 'sharp'));
        o.value('wallhaven', _('Wallhaven landscapes', 'sharp'));
        o.description = _('Online wallpapers need internet access. If a provider is unavailable, the built-in wallpaper is used. Bing updates daily; Wallhaven selects a landscape every 12 hours.', 'sharp');
        o.value('image', _('Custom image', 'sharp'));

        const BackgroundValue = form.Value.extend({
            renderWidget(section, index, value) {
                const widget = this.super('renderWidget', [section, index, value]);
                const disabled = this.readonly != null ? this.readonly : this.map.readonly;
                const chooser = E('input', { type: 'file', accept: '.png,.jpg,.jpeg,.gif,.webp,.svg', hidden: true, disabled,
                    'aria-label': _('Upload background', 'sharp') });
                const upload = E('button', { type: 'button', 'class': 'cbi-button', disabled }, [_('Upload image…', 'sharp')]);
                upload.addEventListener('click', () => chooser.click());
                chooser.addEventListener('change', async () => {
                    const file = chooser.files[0];
                    if (!file) return;
                    uploading = true;
                    upload.disabled = true;
                    upload.textContent = _('Uploading…', 'sharp');
                    try {
                        const blob = await images.prepareBackground(file);
                        const random = Array.from(crypto.getRandomValues(new Uint8Array(8)), byte => byte.toString(16).padStart(2, '0')).join('');
                        const path = '/luci-static/sharp-custom/background-' + random + '.jpg';
                        const response = await request.post(L.env.cgi_base + '/cgi-upload', images.createUpload(blob, path, rpc.getSessionID()), { timeout: 60000 });
                        const reply = response.json();
                        if (!response.ok || reply.failure) throw new Error(_('The background could not be uploaded. Please try again.', 'sharp'));
                        this.getUIElement(section).setValue(path);
                        updatePreview();
                        status.textContent = _('Image uploaded. Save and apply to use this background.', 'sharp');
                    } catch (error) {
                        ui.addNotification(null, E('p', {}, [error.message]), 'error');
                    } finally {
                        uploading = false;
                        upload.disabled = disabled;
                        upload.textContent = _('Upload image…', 'sharp');
                        chooser.value = '';
                    }
                });
                return E('div', { 'class': 'sharp-branding-logo-control' }, [widget, upload, chooser]);
            }
        });
        const image = option(BackgroundValue, 'login_background_image', _('Background image path', 'sharp'),
            _('Upload an image up to 10 MB, or enter a local /luci-static/ or /www/luci-static/ image path. Uploads become static JPEG images with a maximum edge of 2560 pixels.', 'sharp'));
        image.placeholder = '/luci-static/sharp-custom/background.jpg';
        image.depends('login_background', 'image');
        image.retain = true;
        image.rmempty = false;
        image.validate = (section, value) => uploading ? _('Wait for the image upload to finish.', 'sharp')
            : !value.trim() ? _('Upload a background image or enter its local path.', 'sharp')
            : images.normalizeLogoPath(value) !== null || _('Enter a local PNG, JPEG, GIF, WebP or SVG path under /luci-static/.', 'sharp');
        image.write = (section, value) => uci.set('luci', section, 'login_background_image', images.normalizeLogoPath(value));

        o = option(form.ListValue, 'login_background_fit', _('Image fit', 'sharp'));
        o.value('cover', _('Fill screen (crop edges)', 'sharp'));
        o.value('contain', _('Show whole image', 'sharp'));
        o.depends('login_background', 'default');
        o.depends('login_background', 'bing');
        o.depends('login_background', 'wallhaven');
        o.depends('login_background', 'image');
        o.retain = true;

        const numeric = (name, title, description, max) => {
            const field = option(form.Value, name, title, description);
            field.validate = (section, value) => /^\d+$/.test(value) && Number(value) <= max
                || _('Enter a whole number from 0 to %d.', 'sharp').format(max);
            return field;
        };
        o = numeric('login_background_dim', _('Background dimming (%)', 'sharp'),
            _('0 keeps the original brightness; 80 gives the darkest overlay.', 'sharp'), 80);
        o.depends('login_background', 'default');
        o.depends('login_background', 'bing');
        o.depends('login_background', 'wallhaven');
        o.depends('login_background', 'image');
        o.retain = true;
        numeric('login_panel_opacity', _('Login panel opacity (%)', 'sharp'),
            _('0 is transparent; 100 is opaque. Choose enough opacity to keep text readable.', 'sharp'), 100);
        numeric('login_panel_blur', _('Login panel blur (px)', 'sharp'),
            _('Blur the background behind the login panel, from 0 to 30. Most visible with a translucent panel.', 'sharp'), 30);

        o = s.option(form.DummyValue, '_defaults', '');
        o.renderWidget = () => E('button', {
            type: 'button', 'class': 'cbi-button', disabled: m.readonly,
            click: () => {
                restoreBackgroundDefaults = true;
                for (const [name, field] of Object.entries(fields)) field.getUIElement('sharp').setValue(login.defaults[name]);
                m.checkDepends();
                updatePreview();
            }
        }, [_('Restore default login appearance', 'sharp')]);

        return m.render().then(node => {
            node.classList.add('sharp-login-settings');
            updatePreview = () => {
                const values = Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.formvalue('sharp')]));
                const settings = login.normalize(values);
                const path = images.normalizeLogoPath(values.login_background_image);
                const online = settings.background === 'bing' || settings.background === 'wallhaven';
                const key = settings.background === 'image' ? 'image:' + (path || '') : settings.background;
                if (key !== previewKey) {
                    previewKey = key;
                    showBackground(key, settings.background === 'image' ? path : '', online);
                }
                preview.dataset.loginLayout = settings.layout;
                preview.dataset.loginFit = settings.fit;
                preview.dataset.hasBackground = String(settings.background !== 'plain');
                preview.style.setProperty('--sharp-login-dim', settings.dim + '%');
                preview.style.setProperty('--sharp-login-opacity', settings.opacity + '%');
                preview.style.setProperty('--sharp-login-blur', settings.blur + 'px');
                if (settings.background === 'image' && !path)
                    status.textContent = _('Upload a background image or enter its local path.', 'sharp');
            };
            node.addEventListener('input', updatePreview);
            node.addEventListener('widget-change', updatePreview);
            updatePreview();
            return node;
        });
    }
});
