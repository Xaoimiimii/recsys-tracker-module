const MOCK_ITEMS = [
    {
        "id": 460, "DomainItemId": "444", "Title": "Tình Yêu Xanh Lá (juju)", "Description": "Nhạc chill",
        "ImageUrl": "https://www.postposmo.com/wp-content/uploads/2024/01/gatito.jpg",
        "Categories": ["Indie", "V-Pop"], "TestCustomAttribute": 95
    },
    {
        "id": 131, "DomainItemId": "107", "Title": "How Long", "Description": "Charlie Puth",
        "ImageUrl": "https://www.postposmo.com/wp-content/uploads/2024/01/gatito.jpg",
        "Categories": ["US-UK", "Pop"], "TestCustomAttribute": 88
    },
    {
        "id": 644, "DomainItemId": "629", "Title": "Break Free", "Description": "Ariana Grande",
        "ImageUrl": "https://www.postposmo.com/wp-content/uploads/2024/01/gatito.jpg",
        "Categories": ["Pop", "Dance"], "TestCustomAttribute": 92
    },
    {
        "id": 194, "DomainItemId": "172", "Title": "Đẹp Nhất Là Em", "Description": "Soobin",
        "ImageUrl": "https://www.postposmo.com/wp-content/uploads/2024/01/gatito.jpg",
        "Categories": ["Ballad", "V-Pop"], "TestCustomAttribute": 85
    },
    {
        "id": 68, "DomainItemId": "22", "Title": "Cho Tôi Lang Thang", "Description": "Đen Vâu",
        "ImageUrl": "https://www.postposmo.com/wp-content/uploads/2024/01/gatito.jpg",
        "Categories": ["Rap", "Indie"], "TestCustomAttribute": 90
    },
    {
        "id": 383, "DomainItemId": "364", "Title": "Nonsense", "Description": "Sabrina Carpenter",
        "ImageUrl": "https://www.postposmo.com/wp-content/uploads/2024/01/gatito.jpg",
        "Categories": ["Pop"], "TestCustomAttribute": 78
    },
    {
        "Id": 723, "DomainItemId": "709", "Title": "Helium", "Description": "Sia",
        "ImageUrl": "https://www.postposmo.com/wp-content/uploads/2024/01/gatito.jpg", // Null trong ví dụ, nhưng để ảnh demo cho đẹp
        "Categories": ["Alt-Pop", "Âu Mỹ"], "TestCustomAttribute": 50
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
        this.isManuallyClosed = false;
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
            if (!shouldShow) {
                this.isManuallyClosed = false;
            }
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
            if (shouldShow && !isVisible && !this.isPendingShow && !this.isManuallyClosed) {
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
        if (targetUrl === '/' && currentUrl !== '/')
            return false;
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
    // --- DYNAMIC CSS GENERATOR (FINAL CLEAN VERSION) ---
    getDynamicStyles() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
        const style = this.config.styleJson || {};
        const layout = this.config.layoutJson || {};
        // 1. Unpack Configs
        const tokens = style.tokens || {};
        const components = style.components || {};
        const size = style.size || 'md';
        const density = ((_a = tokens.densityBySize) === null || _a === void 0 ? void 0 : _a[size]) || {};
        // --- Helper Getters ---
        const getColor = (tokenName) => { var _a; return ((_a = tokens.colors) === null || _a === void 0 ? void 0 : _a[tokenName]) || tokenName || 'transparent'; };
        const getRadius = (tokenName) => {
            var _a;
            const r = (_a = tokens.radius) === null || _a === void 0 ? void 0 : _a[tokenName];
            return r !== undefined ? `${r}px` : '4px';
        };
        const getShadow = (tokenName) => { var _a; return ((_a = tokens.shadow) === null || _a === void 0 ? void 0 : _a[tokenName]) || 'none'; };
        // 2. Setup Dimensions
        const contentMode = layout.contentMode || 'grid';
        const modeConfig = ((_b = layout.modes) === null || _b === void 0 ? void 0 : _b[contentMode]) || {};
        // Image Size logic
        const imgLayout = ((_e = (_d = (_c = layout.card) === null || _c === void 0 ? void 0 : _c.image) === null || _d === void 0 ? void 0 : _d.sizeByMode) === null || _e === void 0 ? void 0 : _e[contentMode]) || {};
        const imgHeightRaw = imgLayout.height || density.imageHeight || 140;
        // [FIX] Carousel ưu tiên width từ config (96px) thay vì 100% để giống preview
        let imgWidthRaw = '100%';
        if (contentMode === 'list')
            imgWidthRaw = imgLayout.width || 96;
        if (contentMode === 'carousel' && imgLayout.width)
            imgWidthRaw = imgLayout.width;
        const imgHeight = typeof imgHeightRaw === 'number' ? `${imgHeightRaw}px` : imgHeightRaw;
        const imgWidth = typeof imgWidthRaw === 'number' ? `${imgWidthRaw}px` : imgWidthRaw;
        // Popup Wrapper logic
        const popupWrapper = ((_f = layout.wrapper) === null || _f === void 0 ? void 0 : _f.popup) || {};
        //const popupWidth = popupWrapper.width ? `${popupWrapper.width}px` : '340px';
        const popupWidth = '340px';
        // Xử lý Height từ Config (Nếu JSON có height thì dùng, ko thì max-height)
        const popupHeightCSS = popupWrapper.height
            ? `height: ${popupWrapper.height}px;`
            : `height: auto; max-height: 50vh;`;
        let posCSS = 'bottom: 20px; right: 20px;';
        switch (popupWrapper.position) {
            case 'bottom-left':
                posCSS = 'bottom: 20px; left: 20px;';
                break;
            case 'top-center':
                posCSS = 'top: 20px; left: 50%; transform: translateX(-50%);';
                break;
            case 'center':
                posCSS = 'top: 50%; left: 50%; transform: translate(-50%, -50%);';
                break;
        }
        // 3. Container Logic
        let containerCSS = '';
        let itemDir = 'column';
        let itemAlign = 'stretch';
        let infoTextAlign = 'center';
        let infoAlignItems = 'center';
        if (contentMode === 'grid') {
            const cols = modeConfig.columns || 2;
            const gapPx = ((_g = tokens.spacingScale) === null || _g === void 0 ? void 0 : _g[modeConfig.gap || 'md']) || 12;
            containerCSS = `display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: ${gapPx}px; padding: ${density.cardPadding || 16}px;`;
        }
        else if (contentMode === 'list') {
            itemDir = 'row';
            itemAlign = 'flex-start';
            const gapPx = ((_h = tokens.spacingScale) === null || _h === void 0 ? void 0 : _h[modeConfig.rowGap || 'md']) || 12;
            containerCSS = `display: flex; flex-direction: column; gap: ${gapPx}px; padding: ${density.cardPadding || 16}px;`;
            containerCSS = 'padding: 0;';
            infoTextAlign = 'left';
            infoAlignItems = 'flex-start';
        }
        // 4. Styles Mapping
        const cardComp = components.card || {};
        const modeOverride = ((_j = style.modeOverrides) === null || _j === void 0 ? void 0 : _j[contentMode]) || {};
        // Colors
        const colorTitle = getColor('textPrimary');
        const colorBody = getColor('textSecondary');
        const colorPrimary = getColor('primary'); // <--- ĐÃ KHAI BÁO LẠI ĐỂ DÙNG
        // Card Specifics
        const cardBg = getColor(cardComp.backgroundToken || 'surface');
        const cardBorder = cardComp.border ? `1px solid ${getColor(cardComp.borderColorToken)}` : 'none';
        const cardRadius = getRadius(cardComp.radiusToken || 'card');
        const cardShadow = getShadow(cardComp.shadowToken);
        const cardPadding = ((_k = modeOverride.card) === null || _k === void 0 ? void 0 : _k.paddingFromDensity)
            ? (density[modeOverride.card.paddingFromDensity] || 12)
            : (density.cardPadding || 12);
        const btnBg = getColor('surface');
        return `
      :host { all: initial; font-family: inherit; box-sizing: border-box; }
      * { box-sizing: border-box; }

      .recsys-popup {
        position: fixed; ${posCSS} width: ${popupWidth}; ${popupHeightCSS}
        background: ${getColor(((_l = components.canvas) === null || _l === void 0 ? void 0 : _l.backgroundToken) || 'background')};
        color: ${colorTitle};
        border-radius: ${getRadius('card')}; 
        box-shadow: ${(_m = tokens.shadow) === null || _m === void 0 ? void 0 : _m.cardHover};
        border: 1px solid ${getColor('border')};
        display: flex; flex-direction: column; z-index: 999999; overflow: hidden;
        animation: slideIn 0.3s ease-out;
      }
      @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

      .recsys-header {
        padding: 12px 16px; border-bottom: 1px solid ${getColor('border')};
        display: flex; justify-content: space-between; align-items: center;
        background: ${getColor('surface')};
        flex-shrink: 0; 
      }
      .recsys-header-title {
          font-size: ${((_p = (_o = tokens.typography) === null || _o === void 0 ? void 0 : _o.title) === null || _p === void 0 ? void 0 : _p.fontSize) || 16}px;
          font-weight: ${((_r = (_q = tokens.typography) === null || _q === void 0 ? void 0 : _q.title) === null || _r === void 0 ? void 0 : _r.fontWeight) || 600};
          color: ${colorTitle};
      }
      .recsys-close { background: none; border: none; color: ${colorBody}; cursor: pointer; font-size: 18px; }

      .recsys-body {
        position: relative; flex-grow: 0; overflow-y: auto;
        scrollbar-width: thin; scrollbar-color: ${getColor('border')} transparent;
        background: ${getColor('surface')};
      }
      .recsys-container { ${containerCSS} }

      .recsys-item {
         display: flex; flex-direction: ${itemDir}; align-items: ${itemAlign};
         gap: ${((_s = tokens.spacingScale) === null || _s === void 0 ? void 0 : _s.sm) || 8}px;
         background: ${cardBg}; border: ${cardBorder}; border-radius: ${cardRadius};
         box-shadow: ${cardShadow}; padding: ${cardPadding}px;
         cursor: pointer; transition: all 0.2s;
         width: 100%;
      }

      /* SỬ DỤNG colorPrimary Ở ĐÂY */
      .recsys-item:hover .recsys-name {
          color: ${colorPrimary}; 
      }

      ${((_t = cardComp.hover) === null || _t === void 0 ? void 0 : _t.enabled) ? `
      .recsys-item:hover {
         transform: translateY(-${cardComp.hover.liftPx || 2}px);
         box-shadow: ${getShadow(cardComp.hover.shadowToken || 'cardHover')};
         /* Optional: border-color: ${colorPrimary}; */
      }
      ` : ''}

      .recsys-img-box {
         width: ${imgWidth}; height: ${imgHeight};
         border-radius: ${getRadius(((_u = components.image) === null || _u === void 0 ? void 0 : _u.radiusFollowsCard) ? cardComp.radiusToken : 'image')};
         overflow: hidden; background: ${getColor('muted')}; flex-shrink: 0; display: flex;
      }
      .recsys-img-box img { width: 100%; height: 100%; object-fit: ${((_v = components.image) === null || _v === void 0 ? void 0 : _v.objectFit) || 'cover'}; }

      .recsys-info { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; text-align: ${infoTextAlign}; 
        align-items: ${infoAlignItems};}

      .recsys-badges { display: flex; flex-wrap: wrap; gap: 4px; margin-top: auto; }
      .recsys-badge { 
         font-size: 10px; 
         background: ${getColor(((_w = components.badge) === null || _w === void 0 ? void 0 : _w.backgroundToken) || 'primary')}; 
         color: ${((_x = components.badge) === null || _x === void 0 ? void 0 : _x.textColor) || '#fff'};
         padding: 2px 6px; border-radius: ${getRadius('badge')};
      }

      .recsys-nav {
         position: absolute; top: 50%; transform: translateY(-50%);
         width: 32px; height: 32px; /* To hơn */
         border-radius: 50%;
         background: ${btnBg}; /* Màu nền theo theme */
         border: 1px solid ${getColor('border')};
         display: flex; align-items: center; justify-content: center;
         z-index: 10; cursor: pointer; color: ${colorTitle};
         box-shadow: 0 2px 8px rgba(0,0,0,0.15); /* Đổ bóng */
         font-size: 18px; padding-bottom: 2px;
         opacity: 0.9;
         transition: opacity 0.2s;
      }
      .recsys-nav:hover { opacity: 1; }
      .recsys-prev { left: 12px; } /* Căn sát mép hơn */
      .recsys-next { right: 12px; }
      .recsys-slide { 
         padding: 12px 48px; /* Padding trái phải lớn để chừa chỗ cho nút */
         display: flex; 
         justify-content: center;
      }
    `;
    }
    // --- LOGIC 3: DYNAMIC HTML RENDERER ---
    // --- LOGIC 3: DYNAMIC HTML RENDERER (UPDATED) ---
    renderItemContent(item) {
        var _a, _b, _c, _d;
        const customizingFields = ((_a = this.config.customizingFields) === null || _a === void 0 ? void 0 : _a.fields) || [];
        const activeFields = customizingFields.filter(f => f.isEnabled).sort((a, b) => a.position - b.position);
        // 1. Lấy Config Style & Colors
        const styleJson = this.config.styleJson || {};
        const fieldOverrides = ((_c = (_b = styleJson.components) === null || _b === void 0 ? void 0 : _b.fieldRow) === null || _c === void 0 ? void 0 : _c.overrides) || {};
        const colors = ((_d = styleJson.tokens) === null || _d === void 0 ? void 0 : _d.colors) || {}; // <--- Lấy bảng màu
        // Helper: Lấy giá trị item (Giữ nguyên)
        const getValue = (obj, configKey) => {
            if (!obj)
                return '';
            if (obj[configKey] !== undefined)
                return obj[configKey];
            const pascalKey = configKey.replace(/(_\w)/g, m => m[1].toUpperCase()).replace(/^\w/, c => c.toUpperCase());
            if (obj[pascalKey] !== undefined)
                return obj[pascalKey];
            const camelKey = configKey.replace(/(_\w)/g, m => m[1].toUpperCase());
            if (obj[camelKey] !== undefined)
                return obj[camelKey];
            if (obj[configKey.toUpperCase()] !== undefined)
                return obj[configKey.toUpperCase()];
            const lowerKey = configKey.toLowerCase();
            if (['title', 'name', 'product_name', 'item_name'].includes(lowerKey))
                return obj['Title'] || obj['title'] || obj['Name'] || obj['name'];
            if (['image', 'img', 'image_url', 'avatar'].includes(lowerKey))
                return obj['ImageUrl'] || obj['imageUrl'] || obj['Img'] || obj['img'] || obj['Image'] || obj['image'];
            return '';
        };
        // Helper mới: Tính toán Style cuối cùng (Kết hợp Default Theme + Manual Override)
        const getFinalStyle = (fieldKey) => {
            const key = fieldKey.toLowerCase();
            const override = fieldOverrides[fieldKey] || {};
            // A. XÁC ĐỊNH MÀU MẶC ĐỊNH DỰA THEO LOẠI FIELD (Mapping logic)
            let defaultColor = colors.textSecondary; // Mặc định là màu phụ
            let defaultWeight = '400';
            let defaultSize = 12;
            if (['title', 'name', 'product_name', 'item_name'].includes(key)) {
                defaultColor = colors.textPrimary;
                defaultWeight = '600';
                defaultSize = 14;
            }
            else if (key.includes('price')) {
                defaultColor = colors.primary; // Hoặc colors.warning tùy theme
                defaultWeight = '700';
                defaultSize = 14;
            }
            else if (key.includes('rating')) {
                defaultColor = colors.warning;
            }
            else if (key.includes('category') || key.includes('categories')) {
                defaultColor = colors.primary;
                defaultSize = 11;
            }
            // B. LẤY GIÁ TRỊ CUỐI CÙNG (Ưu tiên Override nếu có)
            const finalColor = override.color || defaultColor;
            const finalSize = override.fontSize || defaultSize;
            const finalWeight = override.fontWeight || defaultWeight;
            // C. TẠO CHUỖI CSS
            let style = '';
            if (finalColor)
                style += `color: ${finalColor} !important; `;
            if (finalSize)
                style += `font-size: ${finalSize}px !important; `;
            if (finalWeight)
                style += `font-weight: ${finalWeight} !important; `;
            return style;
        };
        // 2. Render Title & Image
        const titleFieldConfig = activeFields.find(f => ['title', 'name', 'product_name', 'item_name'].includes(f.key.toLowerCase()));
        const titleValue = titleFieldConfig ? getValue(item, titleFieldConfig.key) : getValue(item, 'title');
        // Áp dụng style cho Title
        const titleStyle = titleFieldConfig ? getFinalStyle(titleFieldConfig.key) : `color: ${colors.textPrimary}; font-weight: 600;`;
        const imageFieldConfig = activeFields.find(f => ['image', 'img', 'image_url', 'imageurl'].includes(f.key.toLowerCase()));
        const imgSrc = imageFieldConfig ? getValue(item, imageFieldConfig.key) : getValue(item, 'image');
        // 3. Render Khung
        let html = `
       <div class="recsys-item">
          ${imgSrc ? `
          <div class="recsys-img-box">
             <img src="${imgSrc}" alt="${titleValue || ''}" />
          </div>` : ''}
          
          <div class="recsys-info">
             <div class="recsys-name" title="${titleValue}" style="${titleStyle}">
                ${titleValue || ''}
             </div>
    `;
        // 4. Render các field còn lại
        activeFields.forEach(field => {
            const key = field.key.toLowerCase();
            if (['image', 'img', 'image_url', 'title', 'name', 'product_name', 'item_name'].includes(key))
                return;
            let value = getValue(item, field.key);
            if (value === undefined || value === null || value === '')
                return;
            let rawValue = getValue(item, field.key);
            if (rawValue === undefined || rawValue === null || rawValue === '')
                return;
            // [SỬA ĐỔI] Xử lý mảng: Nối thành chuỗi (Pop, Ballad) thay vì render Badge
            let displayValue = rawValue;
            if (Array.isArray(rawValue)) {
                displayValue = rawValue.join(', ');
            }
            // Lấy style (Category sẽ tự lấy màu Primary từ hàm getFinalStyle)
            const valueStyle = getFinalStyle(field.key);
            html += `<div class="recsys-field-row">
            <span class="recsys-value" style="${valueStyle}">${displayValue}</span>
        </div>`;
        });
        html += `</div></div>`;
        return html;
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
            this.isManuallyClosed = true;
            this.removePopup();
        });
    }
    renderStaticItems(shadow, items) {
        const container = shadow.querySelector('.recsys-container');
        if (!container)
            return;
        container.innerHTML = items.map(item => this.renderItemContent(item)).join('');
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