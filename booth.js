/* Shared layout, state and print rendering for both pages. */
window.Booth = (() => {
    const layouts = {
        single: { name: 'Single', count: 1, width: 900, height: 1080, columns: 1, rows: 1 },
        grid: { name: '2 × 2', count: 4, width: 1200, height: 1350, columns: 2, rows: 2 },
        portrait: { name: 'Portrait', count: 3, width: 600, height: 1500, columns: 1, rows: 3 }
    };
    const backgrounds = [
        { id: 'ivory', name: 'Ivory', color: '#fffaf0' },
        { id: 'blush', name: 'Blush', color: '#f5dce1' },
        { id: 'lavender', name: 'Lavender', color: '#e8def3' },
        { id: 'sage', name: 'Sage', color: '#dfe7d9' },
        { id: 'sky', name: 'Blue skies', color: '#dceaf4' },
        { id: 'midnight', name: 'Midnight', color: '#302d43', light: true },
        { id: 'hearts', name: 'Love notes', color: '#fce8e8', ink: '#d98b9e', pattern: 'hearts' },
        { id: 'stars', name: 'Stardust', color: '#eae2f3', ink: '#ad94c3', pattern: 'stars' },
        { id: 'check', name: 'Picnic', color: '#fff4e9', ink: '#e8c9b8', pattern: 'check' },
        { id: 'flowers', name: 'Daisy days', color: '#e4eada', ink: '#fffdf4', pattern: 'flowers' },
        { id: 'sunset', name: 'Peach sunset', color: '#f7d7c9', pattern: 'gradient' },
        { id: 'paper', name: 'Notebook', color: '#fffdf5', ink: '#d8dfeb', pattern: 'paper' }
    ];
    const defaults = { layout: 'portrait', background: 'ivory', text: '', showText: false, showDate: false, color: '#443b48', date: new Date().toISOString() };

    function load() {
        let settings = {}, photos = [];
        try { settings = JSON.parse(localStorage.getItem('littleMomentsSettings')) || {}; }
        catch { /* Keep usable photos even if the saved settings are invalid. */ }
        try { photos = JSON.parse(localStorage.getItem('photoStripImages')) || []; }
        catch { /* A fresh session also works when storage is unavailable. */ }
        const state = { ...defaults, ...settings };
        if (!Object.hasOwn(layouts, state.layout)) state.layout = defaults.layout;
        if (!backgrounds.some(bg => bg.id === state.background)) state.background = defaults.background;
        state.text = typeof state.text === 'string' ? state.text.slice(0, 60) : '';
        state.color = /^#[0-9a-f]{6}$/i.test(state.color) ? state.color : defaults.color;
        state.date = Number.isNaN(Date.parse(state.date)) ? defaults.date : state.date;
        state.showText = state.showText === true;
        state.showDate = state.showDate === true;
        state.photos = Array.isArray(photos) ? photos.filter(src => typeof src === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(src)).slice(0, 4) : [];
        return state;
    }

    function save(state) {
        const { photos, ...settings } = state;
        try {
            localStorage.setItem('photoStripImages', JSON.stringify(photos));
            localStorage.setItem('littleMomentsSettings', JSON.stringify(settings));
            return true;
        } catch { return false; }
    }

    function layoutPicker(container, selected, onChange) {
        Object.entries(layouts).forEach(([id, layout]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'layout-option';
            button.dataset.layout = id;
            button.setAttribute('aria-pressed', String(id === selected));
            button.setAttribute('aria-label', `${layout.name}, ${layout.count} ${layout.count === 1 ? 'photo' : 'photos'}`);
            button.innerHTML = `<span class="layout-icon ${id}" aria-hidden="true">${'<i></i>'.repeat(layout.count)}</span><span>${layout.name}</span>`;
            button.addEventListener('click', () => {
                container.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
                onChange(id);
            });
            container.appendChild(button);
        });
    }

    // SVG patterns fill the exact print dimensions, never stretching a frame image.
    function backgroundSVG(bg, width, height) {
        let drawing = '';
        const ink = bg.ink;
        if (bg.pattern === 'hearts') drawing = `<path d="M30 41C5 25 15 11 30 23C45 11 55 25 30 41Z" fill="${ink}" opacity=".6"/>`;
        if (bg.pattern === 'stars') drawing = `<path d="M30 12L34 26L48 30L34 34L30 48L26 34L12 30L26 26Z" fill="${ink}"/><circle cx="57" cy="57" r="2" fill="${ink}"/>`;
        if (bg.pattern === 'check') drawing = `<path d="M0 0H30V30H0ZM30 30H60V60H30Z" fill="${ink}" opacity=".6"/>`;
        if (bg.pattern === 'flowers') drawing = `<g fill="${ink}"><ellipse cx="30" cy="22" rx="5" ry="9"/><ellipse cx="30" cy="38" rx="5" ry="9"/><ellipse cx="22" cy="30" rx="9" ry="5"/><ellipse cx="38" cy="30" rx="9" ry="5"/></g><circle cx="30" cy="30" r="5" fill="#dfbc6d"/>`;
        if (bg.pattern === 'paper') drawing = `<path d="M0 59H60" stroke="${ink}" stroke-width="2"/><circle cx="10" cy="10" r=".8" fill="#d5c8b5"/>`;
        const size = Math.max(60, width / 10);
        const definitions = `<pattern id="p" width="${size}" height="${size}" patternUnits="userSpaceOnUse" viewBox="0 0 60 60">${drawing}</pattern><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f9dfba"/><stop offset=".5" stop-color="#f3cbd5"/><stop offset="1" stop-color="#cec6ec"/></linearGradient>`;
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${definitions}</defs><rect width="100%" height="100%" fill="${bg.color}"/>${bg.pattern ? `<rect width="100%" height="100%" fill="url(#${bg.pattern === 'gradient' ? 'g' : 'p'})"/>` : ''}</svg>`;
    }

    function backgroundURL(bg, width = 180, height = 180) {
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(backgroundSVG(bg, width, height))}`;
    }

    const imageCache = new Map();
    function image(src) {
        if (!imageCache.has(src)) {
            const promise = new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => { imageCache.delete(src); reject(new Error('An image could not be loaded. Please retake your photos.')); };
                img.src = src;
            });
            imageCache.set(src, promise);
        }
        return imageCache.get(src);
    }

    function crop(ctx, img, x, y, width, height) {
        const scale = Math.max(width / img.width, height / img.height);
        const sw = width / scale, sh = height / scale;
        ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, width, height);
    }

    function captionLines(ctx, text, maxWidth) {
        const lines = [];
        let line = '';
        for (const character of Array.from(text.trim().replace(/\s+/g, ' '))) {
            if (ctx.measureText(line + character).width > maxWidth && line) {
                lines.push(line.trim());
                line = character;
            } else line += character;
        }
        if (line.trim()) lines.push(line.trim());
        return lines;
    }

    async function render(state) {
        const layout = layouts[state.layout];
        const bg = backgrounds.find(item => item.id === state.background);
        const canvas = document.createElement('canvas');
        canvas.width = layout.width;
        canvas.height = layout.height;
        const ctx = canvas.getContext('2d');
        const loaded = await Promise.all([image(backgroundURL(bg, canvas.width, canvas.height)), ...state.photos.slice(0, layout.count).map(image)]);
        ctx.drawImage(loaded[0], 0, 0);
        const padding = layout.width * .055;
        const gap = layout.width * .035;
        const text = state.showText ? state.text.trim() : '';
        const fontSize = layout.width * (state.layout === 'portrait' ? .052 : .038);
        ctx.font = `${fontSize}px Georgia, serif`;
        const lines = text ? captionLines(ctx, text, layout.width - padding * 3) : [];
        const footer = Math.max(layout.width * .12, padding + lines.length * fontSize * 1.35 + (state.showDate ? fontSize * 1.65 : 0));
        const photoWidth = (layout.width - padding * 2 - gap * (layout.columns - 1)) / layout.columns;
        const photoHeight = (layout.height - padding - footer - gap * (layout.rows - 1)) / layout.rows;
        for (let i = 0; i < layout.count; i++) {
            const x = padding + (i % layout.columns) * (photoWidth + gap);
            const y = padding + Math.floor(i / layout.columns) * (photoHeight + gap);
            if (loaded[i + 1]) crop(ctx, loaded[i + 1], x, y, photoWidth, photoHeight);
            else {
                ctx.fillStyle = bg.light ? '#494557' : '#eee9e8';
                ctx.fillRect(x, y, photoWidth, photoHeight);
                ctx.fillStyle = bg.light ? '#d5cadd' : '#a99aaa';
                ctx.font = `${layout.width * .07}px Georgia, serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(String(i + 1).padStart(2, '0'), x + photoWidth / 2, y + photoHeight / 2);
            }
        }
        if (bg.pattern && (lines.length || state.showDate)) {
            ctx.globalAlpha = .92;
            ctx.fillStyle = bg.color;
            ctx.fillRect(padding * .6, layout.height - footer + padding * .2, layout.width - padding * 1.2, footer - padding * .4);
            ctx.globalAlpha = 1;
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = state.color;
        ctx.font = `${fontSize}px Georgia, serif`;
        let y = layout.height - footer + padding * .65 + fontSize * .5;
        lines.forEach(line => { ctx.fillText(line, layout.width / 2, y); y += fontSize * 1.35; });
        if (state.showDate) {
            ctx.font = `${fontSize * .65}px Arial, sans-serif`;
            const date = new Date(state.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            ctx.fillText(date, layout.width / 2, y + fontSize * .25);
        }
        return canvas;
    }
    // Restart short, CSS-only effects; reduced-motion changes also take effect mid-animation.
    function animate(element, className) {
        element.classList.remove(className);
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        void element.offsetWidth;
        element.classList.add(className);
    }

    return { layouts, backgrounds, load, save, layoutPicker, backgroundURL, render, animate };
})();
