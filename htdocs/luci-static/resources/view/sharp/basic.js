'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require request';
'require rpc';
'require sharp.branding as branding';

return view.extend({
    load() {
        return uci.load('luci');
    },

    render() {
        if (!uci.get('luci', 'sharp')) uci.add('luci', 'sharp', 'sharp');
        const m = new form.Map('luci', _('Sharp theme settings'),
            _('Customize the Logo and text used on the login page and in desktop and mobile headers.', 'sharp'));
        const s = m.section(form.NamedSection, 'sharp', 'sharp', _('Logo and text', 'sharp'));
        s.addremove = false;
        const defaultLogo = L.media('logo.svg');
        let uploading = false;
        const save = m.save.bind(m);
        m.save = (...args) => uploading
            ? Promise.reject(new Error(_('Wait for the image upload to finish.', 'sharp')))
            : save(...args);
        let updatePreview = () => {};
        const previewImage = E('img', { src: defaultLogo, width: 36, height: 36, alt: '' });
        const previewText = E('span', {}, ['SHARP']);
        const previewStatus = E('p', { 'class': 'cbi-value-description', role: 'status', 'aria-live': 'polite' });
        let failedPath = null;
        let previewSource = defaultLogo;
        previewImage.addEventListener('error', () => {
            if (previewImage.getAttribute('src') === defaultLogo) return;
            failedPath = previewImage.getAttribute('src');
            previewImage.src = defaultLogo;
            previewStatus.textContent = _('The image could not be loaded. The default Logo is shown; check the path.', 'sharp');
        });

        let o = s.option(form.DummyValue, '_preview', _('Preview', 'sharp'));
        o.renderWidget = () => E('div', { 'class': 'sharp-branding-preview-wrap' }, [
            E('div', { 'class': 'sharp-branding-preview' }, [previewImage, previewText]), previewStatus
        ]);

        const LogoValue = form.Value.extend({
            renderWidget(section, index, value) {
                const widget = this.super('renderWidget', [section, index, value]);
                const disabled = this.readonly != null ? this.readonly : this.map.readonly;
                const chooser = E('input', {
                    type: 'file', accept: '.png,.jpg,.jpeg,.gif,.webp,.svg', hidden: true, disabled,
                    'aria-label': _('Upload Logo', 'sharp')
                });
                const upload = E('button', { type: 'button', 'class': 'cbi-button', disabled }, [_('Upload image…', 'sharp')]);
                upload.addEventListener('click', () => chooser.click());
                chooser.addEventListener('change', async () => {
                    const file = chooser.files[0];
                    if (!file) return;
                    uploading = true;
                    upload.disabled = true;
                    upload.textContent = _('Uploading…', 'sharp');
                    try {
                        const blob = await branding.prepareLogo(file);
                        const random = Array.from(crypto.getRandomValues(new Uint8Array(8)), byte => byte.toString(16).padStart(2, '0')).join('');
                        const path = '/luci-static/sharp-custom/logo-' + random + '.png';
                        const data = branding.createUpload(blob, path, rpc.getSessionID());
                        const response = await request.post(L.env.cgi_base + '/cgi-upload', data, { timeout: 60000 });
                        const reply = response.json();
                        if (!response.ok || reply.failure) throw new Error(_('The Logo could not be uploaded. Please try again.', 'sharp'));
                        this.getUIElement(section).setValue(path);
                        updatePreview();
                        previewStatus.textContent = _('Image uploaded. Save and apply to use this Logo.', 'sharp');
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
        const logo = s.option(LogoValue, 'brand_logo', _('Logo image path', 'sharp'),
            _('Upload an image up to 2 MB, or enter a local /luci-static/ or /www/luci-static/ image path. Leave empty to use the default Logo.', 'sharp'));
        logo.placeholder = '/luci-static/sharp/logo.svg';
        logo.validate = (section, value) => uploading ? _('Wait for the image upload to finish.', 'sharp')
            : branding.normalizeLogoPath(value) !== null || _('Enter a local PNG, JPEG, GIF, WebP or SVG path under /luci-static/.', 'sharp');
        logo.write = (section, value) => uci.set('luci', section, 'brand_logo', branding.normalizeLogoPath(value));

        const text = s.option(form.Value, 'brand_text', _('Brand text', 'sharp'),
            _('Up to 32 characters. Leave empty to use SHARP.', 'sharp'));
        text.placeholder = 'SHARP';
        text.validate = (section, value) => Array.from(value.trim()).length <= 32
            && !/[\x00-\x1f\x7f]/.test(value) || _('Use up to 32 characters without line breaks.', 'sharp');
        text.write = (section, value) => uci.set('luci', section, 'brand_text', value.trim());

        o = s.option(form.DummyValue, '_defaults', '');
        o.renderWidget = () => E('div', {}, [
            E('button', {
                type: 'button', 'class': 'cbi-button', disabled: m.readonly,
                click: () => {
                    logo.getUIElement('sharp').setValue('');
                    text.getUIElement('sharp').setValue('');
                    updatePreview();
                }
            }, [_('Restore default Logo and text', 'sharp')]),
            E('p', { 'class': 'cbi-value-description' }, [_('Changes take effect after Save & Apply and are shared by all browsers.', 'sharp')])
        ]);

        return m.render().then(node => {
            node.classList.add('sharp-branding-settings');
            updatePreview = () => {
                const pathValue = logo.formvalue('sharp');
                const path = branding.normalizeLogoPath(pathValue);
                const source = path || defaultLogo;
                if (previewSource !== source) {
                    previewSource = source;
                    failedPath = null;
                    previewImage.src = source;
                }
                previewText.textContent = (text.formvalue('sharp') || '').trim() || 'SHARP';
                if (failedPath !== source) previewStatus.textContent = path === null
                    ? _('Enter a local PNG, JPEG, GIF, WebP or SVG path under /luci-static/.', 'sharp') : '';
            };
            node.addEventListener('input', updatePreview);
            node.addEventListener('widget-change', updatePreview);
            updatePreview();
            return node;
        });
    }
});
