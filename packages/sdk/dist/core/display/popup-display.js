const MOCK_ITEMS = [
    {
        "id": 460, "domainItemId": "444", "title": "Tình Yêu Xanh Lá (juju)", "description": "",
        "img": "https://i.pinimg.com/736x/38/9a/5e/389a5e34f5880fb86115e87561372908.jpg"
    },
    {
        "id": 131, "domainItemId": "107", "title": "How Long", "description": "",
        "img": "https://i.pinimg.com/736x/38/9a/5e/389a5e34f5880fb86115e87561372908.jpg"
    },
    {
        "id": 644, "domainItemId": "629", "title": "Break Free", "description": "",
        "img": "https://i.pinimg.com/736x/38/9a/5e/389a5e34f5880fb86115e87561372908.jpg"
    },
    {
        "id": 194, "domainItemId": "172", "title": "Đẹp Nhất Là Em(Between us)", "description": "",
        "img": "https://i.pinimg.com/736x/38/9a/5e/389a5e34f5880fb86115e87561372908.jpg"
    },
    {
        "id": 68, "domainItemId": "22", "title": "Cho Tôi Lang Thang", "description": "",
        "img": "https://i.pinimg.com/736x/38/9a/5e/389a5e34f5880fb86115e87561372908.jpg"
    },
    {
        "id": 383, "domainItemId": "364", "title": "Nonsense", "description": "",
        "img": "https://i.pinimg.com/736x/38/9a/5e/389a5e34f5880fb86115e87561372908.jpg"
    },
    {
        "id": 84, "domainItemId": "38", "title": "một triệu like", "description": "",
        "img": "https://i.pinimg.com/736x/38/9a/5e/389a5e34f5880fb86115e87561372908.jpg"
    },
    {
        "id": 622, "domainItemId": "607", "title": "Bang Bang", "description": "",
        "img": "https://i.pinimg.com/736x/38/9a/5e/389a5e34f5880fb86115e87561372908.jpg"
    },
    {
        "id": 604, "domainItemId": "589", "title": "After Hours", "description": "",
        "img": "https://i.pinimg.com/736x/38/9a/5e/389a5e34f5880fb86115e87561372908.jpg"
    },
    {
        "id": 813, "domainItemId": "799", "title": "Bâng Khuâng", "description": "",
        "img": "https://i.pinimg.com/736x/38/9a/5e/389a5e34f5880fb86115e87561372908.jpg"
    }
];
export class PopupDisplay {
    constructor(_domainKey, _slotName, _apiBaseUrl, config = {}) {
        var _a;
        //private recommendationGetter: () => Promise<RecommendationItem[]>;
        this.popupTimeout = null;
        this.autoCloseTimeout = null;
        this.autoSlideTimeout = null;
        this.shadowHost = null;
        this.spaCheckInterval = null;
        this.isPendingShow = false;
        this.DEFAULT_DELAY = 5000;
        //this.recommendationGetter = recommendationGetter;
        this.config = {
            delay: (_a = config.delay) !== null && _a !== void 0 ? _a : this.DEFAULT_DELAY,
            autoCloseDelay: config.autoCloseDelay,
            ...config
        };
    }
    start() {
        this.startWatcher();
    }
    stop() {
        this.clearTimeouts();
        if (this.spaCheckInterval) {
            clearInterval(this.spaCheckInterval);
            this.spaCheckInterval = null;
        }
        this.removePopup();
    }
    startWatcher() {
        if (this.spaCheckInterval)
            clearInterval(this.spaCheckInterval);
        this.spaCheckInterval = setInterval(() => {
            const shouldShow = this.shouldShowPopup(); // Check URL hiện tại
            const isVisible = this.shadowHost !== null; // Check xem Popup có đang hiện không
            // CASE 1: URL KHÔNG khớp nhưng Popup đang hiện -> ĐÓNG NGAY
            if (!shouldShow && isVisible) {
                this.removePopup();
                this.isPendingShow = false;
                this.clearTimeouts(); // Hủy luôn nếu có timer nào đang chạy ngầm
                return;
            }
            // CASE 2: URL KHÔNG khớp nhưng đang đếm ngược để hiện -> HỦY ĐẾM NGƯỢC
            if (!shouldShow && this.isPendingShow) {
                this.clearTimeouts();
                this.isPendingShow = false;
                return;
            }
            // CASE 3: URL KHỚP, Popup CHƯA hiện và CHƯA đếm ngược -> BẮT ĐẦU ĐẾM
            if (shouldShow && !isVisible && !this.isPendingShow) {
                this.scheduleShow();
            }
        }, 500);
    }
    // Hàm lên lịch hiển thị (tách riêng logic delay)
    scheduleShow() {
        const delay = this.config.delay || 0;
        this.isPendingShow = true;
        this.popupTimeout = setTimeout(() => {
            if (this.shouldShowPopup()) {
                this.showPopup();
            }
            this.isPendingShow = false;
        }, delay);
    }
    async showPopup() {
        try {
            const items = MOCK_ITEMS; //this.fetchRecommendations()
            // Chỉ hiện nếu chưa hiện (double check)
            if (items && items.length > 0 && !this.shadowHost) {
                this.renderPopup(items);
                // Logic autoClose (tự đóng sau X giây)
                if (this.config.autoCloseDelay && this.config.autoCloseDelay > 0) {
                    this.autoCloseTimeout = setTimeout(() => {
                        this.removePopup();
                        // Sau khi đóng, Watcher vẫn chạy nên nếu URL vẫn đúng thì nó sẽ lại đếm ngược để hiện lại.
                        // Nếu muốn hiện 1 lần duy nhất mỗi lần vào trang, cần thêm logic session storage.
                    }, this.config.autoCloseDelay * 1000);
                }
            }
        }
        catch (error) {
            this.isPendingShow = false;
        }
    }
    // --- LOGIC 1: TRIGGER CONFIG (URL CHECKING) ---
    shouldShowPopup() {
        const trigger = this.config.triggerConfig;
        // Nếu không có trigger config, mặc định cho hiện (hoặc check pages cũ nếu cần)
        if (!trigger || !trigger.targetValue)
            return true;
        // Lấy URL hiện tại (pathname: /products/ao-thun)
        const currentUrl = window.location.pathname;
        const targetUrl = trigger.targetValue;
        return currentUrl.includes(targetUrl);
    }
    scheduleNextPopup() {
        this.clearTimeouts();
        // Check ngay lập tức trước khi hẹn giờ
        if (!this.shouldShowPopup()) {
            this.popupTimeout = setTimeout(() => {
                this.scheduleNextPopup();
            }, 1000);
            return;
        }
        const delay = this.config.delay || 0;
        this.popupTimeout = setTimeout(() => {
            // Check lại lần nữa khi timer nổ (đề phòng SPA chuyển trang)
            if (this.shouldShowPopup()) {
                this.showPopup();
            }
            else {
                // Nếu chuyển sang trang không khớp, thử lại sau (hoặc dừng hẳn tùy logic)
                this.scheduleNextPopup();
            }
        }, delay);
    }
    // private async fetchRecommendations(): Promise<RecommendationItem[]> {
    //   try {
    //     return await this.recommendationGetter();
    //   } catch { return []; }
    // }
    // --- LOGIC 2: DYNAMIC CSS GENERATOR ---
    getDynamicStyles() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const style = this.config.styleJson || {};
        const layout = this.config.layoutJson || {};
        const tokens = style.tokens || {};
        const colors = tokens.colors || {};
        const typo = tokens.typography || {};
        // Position Logic
        const popupWrapper = ((_a = layout.wrapper) === null || _a === void 0 ? void 0 : _a.popup) || {};
        let posCSS = 'bottom: 24px; right: 24px;';
        if (popupWrapper.position === 'center') {
            posCSS = 'top: 50%; left: 50%; transform: translate(-50%, -50%);';
        }
        else if (popupWrapper.position === 'bottom-left') {
            posCSS = 'bottom: 24px; left: 24px;';
        }
        else if (popupWrapper.position === 'top-center') {
            posCSS = 'top: 24px; left: 50%; transform: translateX(-50%);';
        }
        // const width = popupWrapper.width ? `${popupWrapper.width}px` : '340px';
        const width = '340px';
        const contentMode = layout.contentMode || 'carousel'; // carousel, grid, list
        // CSS cho phần body (nơi chứa items)
        let bodyLayoutCSS = '';
        if (contentMode === 'grid') {
            const gridGap = ((_c = (_b = layout.modes) === null || _b === void 0 ? void 0 : _b.grid) === null || _c === void 0 ? void 0 : _c.gap) || '10px';
            bodyLayoutCSS = `
            display: grid; 
            grid-template-columns: repeat(2, 1fr); /* Popup nhỏ nên mặc định 2 cột */
            gap: ${gridGap};
            padding: 16px;
            overflow-y: auto;
            max-height: 200px; /* Giới hạn chiều cao nếu nhiều item */
        `;
        }
        else if (contentMode === 'list') {
            const listGap = ((_e = (_d = layout.modes) === null || _d === void 0 ? void 0 : _d.list) === null || _e === void 0 ? void 0 : _e.gap) || '10px';
            bodyLayoutCSS = `
            display: flex;
            flex-direction: column;
            gap: ${listGap};
            padding: 16px;
            overflow-y: auto;
            max-height: 200px;
        `;
        }
        else {
            bodyLayoutCSS = `width: 100%; padding: 16px;`;
        }
        return `
      :host { all: initial; font-family: inherit; }
      * { box-sizing: border-box; }

      .recsys-popup {
        position: fixed;
        ${posCSS}
        width: ${width};
        background: ${colors.surface || '#fff'};
        border-radius: ${((_f = tokens.radius) === null || _f === void 0 ? void 0 : _f.card) || 8}px;
        box-shadow: ${((_g = tokens.shadow) === null || _g === void 0 ? void 0 : _g.card) || '0 4px 12px rgba(0,0,0,0.15)'};
        z-index: 2147483647;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        border: 1px solid ${colors.border || '#eee'};
        animation: fadeIn 0.3s ease;
      }

      @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

      .recsys-header {
        background: ${colors.surface || '#fff'};
        color: ${colors.textPrimary || '#333'};
        padding: 12px 16px;
        border-bottom: 1px solid ${colors.border || '#eee'};
        display: flex; justify-content: space-between; align-items: center;
      }
      
      .recsys-header-title {
         font-size: ${((_h = typo.title) === null || _h === void 0 ? void 0 : _h.fontSize) || 16}px;
         font-weight: ${((_j = typo.title) === null || _j === void 0 ? void 0 : _j.fontWeight) || 600};
      }

      .recsys-close {
        background: none; border: none; cursor: pointer; font-size: 20px;
        color: ${colors.textSecondary || '#999'}; padding: 0;
      }

      .recsys-body { position: relative; padding: 0; background: ${colors.surface || '#fff'}; }

      /* Nút điều hướng Carousel */
      .recsys-nav {
        position: absolute; top: 50%; transform: translateY(-50%);
        width: 32px; height: 32px; border-radius: 50%;
        background: rgba(255,255,255,0.9); border: 1px solid ${colors.border || '#ddd'};
        color: ${colors.textPrimary || '#333'};
        cursor: pointer; z-index: 2; display: flex; align-items: center; justify-content: center;
      }
      .recsys-prev { left: 8px; }
      .recsys-next { right: 8px; }

      .recsys-slide { width: 100%; padding: 16px; }

      .recsys-item { display: flex; flex-direction: column; gap: 8px; text-align: center; align-items: center;}

      .recsys-img { 
         width: 100%; height: 180px; object-fit: cover; 
         border-radius: ${((_k = tokens.radius) === null || _k === void 0 ? void 0 : _k.image) || 4}px; 
      }

      /* Style cho các field động */
      .recsys-field { margin-bottom: 2px; }
      .recsys-field-product_name, .recsys-field-name {
         font-size: ${((_l = typo.body) === null || _l === void 0 ? void 0 : _l.fontSize) || 14}px;
         font-weight: ${((_m = typo.body) === null || _m === void 0 ? void 0 : _m.fontWeight) || 600}; color: ${colors.textPrimary || '#333'};
         display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      }
      .recsys-field-price {
         color: ${colors.primary || '#d32f2f'}; font-weight: bold; font-size: 14px;
      }
      .recsys-field-rating { color: #f59e0b; font-size: 12px; }
      .recsys-field-description {
         font-size: 12px; color: ${colors.textSecondary || '#666'};
         display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      }
      .recsys-container {
         ${bodyLayoutCSS}
      }
      
      /* Ẩn nút nav nếu không phải carousel */
      .recsys-nav {
         display: ${contentMode === 'carousel' ? 'flex' : 'none'};
      }
      
      /* Chỉnh sửa item layout nếu là list */
      .recsys-item { 
         display: flex; 
         flex-direction: ${contentMode === 'list' ? 'row' : 'column'}; 
         gap: 8px; 
         text-align: ${contentMode === 'list' ? 'left' : 'center'};
         border: ${contentMode === 'list' ? '1px solid #eee' : 'none'};
         padding: ${contentMode === 'list' ? '8px' : '0'};
         border-radius: 4px;
      }
      
      /* Chỉnh ảnh nhỏ lại nếu là list */
      .recsys-img { 
         width: ${contentMode === 'list' ? '60px' : '100%'}; 
         height: ${contentMode === 'list' ? '60px' : '180px'}; 
      }
    `;
    }
    // --- LOGIC 3: DYNAMIC HTML RENDERER ---
    renderItemContent(item) {
        var _a;
        // Lấy field config và sort theo position
        const fields = ((_a = this.config.customizingFields) === null || _a === void 0 ? void 0 : _a.fields) || [];
        const activeFields = fields
            .filter(f => f.isEnabled)
            .sort((a, b) => a.position - b.position);
        let html = '';
        activeFields.forEach(field => {
            const key = field.key;
            // 1. Xử lý ảnh
            if (key === 'image' || key === 'img') {
                if (item.img)
                    html += `<img src="${item.img}" class="recsys-img" />`;
                return;
            }
            // 2. Mapping Key từ Config -> Item Data
            let value = '';
            if (key === 'product_name' || key === 'name')
                value = item.title;
            else if (key === 'description')
                value = item.description;
            else
                value = item[key]; // Các trường khác (price, rating...)
            // 3. Render Text
            if (value) {
                html += `<div class="recsys-field recsys-field-${key}">${value}</div>`;
            }
        });
        return `<div class="recsys-item" data-id="${item.id}">${html}</div>`;
    }
    renderPopup(items) {
        var _a;
        this.removePopup();
        const host = document.createElement('div');
        host.id = 'recsys-popup-host';
        document.body.appendChild(host);
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = this.getDynamicStyles();
        shadow.appendChild(style);
        // Main Popup
        const layout = this.config.layoutJson || {};
        const contentMode = layout.contentMode || 'carousel';
        const popup = document.createElement('div');
        popup.className = 'recsys-popup';
        popup.innerHTML = `
      <div class="recsys-header">
        <span class="recsys-header-title">Gợi ý cho bạn</span>
        <button class="recsys-close">✕</button>
      </div>
      <div class="recsys-body">${contentMode === 'carousel' ? '<button class="recsys-nav recsys-prev">‹</button>' : ''}  
      <div class="${contentMode === 'carousel' ? 'recsys-slide' : 'recsys-container'}"></div>
        ${contentMode === 'carousel' ? '<button class="recsys-nav recsys-next">›</button>' : ''}
      </div>
    `;
        shadow.appendChild(popup);
        this.shadowHost = host;
        if (contentMode === 'carousel') {
            this.setupCarousel(shadow, items);
        }
        else {
            // Nếu là Grid hoặc List -> Render tất cả items ra luôn
            this.renderStaticItems(shadow, items);
        }
        (_a = shadow.querySelector('.recsys-close')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
            if (this.autoSlideTimeout)
                clearTimeout(this.autoSlideTimeout);
            this.removePopup();
            this.scheduleNextPopup();
        });
    }
    renderStaticItems(shadow, items) {
        const container = shadow.querySelector('.recsys-container');
        if (!container)
            return;
        let html = '';
        // Giới hạn số lượng hiển thị nếu là popup tĩnh (vd: tối đa 4 cái)
        items.forEach(item => {
            html += this.renderItemContent(item);
        });
        container.innerHTML = html;
    }
    setupCarousel(shadow, items) {
        var _a, _b;
        let currentIndex = 0;
        const slideContainer = shadow.querySelector('.recsys-slide');
        const renderSlide = () => {
            const item = items[currentIndex];
            // GỌI HÀM RENDER ĐỘNG
            slideContainer.innerHTML = this.renderItemContent(item);
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
            if (this.autoSlideTimeout)
                clearTimeout(this.autoSlideTimeout);
            this.autoSlideTimeout = setTimeout(next, this.DEFAULT_DELAY);
        };
        (_a = shadow.querySelector('.recsys-prev')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', prev);
        (_b = shadow.querySelector('.recsys-next')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', next);
        renderSlide();
        resetAutoSlide();
    }
    removePopup() {
        if (this.shadowHost) {
            this.shadowHost.remove();
            this.shadowHost = null;
            this.isPendingShow = false;
        }
    }
    clearTimeouts() {
        if (this.popupTimeout)
            clearTimeout(this.popupTimeout);
        if (this.autoCloseTimeout)
            clearTimeout(this.autoCloseTimeout);
        if (this.autoSlideTimeout)
            clearTimeout(this.autoSlideTimeout);
        this.popupTimeout = null;
        this.autoCloseTimeout = null;
        this.autoSlideTimeout = null;
    }
}
//# sourceMappingURL=popup-display.js.map