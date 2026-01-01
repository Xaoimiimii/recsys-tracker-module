export class PopupDisplay {
    constructor(_domainKey, _slotName, _apiBaseUrl, config = {}, recommendationGetter) {
        this.popupTimeout = null;
        this.autoCloseTimeout = null;
        this.autoSlideTimeout = null;
        this.shadowHost = null;
        this.DEFAULT_MIN_DELAY = 10000; // 10s
        this.DEFAULT_MAX_DELAY = 20000; // 20s
        this.AUTO_SLIDE_DELAY = 5000; // 5s auto slide
        this.recommendationGetter = recommendationGetter;
        this.config = {
            minDelay: config.minDelay || this.DEFAULT_MIN_DELAY,
            maxDelay: config.maxDelay || this.DEFAULT_MAX_DELAY,
            autoCloseDelay: config.autoCloseDelay,
            pages: config.pages || ['*'], // Default show on all pages
        };
    }
    // Bắt đầu schedule popup
    start() {
        this.scheduleNextPopup();
    }
    // Dừng popup
    stop() {
        this.clearTimeouts();
        this.removePopup();
    }
    // Lập lịch hiển thị popup tiếp theo
    scheduleNextPopup() {
        this.clearTimeouts();
        const delay = this.getRandomDelay();
        console.log(`[PopupDisplay] Next popup in ${delay / 1000}s`);
        this.popupTimeout = setTimeout(() => {
            if (this.isPageAllowed(window.location.pathname)) {
                this.showPopup();
            }
            else {
                console.log('[PopupDisplay] Skipped (Page not allowed)');
                this.scheduleNextPopup();
            }
        }, delay);
    }
    // Tính toán delay ngẫu nhiên
    getRandomDelay() {
        const min = this.config.minDelay;
        const max = this.config.maxDelay;
        return Math.floor(Math.random() * (max - min) + min);
    }
    // Kiểm tra page có được phép hiển thị không
    isPageAllowed(currentPath) {
        const allowedPatterns = this.config.pages || [];
        if (allowedPatterns.length === 0 || allowedPatterns.includes('*')) {
            return true;
        }
        return allowedPatterns.some(pattern => {
            if (pattern === '/')
                return currentPath === '/';
            // Hỗ trợ wildcard (vd: /products/*)
            if (pattern.endsWith('/*')) {
                const base = pattern.slice(0, -2);
                return currentPath.startsWith(base);
            }
            return currentPath === pattern;
        });
    }
    // Hiển thị popup
    async showPopup() {
        try {
            const items = await this.fetchRecommendations();
            if (items && items.length > 0) {
                this.renderPopup(items);
                // Auto close nếu có config
                if (this.config.autoCloseDelay) {
                    this.autoCloseTimeout = setTimeout(() => {
                        this.removePopup();
                        this.scheduleNextPopup();
                    }, this.config.autoCloseDelay);
                }
            }
            else {
                // Không có items, schedule lại
                this.scheduleNextPopup();
            }
        }
        catch (error) {
            console.error('[PopupDisplay] Error showing popup:', error);
            this.scheduleNextPopup();
        }
    }
    // Fetch recommendations từ DisplayManager (đã cached)
    async fetchRecommendations() {
        try {
            const items = await this.recommendationGetter();
            return items;
        }
        catch (error) {
            console.error('[PopupDisplay] Error getting recommendations:', error);
            return [];
        }
    }
    // Render popup với Shadow DOM
    renderPopup(items) {
        // Remove existing popup if any
        this.removePopup();
        // Create shadow host
        const host = document.createElement('div');
        host.id = 'recsys-popup-host';
        document.body.appendChild(host);
        const shadow = host.attachShadow({ mode: 'open' });
        // Add styles
        const style = document.createElement('style');
        style.textContent = this.getPopupStyles();
        shadow.appendChild(style);
        // Create popup structure
        const popup = document.createElement('div');
        popup.className = 'recsys-popup';
        popup.innerHTML = `
      <div class="recsys-header">
        Gợi ý dành cho 
        <button class="recsys-close">✕</button>
      </div>
      <div class="recsys-body">
        <button class="recsys-nav recsys-prev">◀</button>
        <div class="recsys-slide"></div>
        <button class="recsys-nav recsys-next">▶</button>
      </div>
    `;
        shadow.appendChild(popup);
        this.shadowHost = host;
        // Setup carousel
        this.setupCarousel(shadow, items);
        // Setup close button
        const closeBtn = shadow.querySelector('.recsys-close');
        closeBtn === null || closeBtn === void 0 ? void 0 : closeBtn.addEventListener('click', () => {
            if (this.autoSlideTimeout) {
                clearTimeout(this.autoSlideTimeout);
                this.autoSlideTimeout = null;
            }
            this.removePopup();
            this.scheduleNextPopup();
        });
    }
    // Setup carousel functionality
    setupCarousel(shadow, items) {
        let currentIndex = 0;
        const slideContainer = shadow.querySelector('.recsys-slide');
        const prevBtn = shadow.querySelector('.recsys-prev');
        const nextBtn = shadow.querySelector('.recsys-next');
        const renderSlide = () => {
            const item = items[currentIndex];
            const title = item.title || 'Sản phẩm';
            const description = item.description || '';
            const img = item.img;
            slideContainer.innerHTML = `
        <div class="recsys-item" data-id="${item.id}" data-domain-item-id="${item.domainItemId}">
          <img src="${img}" alt="${title}" />
          <div class="recsys-name">${title}</div>
          <div class="recsys-description">${description}</div>
        </div>
      `;
        };
        const next = () => {
            currentIndex = (currentIndex + 1) % items.length;
            renderSlide();
            resetAutoSlide();
        };
        const prev = () => {
            currentIndex = (currentIndex - 1 + items.length) % items.length;
            renderSlide();
            resetAutoSlide();
        };
        const resetAutoSlide = () => {
            if (this.autoSlideTimeout) {
                clearTimeout(this.autoSlideTimeout);
            }
            this.autoSlideTimeout = setTimeout(next, this.AUTO_SLIDE_DELAY);
        };
        prevBtn === null || prevBtn === void 0 ? void 0 : prevBtn.addEventListener('click', prev);
        nextBtn === null || nextBtn === void 0 ? void 0 : nextBtn.addEventListener('click', next);
        // Click handler for items
        slideContainer === null || slideContainer === void 0 ? void 0 : slideContainer.addEventListener('click', (e) => {
            const itemEl = e.target.closest('.recsys-item');
            if (itemEl) {
                const itemId = itemEl.getAttribute('data-id');
                console.log('[PopupDisplay] Item clicked:', itemId);
                // TODO: Track click event
            }
        });
        // Start carousel
        renderSlide();
        resetAutoSlide();
    }
    // Remove popup
    removePopup() {
        if (this.shadowHost) {
            this.shadowHost.remove();
            this.shadowHost = null;
        }
    }
    // Clear all timeouts
    clearTimeouts() {
        if (this.popupTimeout) {
            clearTimeout(this.popupTimeout);
            this.popupTimeout = null;
        }
        if (this.autoCloseTimeout) {
            clearTimeout(this.autoCloseTimeout);
            this.autoCloseTimeout = null;
        }
        if (this.autoSlideTimeout) {
            clearTimeout(this.autoSlideTimeout);
            this.autoSlideTimeout = null;
        }
    }
    // Get popup styles
    getPopupStyles() {
        return `
      :host { all: initial; font-family: Arial, sans-serif; }
      * { box-sizing: border-box; }

      .recsys-popup {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 340px;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 4px 28px rgba(0,0,0,0.25);
        z-index: 2147483647;
        overflow: hidden;
        animation: fadeIn 0.3s ease;
        display: flex;
        flex-direction: column;
        border: 1px solid #e0e0e0;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .recsys-header {
        background: #111;
        color: #fff;
        padding: 12px 14px;
        font-size: 15px;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .recsys-close {
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        opacity: 0.8;
        background: none;
        border: none;
        color: white;
        padding: 0;
      }

      .recsys-close:hover {
        opacity: 1;
      }

      .recsys-body {
        position: relative;
        height: 220px;
        background: #fff;
      }

      .recsys-nav {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        font-size: 20px;
        background: rgba(255,255,255,0.8);
        border: 1px solid #ddd;
        cursor: pointer;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
        transition: all 0.2s;
        color: #333;
        padding: 0;
      }

      .recsys-nav:hover {
        background: #fff;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      }

      .recsys-prev {
        left: 10px;
      }

      .recsys-next {
        right: 10px;
      }

      .recsys-slide {
        text-align: center;
        padding: 15px;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .recsys-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }

      .recsys-item img {
        width: 180px;
        height: 130px;
        border-radius: 8px;
        object-fit: cover;
      }

      .recsys-name {
        font-size: 16px;
        font-weight: 600;
        margin: 5px 0 0;
        color: #333;
      }

      .recsys-description {
        font-size: 12px;
        color: #666;
        margin-top: 4px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `;
    }
}
//# sourceMappingURL=popup-display.js.map