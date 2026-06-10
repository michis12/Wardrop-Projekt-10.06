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