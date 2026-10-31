const state = Booth.load();
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const photoStrip = document.getElementById('photoStrip');
const takePhotoBtn = document.getElementById('takePhotoBtn');
const editorBtn = document.getElementById('goToEditorBtn');
const cameraMessage = document.getElementById('cameraMessage');
const retryCameraBtn = document.getElementById('retryCameraBtn');
const statusMessage = document.getElementById('cameraStatus');
let stream;
let ready = false;
let starting = false;

function persist() {
    const saved = Booth.save(state);
    if (!saved) statusMessage.textContent = 'Your browser could not save these photos. Free some browser storage or enable site storage, then try again.';
    return saved;
}

function update() {
    const layout = Booth.layouts[state.layout];
    const count = Math.min(state.photos.length, layout.count);
    photoStrip.replaceChildren();
    photoStrip.dataset.layout = state.layout;
    for (let i = 0; i < layout.count; i++) {
        const slot = document.createElement('div');
        slot.className = 'snapshot';
        if (state.photos[i]) {
            const img = document.createElement('img');
            img.src = state.photos[i];
            img.alt = `Snapshot ${i + 1}`;
            const remove = document.createElement('button');
            remove.className = 'remove-photo';
            remove.setAttribute('aria-label', `Remove photo ${i + 1}`);
            remove.textContent = '×';
            remove.addEventListener('click', () => { state.photos.splice(i, 1); persist(); update(); });
            slot.append(img, remove);
        } else slot.textContent = String(i + 1).padStart(2, '0');
        photoStrip.appendChild(slot);
    }
    document.getElementById('photoCount').textContent = `${count} / ${layout.count}`;
    takePhotoBtn.disabled = !ready || count >= layout.count;
    editorBtn.disabled = count < layout.count;
    document.getElementById('retakeBtn').disabled = state.photos.length === 0;
    document.getElementById('captureHint').textContent = count >= layout.count ? 'Looking good! Time for the finishing touches.' : `Ready when you are. Photo ${count + 1} of ${layout.count}.`;
    document.getElementById('sessionHint').textContent = count >= layout.count ? 'All set! Let’s give these memories a frame.' : `${layout.count - count} more ${layout.count - count === 1 ? 'photo' : 'photos'} to make your ${layout.name.toLowerCase()} complete.`;
}

async function startWebcam() {
    if (starting) return;
    starting = true;
    ready = false;
    update();
    retryCameraBtn.hidden = true;
    cameraMessage.hidden = false;
    cameraMessage.querySelector('strong').textContent = 'Getting your camera ready…';
    cameraMessage.querySelector('span:last-child').textContent = 'Allow camera access to get started.';
    try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unavailable');
        stream?.getTracks().forEach(track => track.stop());
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
        video.srcObject = stream;
        await video.play();
        ready = video.videoWidth > 0;
        cameraMessage.hidden = ready;
        stream.getVideoTracks()[0].addEventListener('ended', () => {
            ready = false;
            cameraMessage.hidden = false;
            cameraMessage.querySelector('strong').textContent = 'Your camera has disconnected';
            cameraMessage.querySelector('span:last-child').textContent = 'Reconnect your camera and try again.';
            retryCameraBtn.hidden = false;
            update();
        });
    } catch (error) {
        stream?.getTracks().forEach(track => track.stop());
        cameraMessage.querySelector('strong').textContent = 'Let’s get you back in the frame';
        cameraMessage.querySelector('span:last-child').textContent = error.name === 'NotAllowedError' ? 'Allow camera access in your browser’s site settings, then try again.' : error.name === 'NotFoundError' ? 'No camera found. Connect a camera and try again.' : 'Could not start the camera. Use HTTPS or localhost and check that your camera is available.';
        retryCameraBtn.hidden = false;
    } finally {
        starting = false;
        update();
    }
}

function takePhoto() {
    if (!ready || !video.videoWidth || state.photos.length >= Booth.layouts[state.layout].count) return;
    const scale = Math.min(1, 1200 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (!state.photos.length) state.date = new Date().toISOString();
    state.photos.push(canvas.toDataURL('image/jpeg', .9));
    statusMessage.textContent = '';
    persist();
    Booth.animate(document.getElementById('flash'), 'animate');
    update();
    Booth.animate(photoStrip.children[state.photos.length - 1], 'snapshot-new');
    Booth.animate(document.getElementById('photoCount'), 'count-pop');
    if (!editorBtn.disabled) Booth.animate(editorBtn, 'session-ready');
}

Booth.layoutPicker(document.getElementById('layoutOptions'), state.layout, layout => { state.layout = layout; persist(); update(); });
takePhotoBtn.addEventListener('click', takePhoto);
retryCameraBtn.addEventListener('click', startWebcam);
document.getElementById('retakeBtn').addEventListener('click', () => { state.photos = []; statusMessage.textContent = ''; persist(); update(); });
editorBtn.addEventListener('click', () => {
    if (state.photos.length < Booth.layouts[state.layout].count || !persist()) return;
    stream?.getTracks().forEach(track => track.stop());
    window.location.href = 'editPhoto.html';
});
window.addEventListener('pagehide', () => { ready = false; stream?.getTracks().forEach(track => track.stop()); });
window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    Object.assign(state, Booth.load());
    document.querySelectorAll('.layout-option').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.layout === state.layout)));
    startWebcam();
});
update();
startWebcam();
