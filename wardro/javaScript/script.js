// Page Navigation System
let currentPage = 1;
let touchStartX = 0;
let touchEndX = 0;

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

document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
}, false);

document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
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

// ── Wardrobe: je Teil eine Liste von Bild-URLs ──
const wardrobe = { head: [], torso: [], legs: [], shoes: [] };
const wardrobeIndex = { head: 0, torso: 0, legs: 0, shoes: 0 };

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

function prevItem() {
    if (!activePart || wardrobe[activePart].length === 0) return;
    wardrobeIndex[activePart] = (wardrobeIndex[activePart] - 1 + wardrobe[activePart].length) % wardrobe[activePart].length;
    document.getElementById('bp_' + activePart).src = wardrobe[activePart][wardrobeIndex[activePart]];
}

function nextItem() {
    if (!activePart || wardrobe[activePart].length === 0) return;
    wardrobeIndex[activePart] = (wardrobeIndex[activePart] + 1) % wardrobe[activePart].length;
    document.getElementById('bp_' + activePart).src = wardrobe[activePart][wardrobeIndex[activePart]];
}

// ==================== UPLOAD & IMAGE PROCESSING ====================

document.addEventListener('DOMContentLoaded', () => {
    const uploadBox = document.getElementById('uploadBox');
    const imageInput = document.getElementById('imageInput');
    const cameraBtn = document.getElementById('cameraBtn');
    const galleryBtn = document.getElementById('galleryBtn');
    
    uploadBox.addEventListener('click', () => {
        if (imageInput.hasAttribute('capture')) imageInput.removeAttribute('capture');
        imageInput.click();
    });
    
    if (cameraBtn) {
        cameraBtn.addEventListener('click', () => {
            imageInput.setAttribute('capture', 'environment');
            imageInput.click();
        });
    }
    
    if (galleryBtn) {
        galleryBtn.addEventListener('click', () => {
            if (imageInput.hasAttribute('capture')) imageInput.removeAttribute('capture');
            imageInput.click();
        });
    }

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleImageUpload(file);
        }
        if (imageInput.hasAttribute('capture')) imageInput.removeAttribute('capture');
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
        if (file && file.type.startsWith('image/')) {
            handleImageUpload(file);
        }
    });
});

let segmenter = null;

async function initSegmentation() {
    if (segmenter) return;
    try {
        const net = await bodySegmentation.load(bodySegmentation.SupportedModels.BodyPix, {
            architecture: 'MobileNetV1',
            outputStride: 16,
            multiplier: 0.75,
            quantBytes: 2,
        });
        segmenter = net;
        console.log('Segmentation model loaded');
    } catch (error) {
        console.error('Error loading segmentation model:', error);
    }
}

async function handleImageUpload(file) {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
        const img = new Image();
        img.onload = async () => {
            await initSegmentation();
            const processedCanvas = await removeBackground(img);
            showPreview(processedCanvas);
        };
        img.src = e.target.result;
    };
    
    reader.readAsDataURL(file);
}

async function removeBackground(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    if (!segmenter) {
        return canvas;
    }
    
    try {
        const segmentation = await segmenter.segmentPeople(canvas);
        
        if (segmentation.length === 0) {
            console.warn('No person detected, returning original image');
            return canvas;
        }
        
        const foregroundColor = { r: 0, g: 0, b: 0, a: 0 };
        const backgroundColor = { r: 0, g: 0, b: 0, a: 0 };
        
        const mask = await bodySegmentation.toBinaryMask(segmentation, foregroundColor, backgroundColor);
        
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = canvas.width;
        outputCanvas.height = canvas.height;
        const outputCtx = outputCanvas.getContext('2d');
        
        outputCtx.drawImage(canvas, 0, 0);
        
        const imageData = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
        const data = imageData.data;
        const maskData = mask.data;
        
        for (let i = 0; i < maskData.length; i++) {
            if (maskData[i] === 0) {
                data[i * 4 + 3] = 0;
            }
        }
        
        outputCtx.putImageData(imageData, 0, 0);
        return outputCanvas;
    } catch (error) {
        console.error('Error in segmentation:', error);
        return canvas;
    }
}

function showPreview(canvas) {
    const uploadBox = document.getElementById('uploadBox');
    const preview = document.getElementById('preview');
    const previewImg = document.getElementById('processedImage');
    
    uploadBox.style.display = 'none';
    preview.style.display = 'block';
    
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        previewImg.src = url;
        preview.innerHTML = '';
        preview.appendChild(previewImg);
        previewImg.style.display = 'block';
        previewImg.style.width = '100%';
        previewImg.style.height = '100%';
        previewImg.style.objectFit = 'contain';
    });
}