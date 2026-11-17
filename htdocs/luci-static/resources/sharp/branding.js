'use strict';
'require baseclass';

/* Shared by the settings view and its regression checks. Paths stay local. */
return baseclass.extend({
    normalizeLogoPath(value) {
        const path = String(value || '').trim().replace(/^\/www(?=\/luci-static\/)/, '');
        if (!path) return '';
        if (!path.startsWith('/luci-static/') || /[\x00-\x20\x7f\\<>"'?#%]/.test(path)
            || /\/\.{1,2}(?:\/|$)/.test(path)
            || !/\.(png|jpe?g|gif|webp|svg)$/i.test(path)) return null;
        return path;
    },

    createUpload(blob, path, sessionID) {
        const data = new FormData();
        data.append('sessionid', sessionID);
        data.append('filename', '/www' + path);
        // cgi-io defaults to 0600; static images must be readable by uhttpd.
        data.append('filemode', '0644');
        data.append('filedata', blob, blob.type === 'image/jpeg' ? 'background.jpg' : 'logo.png');
        return data;
    },

    prepareLogo(file) {
        return this.prepareImage(file, false);
    },

    prepareBackground(file) {
        return this.prepareImage(file, true);
    },

    async prepareImage(file, background) {
        if (!file || !/\.(png|jpe?g|gif|webp|svg)$/i.test(file.name))
            throw new Error(_('Choose a PNG, JPEG, GIF, WebP or SVG image.', 'sharp'));
        if (file.size > (background ? 10 : 2) * 1024 * 1024)
            throw new Error(background ? _('The background must be no larger than 10 MB.', 'sharp')
                : _('The image must be no larger than 2 MB.', 'sharp'));
        const url = URL.createObjectURL(file);
        try {
            const image = new Image();
            image.src = url;
            await image.decode();
            if (!image.naturalWidth || !image.naturalHeight
                || image.naturalWidth * image.naturalHeight > (background ? 40000000 : 16777216))
                throw new Error(_('The image dimensions are too large.', 'sharp'));
            // Rasterize uploads, including SVG, so public files cannot contain scripts.
            const scale = Math.min(1, (background ? 2560 : 512) / Math.max(image.naturalWidth, image.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            const context = canvas.getContext('2d');
            if (!context) throw new Error(_('The image could not be processed.', 'sharp'));
            if (background) {
                context.fillStyle = '#f5f6f8';
                context.fillRect(0, 0, canvas.width, canvas.height);
            }
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, background ? 'image/jpeg' : 'image/png', 0.88));
            if (!blob) throw new Error(_('The image could not be processed.', 'sharp'));
            return blob;
        } catch (error) {
            if (error.name === 'EncodingError' || error.name === 'SecurityError')
                throw new Error(_('The image could not be read. Please choose another file.', 'sharp'));
            throw error;
        } finally {
            URL.revokeObjectURL(url);
        }
    }
});
