// Page Navigation System
let currentPage = 1;
let touchStartX = 0;
let touchEndX = 0;
let swipeBlocked = false;

const pages = document.querySelectorAll('.page');
const dots = document.querySelectorAll('.dot');
const SWIPE_THRESHOLD = 50;

function updateDots() {
    dots.forEach((dot, index) => {
        dot.classList.remove('active');
        if (index === currentPage) {
            dot.classList.add('active');
        }
    });
}

function goToPage(pageIndex) {
    if (pageIndex < 0 || pageIndex >= pages.length) return;

    pages.forEach(page => {
        page.classList.remove('next', 'prev', 'active');
    });

    pages.forEach((page, index) => {
        if (index !== pageIndex) {
            if (index > pageIndex) {
                page.classList.add('next');
            } else {
                page.classList.add('prev');
            }
        }
    });

    currentPage = pageIndex;
    pages[currentPage].classList.add('active');

    updateDots();
}

function overlayOpen() {
    return !document.getElementById('sheet').hidden || !document.getElementById('viewer').hidden;
}

document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    swipeBlocked = overlayOpen();
}, false);

document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    if (!swipeBlocked && !overlayOpen()) handleSwipe();
}, false);

function handleSwipe() {
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > SWIPE_THRESHOLD) {
        if (diff > 0) {
            goToPage(currentPage + 1);
        } else {
            goToPage(currentPage - 1);
        }
    }
}

dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
        goToPage(index);
    });
});

document.addEventListener('keydown', (e) => {
    if (overlayOpen()) {
        if (e.key === 'Escape') { closeSheet(); closeViewer(); }
        return;
    }
    if (e.key === 'ArrowLeft') {
        goToPage(currentPage - 1);
    } else if (e.key === 'ArrowRight') {
        goToPage(currentPage + 1);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    pages.forEach(page => {
        page.style.transition = 'none';
    });

    goToPage(currentPage);

    setTimeout(() => {
        pages.forEach(page => {
            page.style.transition = 'left 0.4s ease-in-out';
        });
    }, 50);
});

// ==================== KLEIDERSCHRANK (lokal) ====================

const PARTS = ['head', 'torso', 'legs', 'shoes'];
const CATEGORY_NAMES = {
    head: 'Kopf', torso: 'Oberteil', legs: 'Hose', shoes: 'Schuhe', accessory: 'Accessoire',
};
const MAX_ACCESSORIES = 5;

// Platzhalter-Bilder der Körperteile (werden angezeigt, solange nichts gewählt ist)
const PLACEHOLDERS = {};

// wardrobe[part] = Liste von { id, category, blob, url, created }
const wardrobe = { head: [], torso: [], legs: [], shoes: [], accessory: [] };
// -1 = kein Teil (Platzhalter), sonst Index in wardrobe[part]
const wardrobeIndex = { head: -1, torso: -1, legs: -1, shoes: -1 };
let selectedAccessories = []; // Item-IDs, max. 5

let activePart = null;

function bodyTouched(part) {
    const leftBtn  = document.getElementById('left-btn');
    const rightBtn = document.getElementById('right-btn');

    // Gleiches Teil nochmal → Pfeile togglen
    if (activePart === part) {
        leftBtn.classList.toggle('show');
        rightBtn.classList.toggle('show');
        document.getElementById('bp_' + part).classList.toggle('active');
        if (!leftBtn.classList.contains('show')) activePart = null;
        return;
    }

    // Altes Teil deaktivieren
    if (activePart) {
        document.getElementById('bp_' + activePart).classList.remove('active');
    }

    activePart = part;
    document.getElementById('bp_' + part).classList.add('active');
    leftBtn.classList.add('show');
    rightBtn.classList.add('show');
}

// Reihenfolge beim Durchblättern: Teil 1 … Teil n, dann "nichts" (Platzhalter)
function stepIndex(part, dir) {
    const n = wardrobe[part].length;
    if (n === 0) return -1;
    let i = wardrobeIndex[part] + dir;
    if (i >= n) i = -1;
    if (i < -1) i = n - 1;
    return i;
}

function prevItem() {
    if (!activePart || wardrobe[activePart].length === 0) return;
    setPart(activePart, stepIndex(activePart, -1), -1);
}

function nextItem() {
    if (!activePart || wardrobe[activePart].length === 0) return;
    setPart(activePart, stepIndex(activePart, 1), 1);
}

// Zeigt ein Teil an. dir: 1 = von rechts reinsliden, -1 = von links, 0 = ohne Animation
async function setPart(part, index, dir = 0) {
    const img = document.getElementById('bp_' + part);
    wardrobeIndex[part] = index;
    saveSelection();

    const item = index >= 0 ? wardrobe[part][index] : null;
    const apply = () => {
        img.src = item ? item.url : PLACEHOLDERS[part];
        img.classList.toggle('has-item', !!item);
    };

    if (!dir || !img.animate) { apply(); return; }

    const dist = 35 * dir; // vw
    try {
        await img.animate(
            [{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${-dist}vw)`, opacity: 0 }],
            { duration: 170, easing: 'ease-in' }
        ).finished;
    } catch (e) {}
    apply();
    img.animate(
        [{ transform: `translateX(${dist}vw)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }],
        { duration: 240, easing: 'cubic-bezier(.2,.9,.3,1.15)' }
    );
}

function randomOutfit() {
    let any = false;
    PARTS.forEach((part, i) => {
        const n = wardrobe[part].length;
        if (n === 0) return;
        any = true;
        let idx = Math.floor(Math.random() * n);
        if (n > 1 && idx === wardrobeIndex[part]) idx = (idx + 1) % n;
        setTimeout(() => setPart(part, idx, 1), i * 70);
    });
    if (!any) toast('Lade zuerst Kleidung hoch');
}

// Aktuelle Auswahl merken (nur Komfort, darf fehlschlagen)
function saveSelection() {
    try {
        const sel = { accessories: selectedAccessories };
        PARTS.forEach(p => { sel[p] = wardrobeIndex[p] >= 0 ? wardrobe[p][wardrobeIndex[p]].id : null; });
        localStorage.setItem('wardro_selection', JSON.stringify(sel));
    } catch (e) {}
}

function loadSelection() {
    let sel = null;
    try { sel = JSON.parse(localStorage.getItem('wardro_selection')); } catch (e) {}
    applySelection(sel, true);
}

// sel = { head: id|null, torso, legs, shoes, accessories: [ids] }
function applySelection(sel, firstLoad = false) {
    PARTS.forEach(p => {
        let idx = -1;
        if (sel && sel[p]) idx = wardrobe[p].findIndex(it => it.id === sel[p]);
        else if (firstLoad && !sel && wardrobe[p].length) idx = 0;
        setPart(p, idx, firstLoad ? 0 : 1);
    });
    const accIds = new Set(wardrobe.accessory.map(a => a.id));
    selectedAccessories = ((sel && sel.accessories) || []).filter(id => accIds.has(id)).slice(0, MAX_ACCESSORIES);
    renderAccessories();
    saveSelection();
}

async function loadWardrobe() {
    const items = await LocalDB.getAll('items');
    items.sort((a, b) => a.created - b.created);
    Object.keys(wardrobe).forEach(k => {
        wardrobe[k].forEach(it => URL.revokeObjectURL(it.url));
        wardrobe[k] = [];
    });
    items.forEach(it => {
        if (!wardrobe[it.category]) return;
        it.url = URL.createObjectURL(it.blob);
        wardrobe[it.category].push(it);
    });
}

// ==================== ACCESSOIRES ====================

function renderAccessories() {
    const row = document.getElementById('accessoryRow');
    row.innerHTML = '';
    selectedAccessories.forEach((id, i) => {
        const item = wardrobe.accessory.find(a => a.id === id);
        if (!item) return;
        const slot = document.createElement('button');
        slot.type = 'button';
        slot.className = 'acc-slot filled';
        slot.setAttribute('aria-label', 'Accessoire ' + (i + 1) + ' ändern');
        const img = document.createElement('img');
        img.src = item.url;
        img.alt = '';
        slot.appendChild(img);
        slot.addEventListener('click', () => openAccessorySheet(i));
        row.appendChild(slot);
    });
    if (selectedAccessories.length < MAX_ACCESSORIES) {
        const plus = document.createElement('button');
        plus.type = 'button';
        plus.className = 'acc-slot plus';
        plus.setAttribute('aria-label', 'Accessoire hinzufügen');
        plus.textContent = '+';
        plus.addEventListener('click', () => openAccessorySheet(null));
        row.appendChild(plus);
    }
}

// slotIndex = null → neues Accessoire, sonst bestehendes ändern
function openAccessorySheet(slotIndex) {
    const grid = document.getElementById('sheetGrid');
    const actions = document.getElementById('sheetActions');
    document.getElementById('sheetTitle').textContent =
        slotIndex === null ? 'Neues Accessoire' : 'Accessoire tauschen';
    grid.innerHTML = '';
    actions.innerHTML = '';

    const available = wardrobe.accessory.filter(a =>
        !selectedAccessories.includes(a.id) || selectedAccessories[slotIndex] === a.id);

    if (wardrobe.accessory.length === 0) {
        grid.innerHTML = '<p class="sheet-empty">Noch keine Accessoires. Lade zuerst eins hoch.</p>';
        actions.appendChild(sheetButton('Hochladen', () => { closeSheet(); goToPage(0); }, true));
    } else if (available.length === 0) {
        grid.innerHTML = '<p class="sheet-empty">Alle Accessoires sind schon dabei.</p>';
    }

    available.forEach(item => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'sheet-item' + (selectedAccessories[slotIndex] === item.id ? ' selected' : '');
        const img = document.createElement('img');
        img.src = item.url;
        img.alt = 'Accessoire';
        b.appendChild(img);
        b.addEventListener('click', () => {
            if (slotIndex === null) selectedAccessories.push(item.id);
            else selectedAccessories[slotIndex] = item.id;
            renderAccessories();
            saveSelection();
            closeSheet();
        });
        grid.appendChild(b);
    });

    if (slotIndex !== null) {
        actions.appendChild(sheetButton('Entfernen', () => {
            selectedAccessories.splice(slotIndex, 1);
            renderAccessories();
            saveSelection();
            closeSheet();
        }));
    }
    actions.appendChild(sheetButton('Abbrechen', closeSheet));
    document.getElementById('sheet').hidden = false;
}

function sheetButton(label, onClick, primary = false) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (primary) b.className = 'primary';
    b.addEventListener('click', onClick);
    return b;
}

function closeSheet() {
    document.getElementById('sheet').hidden = true;
}

// ==================== OUTFIT SPEICHERN ====================

// Rechteck, in dem ein <img> mit object-fit: contain tatsächlich gezeichnet wird
function containedRect(img) {
    const r = img.getBoundingClientRect();
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (!iw || !ih) return r;
    const s = Math.min(r.width / iw, r.height / ih);
    const w = iw * s, h = ih * s;
    return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
}

async function saveOutfit() {
    const layers = [];
    PARTS.forEach(p => {
        const img = document.getElementById('bp_' + p);
        if (img.classList.contains('has-item')) layers.push({ img, rect: containedRect(img) });
    });
    document.querySelectorAll('#accessoryRow .acc-slot.filled img').forEach(img => {
        layers.push({ img, rect: containedRect(img) });
    });
    if (layers.length === 0) { toast('Zuerst Kleidung aussuchen'); return; }

    // Gemeinsamer Rahmen um alle Teile + Rand
    const pad = 24;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    layers.forEach(({ rect }) => {
        minX = Math.min(minX, rect.left); minY = Math.min(minY, rect.top);
        maxX = Math.max(maxX, rect.left + rect.width); maxY = Math.max(maxY, rect.top + rect.height);
    });
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;

    const scale = Math.max(2, window.devicePixelRatio || 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round((maxX - minX) * scale);
    canvas.height = Math.round((maxY - minY) * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    layers.forEach(({ img, rect }) => {
        ctx.drawImage(img, (rect.left - minX) * scale, (rect.top - minY) * scale, rect.width * scale, rect.height * scale);
    });

    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    const parts = {};
    PARTS.forEach(p => { parts[p] = wardrobeIndex[p] >= 0 ? wardrobe[p][wardrobeIndex[p]].id : null; });
    await LocalDB.put('outfits', {
        id: LocalDB.newId(), blob, created: Date.now(), parts, accessories: [...selectedAccessories],
    });

    const btn = document.getElementById('saveOutfitBtn');
    btn.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300 });
    toast('Outfit gespeichert');
    renderOutfits();
}

// ==================== SEITE 3: GESPEICHERTE OUTFITS ====================

let outfitUrls = [];
let viewerOutfit = null;

async function renderOutfits() {
    const grid = document.getElementById('outfitGrid');
    const outfits = await LocalDB.getAll('outfits');
    outfits.sort((a, b) => b.created - a.created);
    outfitUrls.forEach(u => URL.revokeObjectURL(u));
    outfitUrls = [];
    grid.innerHTML = '';

    if (outfits.length === 0) {
        grid.innerHTML = '<p class="empty-hint">Noch keine Outfits gespeichert.<br>Stell eins zusammen und tippe auf Speichern.</p>';
        return;
    }
    outfits.forEach(o => {
        const url = URL.createObjectURL(o.blob);
        outfitUrls.push(url);
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'outfit-card';
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Outfit vom ' + new Date(o.created).toLocaleDateString('de-AT');
        card.appendChild(img);
        card.addEventListener('click', () => openViewer(o, url));
        grid.appendChild(card);
    });
}

function openViewer(outfit, url) {
    viewerOutfit = outfit;
    document.getElementById('viewerImg').src = url;
    document.getElementById('viewer').hidden = false;
}

function closeViewer() {
    document.getElementById('viewer').hidden = true;
    viewerOutfit = null;
}

async function deleteViewerOutfit() {
    if (!viewerOutfit) return;
    if (!confirm('Dieses Outfit löschen?')) return;
    await LocalDB.remove('outfits', viewerOutfit.id);
    closeViewer();
    renderOutfits();
}

function wearViewerOutfit() {
    if (!viewerOutfit) return;
    const sel = { ...viewerOutfit.parts, accessories: viewerOutfit.accessories };
    closeViewer();
    goToPage(1);
    setTimeout(() => applySelection(sel), 350);
}

async function shareViewerOutfit() {
    if (!viewerOutfit) return;
    const file = new File([viewerOutfit.blob], 'wardro-outfit.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Mein Outfit' }); } catch (e) {}
        return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ==================== UPLOAD & KI ====================

let pending = null; // { canvas, category }

document.addEventListener('DOMContentLoaded', () => {
    const uploadBox = document.getElementById('uploadBox');
    const imageInput = document.getElementById('imageInput');

    uploadBox.addEventListener('click', () => {
        if (imageInput.hasAttribute('capture')) imageInput.removeAttribute('capture');
        imageInput.click();
    });

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleImageUpload(file);
        imageInput.value = '';
    });

    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.style.borderColor = 'rgba(255, 255, 255, 0.8)';
    });
    uploadBox.addEventListener('dragleave', () => {
        uploadBox.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    });
    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) handleImageUpload(file);
    });

    document.getElementById('saveItemBtn').addEventListener('click', savePendingItem);
    document.getElementById('discardBtn').addEventListener('click', resetUpload);
});

function setStatus(text) {
    document.getElementById('processStatus').textContent = text;
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

// Bild auf max. 1024 px verkleinern (schont den Handy-Speicher)
function toCanvas(img, maxSize = 1024) {
    const s = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
}

// Durchsichtigen Rand abschneiden, damit das Teil seinen Platz ausfüllt
function trimCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] > 20) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX < 0) return canvas;
    const out = document.createElement('canvas');
    out.width = maxX - minX + 1;
    out.height = maxY - minY + 1;
    out.getContext('2d').drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return out;
}

function showProcessing(on) {
    document.getElementById('uploadBox').hidden = on;
    document.getElementById('processView').hidden = !on;
}

async function handleImageUpload(file) {
    showProcessing(true);
    pending = { canvas: null, category: null };
    const myPending = pending;
    const previewImg = document.getElementById('processedImage');
    document.getElementById('categoryChips').hidden = true;
    document.getElementById('uploadActions').hidden = true;

    let img;
    try {
        img = await loadImage(file);
    } catch (e) {
        setStatus('Bild konnte nicht geladen werden');
        document.getElementById('uploadActions').hidden = false;
        document.getElementById('saveItemBtn').hidden = true;
        return;
    }
    const source = toCanvas(img);
    URL.revokeObjectURL(img.src);
    previewImg.src = source.toDataURL('image/jpeg', 0.8);
    previewImg.classList.add('working');

    // 1) Ausschneiden
    setStatus('KI schneidet aus …');
    let cut;
    try {
        cut = await WardroAI.removeBackground(source, p => setStatus(`KI wird geladen (nur beim ersten Mal) … ${p}%`));
        cut = trimCanvas(cut);
    } catch (e) {
        console.error('Ausschneiden fehlgeschlagen', e);
        cut = source;
        toast('Ausschneiden fehlgeschlagen, Originalbild wird verwendet');
    }
    if (pending !== myPending) return; // inzwischen verworfen

    myPending.canvas = cut;
    previewImg.src = cut.toDataURL('image/png');
    previewImg.classList.remove('working');
    renderCategoryChips(null);
    document.getElementById('categoryChips').hidden = false;
    document.getElementById('uploadActions').hidden = false;
    document.getElementById('saveItemBtn').hidden = false;

    // 2) Kategorie vorschlagen
    setStatus('KI erkennt die Kategorie …');
    try {
        const { category } = await WardroAI.classify(cut, p => setStatus(`KI wird geladen (nur beim ersten Mal) … ${p}%`));
        if (pending !== myPending) return;
        if (!myPending.category) {
            myPending.category = category;
            renderCategoryChips(category);
        }
        setStatus('KI-Vorschlag: ' + CATEGORY_NAMES[category]);
    } catch (e) {
        console.error('Kategorie-Erkennung fehlgeschlagen', e);
        if (pending === myPending) setStatus('Kategorie antippen');
    }
}

function renderCategoryChips(suggested) {
    const wrap = document.getElementById('categoryChips');
    wrap.innerHTML = '';
    Object.entries(CATEGORY_NAMES).forEach(([key, name]) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip' + (pending && pending.category === key ? ' selected' : '');
        if (key === suggested) chip.classList.add('suggested');
        chip.textContent = name;
        chip.addEventListener('click', () => {
            pending.category = key;
            wrap.querySelectorAll('.chip').forEach(c => c.classList.toggle('selected', c === chip));
        });
        wrap.appendChild(chip);
    });
}

async function savePendingItem() {
    if (!pending || !pending.canvas) return;
    if (!pending.category) { toast('Kategorie antippen'); return; }
    const blob = await new Promise(res => pending.canvas.toBlob(res, 'image/png'));
    const item = { id: LocalDB.newId(), category: pending.category, blob, created: Date.now() };
    await LocalDB.put('items', item);
    item.url = URL.createObjectURL(blob);
    wardrobe[item.category].push(item);

    // Neues Teil gleich anziehen
    if (PARTS.includes(item.category)) {
        setPart(item.category, wardrobe[item.category].length - 1);
    } else if (selectedAccessories.length < MAX_ACCESSORIES) {
        selectedAccessories.push(item.id);
        renderAccessories();
        saveSelection();
    }
    toast(CATEGORY_NAMES[item.category] + ' gespeichert');
    resetUpload();
    renderCloset();
}

function resetUpload() {
    pending = null;
    setStatus('');
    document.getElementById('processedImage').removeAttribute('src');
    showProcessing(false);
}

// ==================== KLEIDERSCHRANK-ÜBERSICHT (Seite 1) ====================

function renderCloset() {
    const closet = document.getElementById('closet');
    closet.innerHTML = '';
    const total = Object.values(wardrobe).reduce((n, l) => n + l.length, 0);
    if (total === 0) return;

    const h = document.createElement('h2');
    h.textContent = 'Dein Kleiderschrank';
    closet.appendChild(h);

    Object.entries(CATEGORY_NAMES).forEach(([key, name]) => {
        if (wardrobe[key].length === 0) return;
        const label = document.createElement('h3');
        label.textContent = `${name} (${wardrobe[key].length})`;
        closet.appendChild(label);
        const row = document.createElement('div');
        row.className = 'closet-row';
        wardrobe[key].forEach(item => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'closet-item';
            b.setAttribute('aria-label', name + ' löschen');
            const img = document.createElement('img');
            img.src = item.url;
            img.alt = name;
            b.appendChild(img);
            b.addEventListener('click', () => deleteItem(item));
            row.appendChild(b);
        });
        closet.appendChild(row);
    });
    const hint = document.createElement('p');
    hint.className = 'closet-hint';
    hint.textContent = 'Antippen zum Entfernen';
    closet.appendChild(hint);
}

async function deleteItem(item) {
    if (!confirm(CATEGORY_NAMES[item.category] + ' löschen?')) return;
    await LocalDB.remove('items', item.id);
    const list = wardrobe[item.category];
    const idx = list.indexOf(item);

    if (PARTS.includes(item.category)) {
        const cur = wardrobeIndex[item.category];
        const curId = cur >= 0 ? list[cur].id : null;
        list.splice(idx, 1);
        const newIdx = curId && curId !== item.id ? list.findIndex(i => i.id === curId) : (list.length ? 0 : -1);
        setPart(item.category, newIdx);
    } else {
        list.splice(idx, 1);
        selectedAccessories = selectedAccessories.filter(id => id !== item.id);
        renderAccessories();
        saveSelection();
    }
    URL.revokeObjectURL(item.url);
    renderCloset();
}

// ==================== ALLGEMEIN ====================

let toastTimer = null;
function toast(text) {
    const t = document.getElementById('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

document.addEventListener('DOMContentLoaded', async () => {
    PARTS.forEach(p => { PLACEHOLDERS[p] = document.getElementById('bp_' + p).getAttribute('src'); });

    // Der Seiten-Container darf nie selbst scrollen (sonst verrutschen die Seiten,
    // z. B. wenn der Browser einen Button ins Bild holt)
    const container = document.querySelector('.pages-container');
    container.addEventListener('scroll', () => {
        if (container.scrollLeft || container.scrollTop) container.scrollTo(0, 0);
    });

    document.getElementById('left-btn').addEventListener('click', prevItem);
    document.getElementById('right-btn').addEventListener('click', nextItem);
    document.getElementById('randomBtn').addEventListener('click', randomOutfit);
    document.getElementById('saveOutfitBtn').addEventListener('click', saveOutfit);

    document.getElementById('sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });
    document.getElementById('viewerClose').addEventListener('click', closeViewer);
    document.getElementById('viewerDelete').addEventListener('click', deleteViewerOutfit);
    document.getElementById('viewerWear').addEventListener('click', wearViewerOutfit);
    document.getElementById('viewerShare').addEventListener('click', shareViewerOutfit);

    try {
        await loadWardrobe();
    } catch (e) {
        console.error('Speicher konnte nicht geladen werden', e);
        toast('Lokaler Speicher geht nicht');
    }
    loadSelection();
    renderCloset();
    renderOutfits().catch(() => {});
});
