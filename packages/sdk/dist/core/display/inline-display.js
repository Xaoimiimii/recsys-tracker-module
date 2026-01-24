export class InlineDisplay {
    constructor(_domainKey, _slotName, selector, _apiBaseUrl, config = {}, recommendationGetter) {
        this.observer = null;
        this.debounceTimer = null;
        this.autoSlideTimeout = null;
        this.DEFAULT_DELAY = 5000;
        this.selector = selector;
        this.recommendationGetter = recommendationGetter;
        this.config = { ...config };
    }
    start() {
        this.scanAndRender();
        this.setupObserver();
    }
    stop() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        if (this.autoSlideTimeout) {
            clearTimeout(this.autoSlideTimeout);
        }
    }
    // --- CORE INLINE LOGIC (Mutation Observer) ---
    setupObserver() {
        this.observer = new MutationObserver(() => {
            if (this.debounceTimer)
                clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.scanAndRender();
            }, 100);
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
    }
    scanAndRender() {
        const containers = this.findContainers();
        containers.forEach(container => {
            this.processContainer(container);
        });
    }
    findContainers() {
        let containers = document.querySelectorAll(this.selector);
        if (containers.length === 0) {
            containers = document.querySelectorAll(`.${this.selector}`);
            if (containers.length === 0) {
                containers = document.querySelectorAll(`#${this.selector}`);
            }
        }
        return containers;
    }
    async processContainer(container) {
        if (!container || container.getAttribute('data-recsys-loaded') === 'true')
            return;
        container.setAttribute('data-recsys-loaded', 'true');
        try {
            const items = await this.fetchRecommendations();
            if (items && items.length > 0) {
                this.renderWidget(container, items);
            }
        }
        catch (error) {
            console.error('[InlineDisplay] Error processing container', error);
        }
    }
    async fetchRecommendations() {
        try {
            return await this.recommendationGetter();
        }
        catch {
            return [];
        }
    }
    // --- DYNAMIC CSS GENERATOR (SYNCED WITH POPUP) ---
    getDynamicStyles() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
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
        // Image Size logic - not used anymore with aspect-ratio approach
        // const imgLayout = layout.card?.image?.sizeByMode?.[contentMode as 'grid' | 'list' | 'carousel'] || {};
        // const imgHeightRaw = imgLayout.height || density.imageHeight || 150; 
        // let imgWidthRaw: string | number = contentMode === 'grid' ? 150 : '100%';
        // if (contentMode === 'list') imgWidthRaw = (imgLayout as any).width || 96;
        // if (contentMode === 'carousel' && (imgLayout as any).width) imgWidthRaw = (imgLayout as any).width;
        // const imgHeight = typeof imgHeightRaw === 'number' ? `${imgHeightRaw}px` : imgHeightRaw;
        // const imgWidth = typeof imgWidthRaw === 'number' ? `${imgWidthRaw}px` : imgWidthRaw;
        // 3. Container Logic
        let containerCSS = '';
        let extraCSS = '';
        let itemDir = 'column';
        let itemAlign = 'stretch';
        let infoTextAlign = 'center';
        let infoAlignItems = 'center';
        let itemWidthCSS = 'width: 100%;';
        if (contentMode === 'grid') {
            const cols = modeConfig.columns || 4; // Inline default thường rộng hơn popup (4 cột)
            const gapPx = ((_c = tokens.spacingScale) === null || _c === void 0 ? void 0 : _c[modeConfig.gap || 'md']) || 16;
            containerCSS = `
          display: grid;
          grid-template-columns: repeat(${cols}, 1fr);
          gap: ${gapPx}px;
          padding: 8px 0;
      `;
            // Responsive đơn giản cho Grid Inline
            extraCSS += `
          @media (max-width: 1024px) { 
              .recsys-container { 
                  grid-template-columns: repeat(3, 1fr); 
              } 
          }
          @media (max-width: 768px) { 
              .recsys-container { 
                  grid-template-columns: repeat(2, 1fr); 
              } 
          }
          @media (max-width: 480px) { 
              .recsys-container { 
                  grid-template-columns: repeat(1, 1fr); 
              } 
          }
      `;
        }
        else if (contentMode === 'list') {
            itemDir = 'row';
            itemAlign = 'flex-start';
            const gapPx = ((_d = tokens.spacingScale) === null || _d === void 0 ? void 0 : _d[modeConfig.rowGap || 'md']) || 12;
            containerCSS = `display: flex; flex-direction: column; gap: ${gapPx}px;`;
            infoTextAlign = 'left';
            infoAlignItems = 'flex-start';
        }
        else if (contentMode === 'carousel') {
            const cols = modeConfig.itemsPerView || modeConfig.columns || 5;
            const gap = ((_e = tokens.spacingScale) === null || _e === void 0 ? void 0 : _e[modeConfig.gap || 'md']) || 16;
            containerCSS = `
        display: flex; 
        justify-content: center; 
        padding: 0 40px; 
        position: relative; 
        min-height: 200px;
    `;
            itemWidthCSS = `
        flex: 0 0 calc((100% - (${cols} - 1) * ${gap}px) / ${cols});
        max-width: calc((100% - (${cols} - 1) * ${gap}px) / ${cols});
        margin: 0; /* Xóa margin auto cũ */
      `;
        }
        // 4. Styles Mapping
        const cardComp = components.card || {};
        const modeOverride = ((_f = style.modeOverrides) === null || _f === void 0 ? void 0 : _f[contentMode]) || {};
        // Colors
        const colorTitle = getColor('textPrimary');
        //const colorBody = getColor('textSecondary');
        const colorPrimary = getColor('primary');
        // Card Specifics
        const cardBg = getColor(cardComp.backgroundToken || 'surface');
        const cardBorder = cardComp.border ? `1px solid ${getColor(cardComp.borderColorToken)}` : 'none';
        const cardRadius = getRadius(cardComp.radiusToken || 'card');
        const cardShadow = getShadow(cardComp.shadowToken);
        const cardPadding = ((_g = modeOverride.card) === null || _g === void 0 ? void 0 : _g.paddingFromDensity)
            ? (density[modeOverride.card.paddingFromDensity] || 12)
            : (density.cardPadding || 12);
        const btnBg = getColor('surface');
        return `
    :host { all: initial; font-family: inherit; width: 100%; display: block; box-sizing: border-box; }
    * { box-sizing: border-box; }

    .recsys-wrapper {
      width: 100%;
      background: ${getColor('surface') || 'transparent'};
      padding: 16px 0;
      border-radius: 8px;
    }

    .recsys-header {
      margin-left: 10px;
      margin-bottom: 16px;
      border-bottom: 1px solid ${getColor('border')};
      padding-bottom: 8px;
      
      justify-content: space-between; align-items: center;
    }
    .recsys-header-title {
        font-size: ${((_j = (_h = tokens.typography) === null || _h === void 0 ? void 0 : _h.title) === null || _j === void 0 ? void 0 : _j.fontSize) || 18}px;
        font-weight: ${((_l = (_k = tokens.typography) === null || _k === void 0 ? void 0 : _k.title) === null || _l === void 0 ? void 0 : _l.fontWeight) || 600};
        color: ${colorTitle};
    }

    .recsys-container { ${containerCSS} }

    .recsys-item {
        display: flex; flex-direction: ${itemDir}; align-items: ${itemAlign};
        gap: ${((_m = tokens.spacingScale) === null || _m === void 0 ? void 0 : _m.sm) || 8}px;
        background: ${cardBg}; border: ${cardBorder}; border-radius: ${cardRadius};
        box-shadow: ${cardShadow}; padding: ${cardPadding}px;
        cursor: pointer; transition: all 0.2s;
        ${itemWidthCSS}
        min-width: 0; /* Fix flex overflow */
    }

    .recsys-item:hover .recsys-name {
        color: ${colorPrimary}; 
    }

    ${((_o = cardComp.hover) === null || _o === void 0 ? void 0 : _o.enabled) ? `
    .recsys-item:hover {
        transform: translateY(-${cardComp.hover.liftPx || 2}px);
        box-shadow: ${getShadow(cardComp.hover.shadowToken || 'cardHover')};
    }
    ` : ''}

    .recsys-img-box {
        width: 100%;
        aspect-ratio: 1;
        overflow: hidden; 
        background: ${getColor('muted')}; 
        flex-shrink: 0;
    }
    .recsys-img-box img { 
        width: 100%; 
        aspect-ratio: 1;
        object-fit: cover;
        border-radius: 4px;
        transition: all 0.3s ease;
    }

    .recsys-info { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; text-align: ${infoTextAlign}; 
      align-items: ${infoAlignItems};}

    /* Buttons for Carousel */
    .recsys-nav {
        position: absolute; top: 50%; transform: translateY(-50%);
        width: 32px; height: 32px;
        border-radius: 50%;
        background: ${btnBg};
        border: 1px solid ${getColor('border')};
        display: flex; align-items: center; justify-content: center;
        z-index: 10; cursor: pointer; color: ${colorTitle};
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        font-size: 18px; padding-bottom: 2px;
        opacity: 0.9; transition: opacity 0.2s;
    }
    .recsys-nav:hover { opacity: 1; }
    .recsys-prev { left: 0; }
    .recsys-next { right: 0; }
  `;
    }
    // --- DYNAMIC HTML RENDERER (SYNCED WITH POPUP) ---
    renderItemContent(item) {
        var _a, _b, _c, _d;
        const customizingFields = ((_a = this.config.customizingFields) === null || _a === void 0 ? void 0 : _a.fields) || [];
        const activeFields = customizingFields.filter(f => f.isEnabled).sort((a, b) => a.position - b.position);
        // 1. Configs & Colors
        const styleJson = this.config.styleJson || {};
        const fieldOverrides = ((_c = (_b = styleJson.components) === null || _b === void 0 ? void 0 : _b.fieldRow) === null || _c === void 0 ? void 0 : _c.overrides) || {};
        const colors = ((_d = styleJson.tokens) === null || _d === void 0 ? void 0 : _d.colors) || {};
        // Helper: Smart Get Value
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
        // Helper: Get Final Style (Override > Default)
        const getFinalStyle = (fieldKey) => {
            const key = fieldKey.toLowerCase();
            const override = fieldOverrides[fieldKey] || {};
            let defaultColor = colors.textSecondary;
            let defaultWeight = '400';
            let defaultSize = 12;
            if (['title', 'name', 'product_name', 'item_name'].includes(key)) {
                defaultColor = colors.textPrimary;
                defaultWeight = '600';
                defaultSize = 14;
            }
            else if (key.includes('price')) {
                defaultColor = colors.primary;
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
            const finalColor = override.color || defaultColor;
            const finalSize = override.fontSize || defaultSize;
            const finalWeight = override.fontWeight || defaultWeight;
            let style = '';
            if (finalColor)
                style += `color: ${finalColor} !important; `;
            if (finalSize)
                style += `font-size: ${finalSize}px !important; `;
            if (finalWeight)
                style += `font-weight: ${finalWeight} !important; `;
            return style;
        };
        // 2. Extract Data
        const titleFieldConfig = activeFields.find(f => ['title', 'name', 'product_name', 'item_name'].includes(f.key.toLowerCase()));
        const titleValue = titleFieldConfig ? getValue(item, titleFieldConfig.key) : getValue(item, 'title');
        const titleStyle = titleFieldConfig ? getFinalStyle(titleFieldConfig.key) : `color: ${colors.textPrimary}; font-weight: 600;`;
        const imageFieldConfig = activeFields.find(f => ['image', 'img', 'image_url', 'imageurl'].includes(f.key.toLowerCase()));
        const imgSrc = imageFieldConfig ? getValue(item, imageFieldConfig.key) : getValue(item, 'image');
        // 3. Render HTML Structure
        let html = `
      <div class="recsys-item" data-id="${item.id || ''}">
        ${imgSrc ? `
        <div class="recsys-img-box">
            <img src="${imgSrc}" alt="${titleValue || ''}" />
        </div>` : ''}
        
        <div class="recsys-info">
            <div class="recsys-name" title="${titleValue}" style="${titleStyle}">
              ${titleValue || ''}
            </div>
    `;
        // 4. Render Remaining Fields
        activeFields.forEach(field => {
            const key = field.key.toLowerCase();
            if (['image', 'img', 'image_url', 'title', 'name', 'product_name', 'item_name'].includes(key))
                return;
            let rawValue = getValue(item, field.key);
            if (rawValue === undefined || rawValue === null || rawValue === '')
                return;
            let displayValue = rawValue;
            if (Array.isArray(rawValue)) {
                displayValue = rawValue.join(', ');
            }
            const valueStyle = getFinalStyle(field.key);
            html += `<div class="recsys-field-row">
          <span class="recsys-value" style="${valueStyle}">${displayValue}</span>
      </div>`;
        });
        html += `</div></div>`;
        return html;
    }
    // --- RENDER MAIN WIDGET ---
    // --- RENDER MAIN WIDGET ---
    renderWidget(container, items) {
        var _a, _b, _c, _d, _e;
        let shadow = container.shadowRoot;
        if (!shadow)
            shadow = container.attachShadow({ mode: 'open' });
        shadow.innerHTML = '';
        const style = document.createElement('style');
        style.textContent = this.getDynamicStyles();
        shadow.appendChild(style);
        const styleJson = this.config.styleJson || {};
        const layout = this.config.layoutJson || {};
        const contentMode = layout.contentMode || 'grid';
        const title = ((_b = (_a = layout.wrapper) === null || _a === void 0 ? void 0 : _a.header) === null || _b === void 0 ? void 0 : _b.title) || 'Gợi ý cho bạn';
        const wrapper = document.createElement('div');
        wrapper.className = 'recsys-wrapper';
        // Header
        const headerHTML = `
      <div class="recsys-header">
        <span class="recsys-header-title">${title}</span>
      </div>
    `;
        // [FIX] Tách biệt logic render để tránh ghi đè innerHTML
        if (contentMode === 'carousel') {
            const modeConfig = ((_c = layout.modes) === null || _c === void 0 ? void 0 : _c.carousel) || {};
            const gap = ((_e = (_d = styleJson === null || styleJson === void 0 ? void 0 : styleJson.tokens) === null || _d === void 0 ? void 0 : _d.spacingScale) === null || _e === void 0 ? void 0 : _e[modeConfig.gap || 'md']) || 16;
            // Render cấu trúc Carousel
            wrapper.innerHTML = headerHTML + `
        <div style="position: relative; width: 100%; max-width: 100%;">
          <button class="recsys-nav recsys-prev">‹</button>
          
          <div class="recsys-container" style="display: flex; overflow: hidden; width: 100%; gap: ${gap}px;"></div>
          
          <button class="recsys-nav recsys-next">›</button>
        </div>`;
            shadow.appendChild(wrapper);
            this.setupCarousel(shadow, items); // Khởi tạo logic carousel
        }
        else {
            // Render cấu trúc Grid/List
            wrapper.innerHTML = headerHTML + `<div class="recsys-container"></div>`;
            shadow.appendChild(wrapper);
            this.renderStaticItems(shadow, items);
        }
    }
    renderStaticItems(shadow, items) {
        const container = shadow.querySelector('.recsys-container');
        if (!container)
            return;
        container.innerHTML = items.map(item => this.renderItemContent(item)).join('');
    }
    // --- CAROUSEL LOGIC ---
    setupCarousel(shadow, items) {
        var _a, _b, _c;
        // Lấy số lượng item cần hiện từ config (mặc định 5 nếu không có)
        const layout = this.config.layoutJson || {};
        const modeConfig = ((_a = layout.modes) === null || _a === void 0 ? void 0 : _a.carousel) || {};
        const itemsPerView = modeConfig.itemsPerView || modeConfig.columns || 5;
        console.log(itemsPerView);
        let currentIndex = 0;
        const slideContainer = shadow.querySelector('.recsys-container');
        if (!slideContainer)
            return;
        const renderSlide = () => {
            let html = '';
            // [FIX] Vòng lặp lấy N item liên tiếp thay vì chỉ 1 item
            for (let i = 0; i < itemsPerView; i++) {
                const index = (currentIndex + i) % items.length;
                html += this.renderItemContent(items[index]);
            }
            slideContainer.innerHTML = html;
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
        (_b = shadow.querySelector('.recsys-prev')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', prev);
        (_c = shadow.querySelector('.recsys-next')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', next);
        renderSlide();
        resetAutoSlide();
    }
}
//# sourceMappingURL=inline-display.js.map