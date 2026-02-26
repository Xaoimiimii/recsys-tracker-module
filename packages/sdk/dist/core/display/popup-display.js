import { normalizeItems } from '../recommendation';
// --- BỘ TỪ ĐIỂN ĐA NGÔN NGỮ (MỞ RỘNG) ---
const translations = {
    // 🇻🇳 Tiếng Việt
    'vi': {
        searched: 'Vì bạn đã tìm kiếm "{keyword}"',
        experienced: 'Vì bạn đã trải nghiệm "{lastItem}"',
        default: 'Gợi ý dành riêng cho bạn'
    },
    // 🇺🇸 Tiếng Anh (Mặc định quốc tế)
    'en': {
        searched: 'Because you searched for "{keyword}"',
        experienced: 'Because you experienced "{lastItem}"',
        default: 'Recommendations just for you'
    },
    // 🇩🇪 Tiếng Đức (German)
    'de': {
        searched: 'Weil Sie nach "{keyword}" gesucht haben',
        experienced: 'Weil Sie "{lastItem}" angesehen haben',
        default: 'Empfehlungen speziell für Sie'
    },
    // 🇯🇵 Tiếng Nhật (Japan)
    'ja': {
        searched: '「{keyword}」を検索されたため',
        experienced: '「{lastItem}」をご覧になったため',
        default: 'あなただけのおすすめ'
    },
    // 🇷🇺 Tiếng Nga (Russia)
    'ru': {
        searched: 'Потому что вы искали "{keyword}"',
        experienced: 'Потому что вы интересовались "{lastItem}"',
        default: 'Рекомендации специально для вас'
    },
    // 🇫🇷 Tiếng Pháp (France)
    'fr': {
        searched: 'Parce que vous avez cherché "{keyword}"',
        experienced: 'Parce que vous avez consulté "{lastItem}"',
        default: 'Recommandations juste pour vous'
    },
    // 🇪🇸 Tiếng Tây Ban Nha (Spain)
    'es': {
        searched: 'Porque buscaste "{keyword}"',
        experienced: 'Porque viste "{lastItem}"',
        default: 'Recomendaciones solo para ti'
    },
    // 🇨🇳 Tiếng Trung (China - Simplified)
    'zh': {
        searched: '因为您搜索了“{keyword}”',
        experienced: '因为您浏览了“{lastItem}”',
        default: '为您量身定制的推荐'
    },
    // 🇰🇷 Tiếng Hàn (Korea)
    'ko': {
        searched: '"{keyword}" 검색 결과에 tàra',
        experienced: '"{lastItem}" 관련 추천',
        default: '회원님을 위한 맞춤 추천'
    }
};
export class PopupDisplay {
    constructor(_domainKey, _slotName, _apiBaseUrl, config = {}, recommendationGetter) {
        var _a;
        this.popupTimeout = null;
        this.autoCloseTimeout = null;
        this.autoSlideTimeout = null;
        this.shadowHost = null;
        this.hostId = ''; // Unique host ID cho mỗi PopupDisplay
        this.spaCheckInterval = null;
        this.isPendingShow = false;
        this.isManuallyClosed = false;
        this.lastCheckedUrl = '';
        this.DEFAULT_DELAY = 5000;
        this.currentLangCode = 'en'; // Biến lưu ngôn ngữ hiện tại
        this.currentSearchKeyword = '';
        this.currentLastItem = '';
        // Cache management
        this.cacheKey = '';
        this.CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
        this.recommendationGetter = recommendationGetter;
        this.domainKey = _domainKey;
        this.apiBaseUrl = _apiBaseUrl;
        this.hostId = `recsys-popup-host-${_slotName}-${Date.now()}`; // Unique ID based on slotName
        this.cacheKey = `recsys-cache-${_domainKey}`; // Shared cache for entire domain
        this.config = {
            delay: (_a = config.delay) !== null && _a !== void 0 ? _a : this.DEFAULT_DELAY,
            autoCloseDelay: config.autoCloseDelay,
            ...config
        };
        this.detectLanguage();
        this.setupLanguageObserver();
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
    detectLanguage() {
        let langCode = this.config.language || document.documentElement.lang || navigator.language;
        const shortCode = langCode ? langCode.substring(0, 2).toLowerCase() : 'vi';
        const newLangCode = translations[shortCode] ? shortCode : 'en';
        if (this.currentLangCode !== newLangCode) {
            this.currentLangCode = newLangCode;
            return true;
        }
        return false;
    }
    setupLanguageObserver() {
        const htmlElement = document.documentElement;
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'lang') {
                    const hasChanged = this.detectLanguage();
                    if (hasChanged && this.shadowHost && this.shadowHost.shadowRoot) {
                        const titleElement = this.shadowHost.shadowRoot.querySelector('.recsys-header-title');
                        if (titleElement) {
                            titleElement.textContent = this.generateTitle(this.currentSearchKeyword, this.currentLastItem, false, null);
                        }
                    }
                }
            });
        });
        observer.observe(htmlElement, { attributes: true, attributeFilter: ['lang'] });
    }
    t(key, variables) {
        var _a;
        let text = ((_a = translations[this.currentLangCode]) === null || _a === void 0 ? void 0 : _a[key]) || translations['vi'][key] || key;
        if (variables) {
            for (const [varName, varValue] of Object.entries(variables)) {
                text = text.replace(new RegExp(`{${varName}}`, 'g'), varValue);
            }
        }
        return text;
    }
    // private generateTitle(search: string, lastItem: string): string {
    //   const context = this.config.triggerConfig?.targetValue;
    //   // Trường hợp 1: Có keyword tìm kiếm
    //   if (context?.includes('search') || context?.includes('query')) {
    //     return this.t('searched', { keyword: search });
    //   }
    //   // Trường hợp 2: Có item xem gần nhất
    //   if (lastItem && lastItem.trim() !== "") {
    //     return this.t('experienced', { lastItem: lastItem });
    //   }
    //   // Trường hợp 3: Mặc định
    //   return this.t('default');
    // }
    generateTitle(search, lastItem, isUserAction, actionType) {
        var _a;
        const context = (_a = this.config.triggerConfig) === null || _a === void 0 ? void 0 : _a.targetValue;
        // Trường hợp 1: User action là search (ưu tiên cao nhất)
        if (actionType === 'search' && search && search.trim() !== "") {
            return this.t('searched', { keyword: search });
        }
        // Trường hợp 2: User action với lastItem (click vào item)
        if (isUserAction && lastItem && lastItem.trim() !== "") {
            return this.t('experienced', { lastItem: lastItem });
        }
        // Trường hợp 3: Config trigger là search page
        if (((context === null || context === void 0 ? void 0 : context.includes('search')) || (context === null || context === void 0 ? void 0 : context.includes('query'))) && search && search.trim() !== "") {
            return this.t('searched', { keyword: search });
        }
        // Trường hợp 4: Có lastItem (auto show)
        if (lastItem && lastItem.trim() !== "") {
            return this.t('experienced', { lastItem: lastItem });
        }
        // Trường hợp 5: Mặc định
        return this.t('default');
    }
    updateContent(response, isUserAction = false, actionType, isFromCache = false) {
        if (!this.shadowHost || !this.shadowHost.shadowRoot)
            return;
        const { keyword, lastItem } = response;
        const titleElement = this.shadowHost.shadowRoot.querySelector('.recsys-header-title');
        if (titleElement) {
            const newTitle = this.generateTitle(keyword, lastItem, isUserAction, actionType);
            // Smooth transition when updating from cache to fresh data
            if (!isFromCache && titleElement.textContent !== newTitle) {
                titleElement.style.transition = 'opacity 0.3s';
                titleElement.style.opacity = '0';
                setTimeout(() => {
                    titleElement.textContent = newTitle;
                    titleElement.style.opacity = '1';
                }, 300);
            }
            else {
                titleElement.textContent = newTitle;
            }
            const layout = this.config.layoutJson || {};
            if (layout.contentMode === 'carousel') {
                this.setupCarousel(this.shadowHost.shadowRoot, normalizeItems(response));
            }
            else {
                this.renderStaticItems(this.shadowHost.shadowRoot, normalizeItems(response));
            }
        }
    }
    startWatcher() {
        if (this.spaCheckInterval)
            clearInterval(this.spaCheckInterval);
        this.spaCheckInterval = setInterval(async () => {
            var _a, _b, _c, _d;
            const shouldShow = this.shouldShowPopup();
            const isVisible = this.shadowHost !== null;
            const currentUrl = window.location.pathname;
            const isSearchPage = ((_b = (_a = this.config.triggerConfig) === null || _a === void 0 ? void 0 : _a.targetValue) === null || _b === void 0 ? void 0 : _b.includes('search')) || ((_d = (_c = this.config.triggerConfig) === null || _c === void 0 ? void 0 : _c.targetValue) === null || _d === void 0 ? void 0 : _d.includes('query'));
            if (isSearchPage && !this.shadowHost && !this.isManuallyClosed) {
                return;
            }
            // Nếu URL thay đổi, reset lại trạng thái để cho phép hiện ở trang mới
            if (currentUrl !== this.lastCheckedUrl) {
                this.isManuallyClosed = false;
                this.isPendingShow = false;
                this.lastCheckedUrl = currentUrl;
            }
            if (!shouldShow) {
                if (isVisible || this.isPendingShow) {
                    this.removePopup();
                    this.clearTimeouts();
                    this.isPendingShow = false;
                }
                return;
            }
            // CHỈ BẮT ĐẦU ĐẾM NGƯỢC NẾU:
            // URL khớp + Chưa hiện + Chưa đang đợi + Chưa đóng tay
            if (shouldShow && !isVisible && !this.isPendingShow && !this.isManuallyClosed) {
                this.isPendingShow = true; // KHÓA NGAY LẬP TỨC
                const delay = this.config.delay || 0;
                this.popupTimeout = setTimeout(async () => {
                    try {
                        if (this.shouldShowPopup() && !this.shadowHost) {
                            await this.showPopup();
                        }
                    }
                    finally {
                        // KHÔNG reset isPendingShow về false nếu showPopup không tạo ra shadowHost
                        // Điều này ngăn việc chu kỳ Watcher sau lại nhảy vào đây khi items rỗng
                        if (this.shadowHost) {
                            this.isPendingShow = false;
                        }
                    }
                }, delay);
            }
        }, 1000);
    }
    // Hàm lên lịch hiển thị (tách riêng logic delay)
    // private scheduleShow(): void {
    //     const delay = this.config.delay || 0;
    //     this.isPendingShow = true;
    //     this.popupTimeout = setTimeout(() => {
    //         if (this.shouldShowPopup()) {
    //             this.showPopup();
    //         }
    //         this.isPendingShow = false;
    //     }, delay);
    // }
    async showPopup(isUserAction = false, actionType = null) {
        try {
            // 🚀 OPTIMISTIC UI: Show cached data immediately if available
            const cached = this.getCache();
            if (cached && cached.item && cached.item.length > 0 && !this.shadowHost) {
                const cachedItems = normalizeItems(cached);
                this.renderPopup(cachedItems, cached.keyword, cached.lastItem, isUserAction, actionType);
                // Setup autoClose for cached popup
                if (this.config.autoCloseDelay && this.config.autoCloseDelay > 0) {
                    this.autoCloseTimeout = setTimeout(() => {
                        this.removePopup();
                    }, this.config.autoCloseDelay * 1000);
                }
            }
            // 🔄 FETCH FRESH DATA: Update in background
            const response = await this.fetchRecommendations();
            const items = normalizeItems(response);
            if (items && items.length > 0) {
                // Save fresh data to cache
                this.saveCache(response);
                if (!this.shadowHost) {
                    // No cached popup was shown, render fresh data
                    this.renderPopup(items, response.keyword, response.lastItem, isUserAction, actionType);
                    if (this.config.autoCloseDelay && this.config.autoCloseDelay > 0) {
                        this.autoCloseTimeout = setTimeout(() => {
                            this.removePopup();
                        }, this.config.autoCloseDelay * 1000);
                    }
                }
                else {
                    // Update existing popup with fresh data
                    this.updateContent(response, isUserAction, actionType, false);
                }
            }
        }
        catch (error) {
            this.isPendingShow = false;
            // If fetch fails but cache was shown, keep the cached popup
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
    async fetchRecommendations() {
        var _a;
        try {
            const limit = ((_a = this.config.layoutJson) === null || _a === void 0 ? void 0 : _a.maxItems) || 50;
            const result = await this.recommendationGetter(limit);
            // recommendationGetter now returns full RecommendationResponse
            if (result && result.item && Array.isArray(result.item)) {
                return result;
            }
            return { item: [], keyword: '', lastItem: '' };
        }
        catch (e) {
            return { item: [], keyword: '', lastItem: '' };
        }
    }
    // --- CACHE MANAGEMENT ---
    saveCache(data) {
        try {
            sessionStorage.setItem(this.cacheKey, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        }
        catch (e) {
            // Quota exceeded or sessionStorage not available, silently fail
        }
    }
    getCache() {
        try {
            const cached = sessionStorage.getItem(this.cacheKey);
            if (!cached)
                return null;
            const { data, timestamp } = JSON.parse(cached);
            // Check if cache is expired
            if (Date.now() - timestamp > this.CACHE_MAX_AGE) {
                this.clearCache(); // Remove stale cache
                return null;
            }
            return data;
        }
        catch {
            return null;
        }
    }
    clearCache() {
        try {
            sessionStorage.removeItem(this.cacheKey);
        }
        catch {
            // Silently fail if sessionStorage not available
        }
    }
    // --- LOGIC 2: DYNAMIC CSS GENERATOR ---
    // --- DYNAMIC CSS GENERATOR (FINAL CLEAN VERSION) ---
    getDynamicStyles() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
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
        // const imgLayout = layout.card?.image?.sizeByMode?.[contentMode as 'grid' | 'list' | 'carousel'] || {};
        // const imgHeightRaw = imgLayout.height || density.imageHeight || 140; 
        // [FIX] Carousel ưu tiên width từ config (96px) thay vì 100% để giống preview
        // let imgWidthRaw = '100%';
        // if (contentMode === 'list') imgWidthRaw = (imgLayout as any).width || 96;
        // if (contentMode === 'carousel' && (imgLayout as any).width) imgWidthRaw = (imgLayout as any).width;
        // const imgHeight = typeof imgHeightRaw === 'number' ? `${imgHeightRaw}px` : imgHeightRaw;
        // const imgWidth = typeof imgWidthRaw === 'number' ? `${imgWidthRaw}px` : imgWidthRaw;
        // Popup Wrapper logic
        const popupWrapper = ((_c = layout.wrapper) === null || _c === void 0 ? void 0 : _c.popup) || {};
        const popupWidth = popupWrapper.width ? `${popupWrapper.width}px` : '340px';
        // const popupWidth = '340px';
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
        let infoTextAlign = 'left';
        let infoAlignItems = 'flex-start';
        if (contentMode === 'grid') {
            const cols = modeConfig.columns || 2;
            const gapPx = ((_d = tokens.spacingScale) === null || _d === void 0 ? void 0 : _d[modeConfig.gap || 'md']) || 12;
            containerCSS = `
        display: grid; 
        grid-template-columns: repeat(${cols}, 1fr); 
        // gap: ${gapPx}px; 
        gap: 16px; 
        padding: ${density.cardPadding || 16}px;
        `;
        }
        else if (contentMode === 'list') {
            itemDir = 'row';
            itemAlign = 'flex-start';
            const gapPx = ((_e = tokens.spacingScale) === null || _e === void 0 ? void 0 : _e[modeConfig.rowGap || 'md']) || 12;
            containerCSS = `
        display: flex; 
        flex-direction: column;
        // gap: ${gapPx}px; 
        gap: 16px;
        padding: ${density.cardPadding || 16}px;
        `;
            containerCSS = 'padding: 0;';
        }
        // 4. Styles Mapping
        const cardComp = components.card || {};
        const modeOverride = ((_f = style.modeOverrides) === null || _f === void 0 ? void 0 : _f[contentMode]) || {};
        // Colors
        const colorTitle = getColor('textPrimary');
        const colorBody = getColor('textSecondary');
        const colorPrimary = getColor('primary'); // <--- ĐÃ KHAI BÁO LẠI ĐỂ DÙNG
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
      :host { all: initial; font-family: inherit; box-sizing: border-box; }
      * { box-sizing: border-box; }

      .recsys-popup {
        position: fixed; ${posCSS} width: ${popupWidth}; ${popupHeightCSS}
        background: ${getColor('surface')};
        color: ${colorTitle};
        border-radius: ${getRadius('card')}; 
        box-shadow: ${(_h = tokens.shadow) === null || _h === void 0 ? void 0 : _h.cardHover};
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
          font-size: ${((_k = (_j = tokens.typography) === null || _j === void 0 ? void 0 : _j.title) === null || _k === void 0 ? void 0 : _k.fontSize) || 16}px;
          font-weight: ${((_m = (_l = tokens.typography) === null || _l === void 0 ? void 0 : _l.title) === null || _m === void 0 ? void 0 : _m.fontWeight) || 600};
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
         display: flex; 
         flex-direction: ${itemDir}; 
         align-items: ${itemAlign};
         gap: ${((_o = tokens.spacingScale) === null || _o === void 0 ? void 0 : _o.sm) || 8}px;
         background: ${cardBg}; 
         border: ${cardBorder}; 
         border-radius: ${cardRadius};
         box-shadow: ${cardShadow}; 
         padding: ${cardPadding}px;
         cursor: pointer; 
         transition: all 0.2s;
         width: 100%; 
         min-width: 0; 
         box-sizing: border-box; 
         overflow: hidden;
      }

      /* SỬ DỤNG colorPrimary Ở ĐÂY */
      .recsys-item:hover .recsys-name {
          color: ${colorPrimary}; 
      }

      ${((_p = cardComp.hover) === null || _p === void 0 ? void 0 : _p.enabled) ? `
      .recsys-item:hover {
        //  transform: translateY(-${cardComp.hover.liftPx || 1}px);
        scale: 1.02;
         box-shadow: ${getShadow(cardComp.hover.shadowToken || 'cardHover')};
         /* Optional: border-color: ${colorPrimary}; */
      }
      ` : ''}

      .recsys-img-box {
          position: relative;
          width: 100%;
          overflow: hidden;
          border-radius: 4px;
      }

      .recsys-img-box img { 
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          border-radius: 4px;
          background-color: var(--sidebar-bg);
          transition: all 0.3s ease;
      }

      .recsys-info { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; text-align: ${infoTextAlign}; 
        align-items: ${infoAlignItems}; width: 100%}
      
      .recsys-name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: block;
        max-width: 100%;
      }

      .recsys-field-row {
        width: 100%;
        min-width: 0;
        display: block;
      }

      .recsys-value {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: block;
        max-width: 100%;
      }

      .recsys-badges { display: flex; flex-wrap: wrap; gap: 4px; margin-top: auto; }
      .recsys-badge { 
         font-size: 10px; 
         background: ${getColor(((_q = components.badge) === null || _q === void 0 ? void 0 : _q.backgroundToken) || 'primary')}; 
         color: ${((_r = components.badge) === null || _r === void 0 ? void 0 : _r.textColor) || '#fff'};
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
            // if (['artist', 'singer', 'performer', 'artist_name', 'description'].includes(key)) {
            //   style += `
            //     white-space: nowrap; 
            //     overflow: hidden; 
            //     text-overflow: ellipsis; 
            //     display: block; 
            //     max-width: 100%;
            //   `;
            // }
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
       <div class="recsys-item" data-id="${item.id}">
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
            let rawValue = getValue(item, field.key);
            if (!rawValue) {
                return;
            }
            if (['image', 'img', 'image_url', 'title', 'name', 'product_name', 'item_name'].includes(key))
                return;
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
    renderPopup(items, search, lastItem, isUserAction = false, actionType) {
        // Lưu keyword và lastItem để language observer có thể regenerate title
        // this.currentSearchKeyword = search || '';
        // this.currentLastItem = lastItem || '';
        var _a;
        this.removePopup();
        //const returnMethodValue = (this.config as any).value || "";
        const dynamicTitle = this.generateTitle(search, lastItem, isUserAction, actionType);
        const host = document.createElement('div');
        host.id = this.hostId;
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
        <span class="recsys-header-title">${dynamicTitle}</span>
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
        container.innerHTML = '';
        items.forEach((item, index) => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = this.renderItemContent(item);
            const itemElement = tempDiv.firstElementChild;
            if (itemElement) {
                itemElement.addEventListener('click', () => {
                    const targetId = item.DomainItemId;
                    const rank = index + 1;
                    this.handleItemClick(targetId, rank);
                });
                container.appendChild(itemElement);
            }
        });
    }
    setupCarousel(shadow, items) {
        var _a, _b;
        let currentIndex = 0;
        const slideContainer = shadow.querySelector('.recsys-slide');
        const renderSlide = () => {
            const item = items[currentIndex];
            slideContainer.innerHTML = '';
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = this.renderItemContent(item);
            const slideElement = tempDiv.firstElementChild;
            if (slideElement) {
                slideElement.addEventListener('click', () => {
                    const targetId = item.DomainItemId || item.id || item.Id;
                    const rank = currentIndex + 1;
                    if (targetId)
                        this.handleItemClick(targetId, rank);
                });
                slideContainer.appendChild(slideElement);
            }
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
    async handleItemClick(id, rank) {
        if (!id)
            return;
        // Invalidate cache since user context has changed
        this.clearCache();
        // Send evaluation request
        try {
            const evaluationUrl = `${this.apiBaseUrl}/evaluation`;
            await fetch(evaluationUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    DomainKey: this.domainKey,
                    Rank: rank
                })
            });
        }
        catch (error) {
            // //console.error('[PopupDisplay] Failed to send evaluation:', error);
        }
        // const targetUrl = `/song/${id}`;
        let urlPattern = this.config.layoutJson.itemUrlPattern || '/song/{:id}';
        const targetUrl = urlPattern.replace('{:id}', id.toString());
        // Try SPA-style navigation first
        try {
            // 1. Update URL without reload
            window.history.pushState({}, '', targetUrl);
            // 2. Dispatch events to notify SPA frameworks
            window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
            // 3. Custom event for frameworks that listen to custom routing events
            window.dispatchEvent(new CustomEvent('navigate', {
                detail: { path: targetUrl, from: 'recsys-tracker' }
            }));
            // 4. Trigger link click event (some frameworks listen to this)
            // const clickEvent = new MouseEvent('click', {
            //   bubbles: true,
            //   cancelable: true,
            //   view: window
            // });
            // If navigation didn't work (URL changed but page didn't update), fallback
            // Check after a short delay if the page updated
            setTimeout(() => {
                // If window.location.pathname is different from targetUrl, means framework didn't handle it
                // So we need to force reload
                if (window.location.pathname !== targetUrl) {
                    window.location.href = targetUrl;
                }
            }, 100);
        }
        catch (error) {
            // Fallback to traditional navigation if History API fails
            window.location.href = targetUrl;
        }
    }
    forceShow(isUserAction = false, actionType = null) {
        //console.log('[Popup] Forced show: ', actionType);
        this.isManuallyClosed = false;
        this.isPendingShow = false;
        this.removePopup();
        if (this.shouldShowPopup()) {
            this.showPopup(isUserAction, actionType);
        }
    }
}
//# sourceMappingURL=popup-display.js.map