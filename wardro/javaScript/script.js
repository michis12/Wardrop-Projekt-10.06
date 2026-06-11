// Page Navigation System
let currentPage = 1; // Start with main page (middle)
let touchStartX = 0;
let touchEndX = 0;

const pages = document.querySelectorAll('.page');
const dots = document.querySelectorAll('.dot');
const SWIPE_THRESHOLD = 50; // Minimum distance for swipe

// Initialize dots
function updateDots() {
    dots.forEach((dot, index) => {
        dot.classList.remove('active');
        if (index === currentPage) {
            dot.classList.add('active');
        }
    });
}

// Navigate to specific page
function goToPage(pageIndex) {
    if (pageIndex < 0 || pageIndex >= pages.length) return;
    
    const direction = pageIndex > currentPage ? 'next' : 'prev';
    
    // Remove all directional classes
    pages.forEach(page => {
        page.classList.remove('next', 'prev', 'active');
    });
    
    // Set direction class for all pages except the current one
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

// Touch/Swipe handling
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
            // Swipe left - go to next page
            goToPage(currentPage + 1);
        } else {
            // Swipe right - go to previous page
            goToPage(currentPage - 1);
        }
    }
}

// Dot click handling
dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
        goToPage(index);
    });
});

// Keyboard navigation (optional - for testing)
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
        goToPage(currentPage - 1);
    } else if (e.key === 'ArrowRight') {
        goToPage(currentPage + 1);
    }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Disable transitions during initial setup
    pages.forEach(page => {
        page.style.transition = 'none';
    });
    
    // Set initial page positions
    goToPage(currentPage);
    
    // Re-enable transitions after initial setup
    setTimeout(() => {
        pages.forEach(page => {
            page.style.transition = 'left 0.4s ease-in-out';
        });
    }, 50);
});
function bodyTouched(pageIndex) {
    const bp = document.getElementById('bp_1');
    const leftBtn = document.getElementById('left-btn');
    const rightBtn = document.getElementById('right-btn');
    
    // Toggle active state
    bp.classList.toggle('active');
    leftBtn.classList.toggle('show');
    rightBtn.classList.toggle('show');
}

// ==================== UPLOAD & IMAGE PROCESSING ====================

// Initialize upload functionality
document.addEventListener('DOMContentLoaded', () => {
    const uploadBox = document.getElementById('uploadBox');
    const imageInput = document.getElementById('imageInput');
    
    // Click on box to open file input
    uploadBox.addEventListener('click', () => {
        imageInput.click();
    });
    
    // Handle file selection
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleImageUpload(file);
        }
    });
    
    // Drag and drop
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

// Load TensorFlow model
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

// Main image processing function
async function handleImageUpload(file) {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
        const img = new Image();
        img.onload = async () => {
            // Initialize segmentation model
            await initSegmentation();
            
            // Process the image
            const processedCanvas = await removeBackground(img);
            
            // Show preview
            showPreview(processedCanvas);
        };
        img.src = e.target.result;
    };
    
    reader.readAsDataURL(file);
}

// Remove background and segment image
async function removeBackground(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    if (!segmenter) {
        // Fallback: just return the original image if model not loaded
        return canvas;
    }
    
    try {
        // Segment the image
        const segmentation = await segmenter.segmentPeople(canvas);
        
        if (segmentation.length === 0) {
            console.warn('No person detected, returning original image');
            return canvas;
        }
        
        // Create mask for the foreground (person)
        const foregroundColor = { r: 0, g: 0, b: 0, a: 0 };
        const backgroundColor = { r: 0, g: 0, b: 0, a: 0 };
        
        const mask = await bodySegmentation.toBinaryMask(segmentation, foregroundColor, backgroundColor);
        
        // Create output canvas with transparency
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = canvas.width;
        outputCanvas.height = canvas.height;
        const outputCtx = outputCanvas.getContext('2d');
        
        // Draw original image
        outputCtx.drawImage(canvas, 0, 0);
        
        // Apply mask
        const imageData = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
        const data = imageData.data;
        const maskData = mask.data;
        
        for (let i = 0; i < maskData.length; i++) {
            if (maskData[i] === 0) {
                // Transparent where background (i * 4 because RGBA)
                data[i * 4 + 3] = 0;
            }
        }
        
        outputCtx.putImageData(imageData, 0, 0);
        
        return outputCanvas;
    } catch (error) {
        console.error('Error in segmentation:', error);
        return canvas; // Return original if error
    }
}

// Show preview of processed image
function showPreview(canvas) {
    const uploadBox = document.getElementById('uploadBox');
    const preview = document.getElementById('preview');
    const previewImg = document.getElementById('processedImage');
    
    // Hide upload box, show preview
    uploadBox.style.display = 'none';
    preview.style.display = 'block';
    
    // Create image from canvas
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        previewImg.src = url;
        previewImg.style.display = 'block';
    });
}
