const state = Booth.load();
const preview = document.getElementById('photoStrip');
const downloadBtn = document.getElementById('downloadBtn');
const statusMessage = document.getElementById('editorStatus');
const textToggle = document.getElementById('textToggle');
const dateToggle = document.getElementById('dateToggle');
const customText = document.getElementById('customText');
const fontColor = document.getElementById('fontColor');
let renderVersion = 0;
let downloading = false;
let renderedStyle = '';

async function update() {
    const version = ++renderVersion;
    const nextStyle = [state.layout, state.background, state.showText, state.showDate].join('|');
    const missing = Math.max(0, Booth.layouts[state.layout].count - state.photos.length);
    downloadBtn.disabled = true;
    document.getElementById('textControls').hidden = !state.showText;
    document.getElementById('printWrap').dataset.layout = state.layout;
    document.getElementById('backgroundName').textContent = Booth.backgrounds.find(bg => bg.id === state.background).name;
    document.querySelectorAll('.background-option').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.background === state.background)));
    const saved = Booth.save(state);
    statusMessage.textContent = missing ? `Your ${Booth.layouts[state.layout].name.toLowerCase()} needs ${missing} more ${missing === 1 ? 'photo' : 'photos'}. Head back to the camera to finish it.` : saved ? 'Your preview is exactly what you’ll download.' : 'Your changes could not be saved in this browser. You can still download your photo strip.';
    try {
        const rendered = await Booth.render({ ...state, photos: [...state.photos] });
        if (version !== renderVersion) return;
        preview.width = rendered.width;
        preview.height = rendered.height;
        preview.getContext('2d').drawImage(rendered, 0, 0);
        if (renderedStyle && renderedStyle !== nextStyle) Booth.animate(preview, 'preview-refresh');
        renderedStyle = nextStyle;
        preview.setAttribute('aria-label', `${Booth.layouts[state.layout].name} photo strip with ${Booth.backgrounds.find(bg => bg.id === state.background).name} background${state.showText && state.text ? `, caption: ${state.text}` : ''}${state.showDate ? ', date included' : ''}`);
        downloadBtn.disabled = missing > 0 || downloading;
    } catch (error) {
        if (version === renderVersion) statusMessage.textContent = error.message;
    }
}

Booth.layoutPicker(document.getElementById('layoutOptions'), state.layout, layout => { state.layout = layout; update(); });
Booth.backgrounds.forEach(bg => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'background-option';
    button.dataset.background = bg.id;
    button.style.backgroundImage = `url("${Booth.backgroundURL(bg)}")`;
    button.setAttribute('aria-label', bg.name);
    button.title = bg.name;
    button.addEventListener('click', () => {
        const previous = Booth.backgrounds.find(item => item.id === state.background);
        if (bg.light && state.color === '#443b48') state.color = '#fffaf0';
        else if (previous.light && state.color === '#fffaf0') state.color = '#443b48';
        state.background = bg.id;
        fontColor.value = state.color;
        update();
    });
    document.getElementById('backgroundOptions').appendChild(button);
});

textToggle.checked = state.showText;
dateToggle.checked = state.showDate;
customText.value = state.text;
fontColor.value = state.color;
textToggle.addEventListener('change', () => { state.showText = textToggle.checked; update(); if (state.showText) customText.focus(); });
dateToggle.addEventListener('change', () => { state.showDate = dateToggle.checked; update(); });
customText.addEventListener('input', () => { state.text = customText.value; update(); });
fontColor.addEventListener('input', () => { state.color = fontColor.value; update(); });

window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    Object.assign(state, Booth.load());
    textToggle.checked = state.showText;
    dateToggle.checked = state.showDate;
    customText.value = state.text;
    fontColor.value = state.color;
    document.querySelectorAll('.layout-option').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.layout === state.layout)));
    update();
});

downloadBtn.addEventListener('click', async () => {
    if (downloading || downloadBtn.disabled) return;
    downloading = true;
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Saving your moment…';
    try {
        const blob = await new Promise(resolve => preview.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('Your download could not be created. Please try again.');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `little-moments-${state.layout}-${new Date(state.date).toISOString().slice(0, 10)}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        statusMessage.textContent = 'Your memory is ready. Thanks for making a little moment!';
        Booth.animate(document.querySelector('.preview-stage'), 'celebrating');
        Booth.animate(statusMessage, 'download-success');
    } catch (error) {
        statusMessage.textContent = error.message || 'Something went wrong while saving. Please try again.';
    } finally {
        downloading = false;
        downloadBtn.innerHTML = 'Download Photo Strip <span aria-hidden="true">↓</span>';
        downloadBtn.disabled = state.photos.length < Booth.layouts[state.layout].count;
    }
});
update();
