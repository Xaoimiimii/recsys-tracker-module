export class InlineDisplay {
    constructor(_domainKey, _slotName, selector, _apiBaseUrl, config = {}, recommendationGetter) {
        this.observer = null;
        this.debounceTimer = null;
        this.selector = selector;
        this.recommendationGetter = recommendationGetter;
        this.config = { ...config };
    }
    start() {
        // Inline thường chỉ cần check selector tồn tại, 
        // nhưng nếu có trigger config check URL thì thêm ở đây
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
        catch (error) { }
    }
    async fetchRecommendations() {
        try {
            return await this.recommendationGetter();
        }
        catch {
            return [];
        }
    }
    getTokenColor(tokenName, tokens) {
        var _a;
        return ((_a = tokens === null || tokens === void 0 ? void 0 : tokens.colors) === null || _a === void 0 ? void 0 : _a[tokenName]) || tokenName || 'transparent';
    }
    getTokenRadius(tokenName, tokens) {
        var _a;
        const val = (_a = tokens === null || tokens === void 0 ? void 0 : tokens.radius) === null || _a === void 0 ? void 0 : _a[tokenName];
        return val !== undefined ? `${val}px` : '0px';
    }
    // --- DYNAMIC CSS INLINE ---
    getWidgetStyles() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
        const style = this.config.styleJson || {};
        const layout = this.config.layoutJson || {};
        const tokens = style.tokens || {};
        const components = style.components || {};
        const contentMode = layout.contentMode || 'grid'; // grid | list
        const currentModeConfig = ((_a = layout.modes) === null || _a === void 0 ? void 0 : _a[contentMode]) || {};
        // Override cho mode hiện tại (nếu có)
        const modeOverride = ((_b = style.modeOverrides) === null || _b === void 0 ? void 0 : _b[contentMode]) || {};
        // 1. Base Styles & Grid/List Setup
        let containerCSS = '';
        if (contentMode === 'grid') {
            const gridConfig = currentModeConfig;
            const gap = gridConfig.gap || '16px';
            const cols = gridConfig.columns || 4;
            containerCSS = `
            display: grid;
            grid-template-columns: repeat(${cols}, 1fr);
            gap: ${((_d = (_c = style.tokens) === null || _c === void 0 ? void 0 : _c.spacingScale) === null || _d === void 0 ? void 0 : _d[gap]) || 12}px;
        `;
            // Responsive (Example logic based on breakpoints provided in JSON)
            if (gridConfig.responsive) {
                // Logic media query simple
                containerCSS += `
                @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); }
                @media (max-width: 480px) { grid-template-columns: 1fr; }
             `;
            }
        }
        else { // List
            const listConfig = currentModeConfig;
            const gap = listConfig.rowGap || '12px';
            containerCSS = `
            display: flex;
            flex-direction: column;
            gap: ${((_f = (_e = style.tokens) === null || _e === void 0 ? void 0 : _e.spacingScale) === null || _f === void 0 ? void 0 : _f[gap]) || 12}px;
        `;
        }
        // 2. Card Styles
        const cardComp = { ...components.card, ...modeOverride.card };
        const cardBg = this.getTokenColor(cardComp.backgroundToken, tokens);
        const cardBorderColor = this.getTokenColor(cardComp.borderColorToken, tokens);
        const cardRadius = this.getTokenRadius(cardComp.radiusToken, tokens);
        const cardShadow = ((_g = tokens.shadow) === null || _g === void 0 ? void 0 : _g[cardComp.shadowToken]) || 'none';
        const cardPadding = ((_k = (_j = (_h = style.tokens) === null || _h === void 0 ? void 0 : _h.densityBySize) === null || _j === void 0 ? void 0 : _j[style.size || 'md']) === null || _k === void 0 ? void 0 : _k.cardPadding) || 12;
        // 3. Image Styles
        const imgComp = { ...components.image, ...modeOverride.image };
        const imgLayout = layout.card.image || {};
        const imgSize = ((_l = imgLayout.sizeByMode) === null || _l === void 0 ? void 0 : _l[contentMode]) || {};
        // Image Layout logic
        let imgContainerCSS = '';
        let itemFlexDir = 'column';
        let itemAlignItems = 'stretch';
        if (contentMode === 'list') {
            itemFlexDir = 'row'; // List thì ảnh bên trái
            itemAlignItems = 'flex-start';
            imgContainerCSS = `
            width: ${imgSize.width || 96}px;
            height: ${imgSize.height || 96}px;
            flex-shrink: 0;
        `;
        }
        else {
            // Grid
            imgContainerCSS = `
            width: 100%;
            height: ${imgSize.height || 140}px;
        `;
        }
        // 4. Typography & Colors
        const typo = tokens.typography || {};
        const textColor = this.getTokenColor(((_o = (_m = components.fieldRow) === null || _m === void 0 ? void 0 : _m.value) === null || _o === void 0 ? void 0 : _o.colorToken) || 'textPrimary', tokens);
        //const labelColor = this.getTokenColor(components.fieldRow?.label?.colorToken || 'textSecondary', tokens);
        return `
      :host { 
          all: initial; 
          font-family: inherit; 
          width: 100%; 
          display: block; 
          box-sizing: border-box;
      }
      * { box-sizing: border-box; }

      .recsys-wrapper {
        ${containerCSS}
        padding: 16px 0;
      }

      .recsys-item {
        background: ${cardBg};
        border: ${cardComp.border ? `1px solid ${cardBorderColor}` : 'none'};
        border-radius: ${cardRadius};
        box-shadow: ${cardShadow};
        overflow: hidden;
        cursor: pointer;
        display: flex;
        flex-direction: ${itemFlexDir}; 
        align-items: ${itemAlignItems};
        transition: transform 0.2s, box-shadow 0.2s;
        padding: ${cardPadding}px;
        gap: 12px; /* Gap giữa ảnh và nội dung text */
      }

      ${((_p = cardComp.hover) === null || _p === void 0 ? void 0 : _p.enabled) ? `
      .recsys-item:hover {
        transform: translateY(-${cardComp.hover.liftPx || 0}px);
        box-shadow: ${((_q = tokens.shadow) === null || _q === void 0 ? void 0 : _q[cardComp.hover.shadowToken]) || 'none'};
      }
      ` : ''}

      .recsys-img-box {
        ${imgContainerCSS}
        border-radius: ${imgComp.radiusFollowsCard ? cardRadius : '4px'};
        overflow: hidden;
        background: ${this.getTokenColor('muted', tokens)};
        position: relative;
      }

      .recsys-img-box img {
        width: 100%; height: 100%; 
        object-fit: ${imgComp.objectFit || 'cover'};
        display: block;
      }

      .recsys-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: ${((_r = tokens.spacingScale) === null || _r === void 0 ? void 0 : _r[(_s = components.fieldRow) === null || _s === void 0 ? void 0 : _s.rowGapToken]) || 4}px;
        justify-content: center;
        min-width: 0; /* Fix flex overflow text */
      }

      /* Field Styling */
      
      .recsys-title {
          font-size: ${((_t = typo.title) === null || _t === void 0 ? void 0 : _t.fontSize) || 16}px;
          font-weight: ${((_u = typo.title) === null || _u === void 0 ? void 0 : _u.fontWeight) || 600};
          color: ${this.getTokenColor('textPrimary', tokens)};
          margin-bottom: 4px;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      }

      .recsys-value {
          color: ${textColor};
          white-space: nowrap; 
          overflow: hidden; 
          text-overflow: ellipsis;
      }

      /* Categories / Array Badges */
      .recsys-badges {
          display: flex; gap: 4px; flex-wrap: wrap;
      }
      .recsys-badge {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: ${this.getTokenRadius(((_v = tokens.radius) === null || _v === void 0 ? void 0 : _v.badge) || 'badge', tokens)};
          background: ${this.getTokenColor(((_w = components.badge) === null || _w === void 0 ? void 0 : _w.backgroundToken) || 'primary', tokens)};
          color: ${((_x = components.badge) === null || _x === void 0 ? void 0 : _x.textColor) || '#fff'};
      }

      /* Button / Actions */
      .recsys-actions {
          margin-top: auto;
          display: flex;
          justify-content: flex-end;
      }
      .recsys-btn {
          background: ${this.getTokenColor('primary', tokens)};
          color: #fff;
          border: none;
          padding: 6px 12px;
          border-radius: ${this.getTokenRadius(((_y = tokens.radius) === null || _y === void 0 ? void 0 : _y.button) || 'button', tokens)};
          font-size: 12px;
          cursor: pointer;
      }
    `;
    }
    // --- DYNAMIC HTML INLINE ---
    renderItemContent(item) {
        var _a;
        const fields = ((_a = this.config.customizingFields) === null || _a === void 0 ? void 0 : _a.fields) || [];
        const activeFields = fields.filter(f => f.isEnabled).sort((a, b) => a.position - b.position);
        let html = '';
        // Tách ảnh ra render riêng ở trên đầu card (chuẩn UI card)
        const imageField = activeFields.find(f => f.key === 'image' || f.key === 'img');
        if (imageField) {
            html += `
          <div class="recsys-img-box">
             <img src="${item.img}" alt="${item.title || ''}">
          </div>
        `;
        }
        html += `<div class="recsys-info">`;
        activeFields.forEach(field => {
            const key = field.key;
            if (key === 'image' || key === 'img')
                return; // Đã render ở trên
            let value = '';
            if (key === 'product_name' || key === 'name')
                value = item.title;
            else if (key === 'description')
                value = item.description;
            else
                value = item[key];
            if (value) {
                html += `<div class="recsys-field-${key}">${value}</div>`;
            }
        });
        html += `</div>`;
        return html;
    }
    renderWidget(container, items) {
        let shadow = container.shadowRoot;
        if (!shadow)
            shadow = container.attachShadow({ mode: 'open' });
        shadow.innerHTML = '';
        const style = document.createElement('style');
        style.textContent = this.getWidgetStyles();
        shadow.appendChild(style);
        const wrapper = document.createElement('div');
        wrapper.className = 'recsys-wrapper';
        items.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'recsys-item';
            itemEl.setAttribute('data-id', String(item.id));
            // GỌI RENDER ĐỘNG
            itemEl.innerHTML = this.renderItemContent(item);
            wrapper.appendChild(itemEl);
        });
        shadow.appendChild(wrapper);
    }
}
//# sourceMappingURL=inline-display.js.map