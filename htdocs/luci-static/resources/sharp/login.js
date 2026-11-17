'use strict';
'require baseclass';

return baseclass.extend({
    defaults: {
        login_layout: 'centered', login_background: 'default', login_background_image: '',
        login_background_fit: 'cover', login_background_dim: '20',
        login_panel_opacity: '100', login_panel_blur: '0'
    },

    normalize(values) {
        const choice = (name, choices) => choices.includes(values[name]) ? values[name] : this.defaults[name];
        const number = (name, max) => /^\d+$/.test(String(values[name])) && Number(values[name]) <= max
            ? Number(values[name]) : Number(this.defaults[name]);
        return {
            layout: choice('login_layout', ['centered', 'sidebar']),
            background: choice('login_background', ['default', 'plain', 'bing', 'wallhaven', 'image']),
            fit: choice('login_background_fit', ['cover', 'contain']),
            dim: number('login_background_dim', 80),
            opacity: number('login_panel_opacity', 100),
            blur: number('login_panel_blur', 30)
        };
    }
});
