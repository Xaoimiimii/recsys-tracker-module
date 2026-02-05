import { PopupConfig, StyleJson, LayoutJson } from '../../types';
import { RecommendationItem, RecommendationResponse } from '../recommendation';

export class PopupDisplay {
  private config: PopupConfig;
  private recommendationGetter: (limit: number) => Promise<RecommendationResponse>;
  private popupTimeout: NodeJS.Timeout | null = null;
  private autoCloseTimeout: NodeJS.Timeout | null = null;
  private autoSlideTimeout: NodeJS.Timeout | null = null;
  private shadowHost: HTMLElement | null = null;
  private hostId: string = ''; // Unique host ID cho mỗi PopupDisplay

  private spaCheckInterval: NodeJS.Timeout | null = null;
  private isPendingShow: boolean = false;
  private isManuallyClosed: boolean = false;
  private lastCheckedUrl: string = '';

  private readonly DEFAULT_DELAY = 5000;

  constructor(
    _domainKey: string,
    _slotName: string,
    _apiBaseUrl: string,
    config: PopupConfig = {} as PopupConfig,
    recommendationGetter: (limit: number) => Promise<RecommendationResponse>
  ) {
    this.recommendationGetter = recommendationGetter;
    this.hostId = `recsys-popup-host-${_slotName}-${Date.now()}`; // Unique ID based on slotName
    this.config = {
      delay: config.delay ?? this.DEFAULT_DELAY,
      autoCloseDelay: config.autoCloseDelay,
      ...config 
    };
  }

  start(): void {
    this.startWatcher();
  }

  stop(): void {
    this.clearTimeouts();
    if (this.spaCheckInterval) {
        clearInterval(this.spaCheckInterval);
        this.spaCheckInterval = null;
    }
    this.removePopup();
  }

  private generateTitle(search: string, lastItem: string): string {
    const context = this.config.triggerConfig?.targetValue; 
    
    const title = "Vì bạn đã trải nghiệm";
    const searchTitle = "Vì bạn đã tìm kiếm";

    if (context?.includes('search') || context?.includes('query')) {
      return `${searchTitle} "${search}"`;
    }
    
    if (lastItem && lastItem.trim() !== "") {
      return `${title} "${lastItem}"`;
    }

    return "Gợi ý dành riêng cho bạn";
  }

  public updateContent(response: RecommendationResponse): void {
    if (!this.shadowHost || !this.shadowHost.shadowRoot) return;

    const { items, search, lastItem } = response;
    if(!search) console.log("thiếu search");
    const titleElement = this.shadowHost.shadowRoot.querySelector('.recsys-header-title');
      if (titleElement) {
      titleElement.textContent = this.generateTitle(search, lastItem);
      const layout = (this.config.layoutJson as any) || {};
      if (layout.contentMode === 'carousel') {
        this.setupCarousel(this.shadowHost.shadowRoot, items);
      } else {
        this.renderStaticItems(this.shadowHost.shadowRoot, items);
      }
    }
  }

  private startWatcher(): void {
    if (this.spaCheckInterval) clearInterval(this.spaCheckInterval);

    this.spaCheckInterval = setInterval(async () => {
      const shouldShow = this.shouldShowPopup();
      const isVisible = this.shadowHost !== null;
      const currentUrl = window.location.pathname;

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
          } finally {
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

  private async showPopup(): Promise<void> {
    try {
      const response = await this.fetchRecommendations();
      const items = response.items;
      // Chỉ hiện nếu chưa hiện (double check)
      if (items && items.length > 0 && !this.shadowHost) {
        this.renderPopup(items, response.search, response.lastItem);
        
        // Logic autoClose (tự đóng sau X giây)
        if (this.config.autoCloseDelay && this.config.autoCloseDelay > 0) {
          this.autoCloseTimeout = setTimeout(() => {
            this.removePopup();
            // Sau khi đóng, Watcher vẫn chạy nên nếu URL vẫn đúng thì nó sẽ lại đếm ngược để hiện lại.
            // Nếu muốn hiện 1 lần duy nhất mỗi lần vào trang, cần thêm logic session storage.
          }, this.config.autoCloseDelay * 1000); 
        }
      }
    } catch (error) {
       this.isPendingShow = false;
    }
  }

  // --- LOGIC 1: TRIGGER CONFIG (URL CHECKING) ---
  private shouldShowPopup(): boolean {
    const trigger = this.config.triggerConfig;
    
    // Nếu không có trigger config, mặc định cho hiện (hoặc check pages cũ nếu cần)
    if (!trigger || !trigger.targetValue) return true;

    // Lấy URL hiện tại (pathname: /products/ao-thun)
    const currentUrl = window.location.pathname; 
    const targetUrl = trigger.targetValue;

    if (targetUrl === '/' && currentUrl !== '/') return false;

    return currentUrl.includes(targetUrl);
  }

  private scheduleNextPopup(): void {
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
      } else {
        // Nếu chuyển sang trang không khớp, thử lại sau (hoặc dừng hẳn tùy logic)
        this.scheduleNextPopup(); 
      }
    }, delay);
  }

  private async fetchRecommendations(): Promise<RecommendationResponse> {
    try {
      const limit = (this.config.layoutJson as any)?.maxItems || 50;
      console.log('[PopupDisplay] Calling recommendationGetter with limit:', limit);
      const result = await this.recommendationGetter(limit);
      console.log('[PopupDisplay] recommendationGetter result:', result);
      // recommendationGetter now returns full RecommendationResponse
      if (result && result.items && Array.isArray(result.items)) {
        return result; 
      }
      console.log('[PopupDisplay] Invalid result, returning empty');
      return { items: [], search: '', lastItem: '' };
    } catch (e) { 
      console.error('[PopupDisplay] fetchRecommendations error:', e);
      return { items: [], search: '', lastItem: '' }; 
    }
  }


  // --- LOGIC 2: DYNAMIC CSS GENERATOR ---
  // --- DYNAMIC CSS GENERATOR (FINAL CLEAN VERSION) ---
  private getDynamicStyles(): string {
    const style = this.config.styleJson || {} as StyleJson;
    const layout = this.config.layoutJson || {} as LayoutJson;
    
    // 1. Unpack Configs
    const tokens = style.tokens || {} as any;
    const components = style.components || {} as any;
    const size = style.size || 'md';
    const density = tokens.densityBySize?.[size] || {}; 
    
    // --- Helper Getters ---
    const getColor = (tokenName: string) => (tokens.colors as any)?.[tokenName] || tokenName || 'transparent';
    const getRadius = (tokenName: string) => {
        const r = (tokens.radius as any)?.[tokenName];
        return r !== undefined ? `${r}px` : '4px';
    };
    const getShadow = (tokenName: string) => (tokens.shadow as any)?.[tokenName] || 'none';

    // 2. Setup Dimensions
    const contentMode = layout.contentMode || 'grid'; 
    const modeConfig = layout.modes?.[contentMode as keyof typeof layout.modes] || {} as any;
    
    // Image Size logic
    const imgLayout = layout.card?.image?.sizeByMode?.[contentMode as 'grid' | 'list' | 'carousel'] || {};
    const imgHeightRaw = imgLayout.height || density.imageHeight || 140; 
    
    // [FIX] Carousel ưu tiên width từ config (96px) thay vì 100% để giống preview
    let imgWidthRaw = '100%';
    if (contentMode === 'list') imgWidthRaw = (imgLayout as any).width || 96;
    if (contentMode === 'carousel' && (imgLayout as any).width) imgWidthRaw = (imgLayout as any).width;

    const imgHeight = typeof imgHeightRaw === 'number' ? `${imgHeightRaw}px` : imgHeightRaw;
    const imgWidth = typeof imgWidthRaw === 'number' ? `${imgWidthRaw}px` : imgWidthRaw;

    // Popup Wrapper logic
    const popupWrapper = layout.wrapper?.popup || {} as any;
    const popupWidth = popupWrapper.width ? `${popupWrapper.width}px` : '340px';
    // const popupWidth = '340px';
    
    // Xử lý Height từ Config (Nếu JSON có height thì dùng, ko thì max-height)
    const popupHeightCSS = popupWrapper.height 
        ? `height: ${popupWrapper.height}px;` 
        : `height: auto; max-height: 50vh;`;

    let posCSS = 'bottom: 20px; right: 20px;';
    switch (popupWrapper.position) {
        case 'bottom-left': posCSS = 'bottom: 20px; left: 20px;'; break;
        case 'top-center': posCSS = 'top: 20px; left: 50%; transform: translateX(-50%);'; break;
        case 'center': posCSS = 'top: 50%; left: 50%; transform: translate(-50%, -50%);'; break;
    }

    // 3. Container Logic
    let containerCSS = '';
    let itemDir = 'column';
    let itemAlign = 'stretch';
    let infoTextAlign = 'left';   
    let infoAlignItems = 'flex-start';

    if (contentMode === 'grid') {
        const cols = modeConfig.columns || 2;
        const gapPx = tokens.spacingScale?.[modeConfig.gap || 'md'] || 12;
        containerCSS = `display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: ${gapPx}px; padding: ${density.cardPadding || 16}px;`;
    } else if (contentMode === 'list') {
        itemDir = 'row';
        itemAlign = 'flex-start';
        const gapPx = tokens.spacingScale?.[modeConfig.rowGap || 'md'] || 12;
        containerCSS = `display: flex; flex-direction: column; gap: ${gapPx}px; padding: ${density.cardPadding || 16}px;`;
        containerCSS = 'padding: 0;'; 
    }

    // 4. Styles Mapping
    const cardComp = components.card || {};
    const modeOverride = style.modeOverrides?.[contentMode as keyof typeof style.modeOverrides] || {};
    
    // Colors
    const colorTitle = getColor('textPrimary');
    const colorBody = getColor('textSecondary');
    const colorPrimary = getColor('primary'); // <--- ĐÃ KHAI BÁO LẠI ĐỂ DÙNG

    // Card Specifics
    const cardBg = getColor(cardComp.backgroundToken || 'surface');
    const cardBorder = cardComp.border ? `1px solid ${getColor(cardComp.borderColorToken)}` : 'none';
    const cardRadius = getRadius(cardComp.radiusToken || 'card');
    const cardShadow = getShadow(cardComp.shadowToken);
    const cardPadding = modeOverride.card?.paddingFromDensity 
        ? (density[modeOverride.card.paddingFromDensity as keyof typeof density] || 12) 
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
        box-shadow: ${tokens.shadow?.cardHover};
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
          font-size: ${tokens.typography?.title?.fontSize || 16}px;
          font-weight: ${tokens.typography?.title?.fontWeight || 600};
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
         gap: ${tokens.spacingScale?.sm || 8}px;
         background: ${cardBg}; border: ${cardBorder}; border-radius: ${cardRadius};
         box-shadow: ${cardShadow}; padding: ${cardPadding}px;
         cursor: pointer; transition: all 0.2s;
         width: 100%; min-width: 0; box-sizing: border-box; overflow: hidden;
      }

      /* SỬ DỤNG colorPrimary Ở ĐÂY */
      .recsys-item:hover .recsys-name {
          color: ${colorPrimary}; 
      }

      ${cardComp.hover?.enabled ? `
      .recsys-item:hover {
         transform: translateY(-${cardComp.hover.liftPx || 2}px);
         box-shadow: ${getShadow(cardComp.hover.shadowToken || 'cardHover')};
         /* Optional: border-color: ${colorPrimary}; */
      }
      ` : ''}

      .recsys-img-box {
         width: ${imgWidth}; height: ${imgHeight};
         border-radius: ${getRadius(components.image?.radiusFollowsCard ? cardComp.radiusToken : 'image')};
         overflow: hidden; background: ${getColor('muted')}; flex-shrink: 0; display: flex;
      }
      .recsys-img-box img { width: 100%; height: 100%; object-fit: ${components.image?.objectFit || 'cover'}; }

      .recsys-info { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; text-align: ${infoTextAlign}; 
        align-items: ${infoAlignItems}; width: 100%}
      
      .recsys-field-row {
        width: 100%;
        min-width: 0;
        display: block;
      }

      .recsys-badges { display: flex; flex-wrap: wrap; gap: 4px; margin-top: auto; }
      .recsys-badge { 
         font-size: 10px; 
         background: ${getColor(components.badge?.backgroundToken || 'primary')}; 
         color: ${components.badge?.textColor || '#fff'};
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
  private renderItemContent(item: RecommendationItem): string {
    const customizingFields = this.config.customizingFields?.fields || [];
    const activeFields = customizingFields.filter(f => f.isEnabled).sort((a,b) => a.position - b.position);
    
    // 1. Lấy Config Style & Colors
    const styleJson = this.config.styleJson || {} as any;
    const fieldOverrides = styleJson.components?.fieldRow?.overrides || {};
    const colors = styleJson.tokens?.colors || {}; // <--- Lấy bảng màu

    // Helper: Lấy giá trị item (Giữ nguyên)
    const getValue = (obj: any, configKey: string) => {
        if (!obj) return '';
        if (obj[configKey] !== undefined) return obj[configKey];
        const pascalKey = configKey.replace(/(_\w)/g, m => m[1].toUpperCase()).replace(/^\w/, c => c.toUpperCase());
        if (obj[pascalKey] !== undefined) return obj[pascalKey];
        const camelKey = configKey.replace(/(_\w)/g, m => m[1].toUpperCase());
        if (obj[camelKey] !== undefined) return obj[camelKey];
        if (obj[configKey.toUpperCase()] !== undefined) return obj[configKey.toUpperCase()];
        const lowerKey = configKey.toLowerCase();
        if (['title', 'name', 'product_name', 'item_name'].includes(lowerKey)) 
            return obj['Title'] || obj['title'] || obj['Name'] || obj['name'];
        if (['image', 'img', 'image_url', 'avatar'].includes(lowerKey)) 
            return obj['ImageUrl'] || obj['imageUrl'] || obj['Img'] || obj['img'] || obj['Image'] || obj['image'];
        return '';
    };

    // Helper mới: Tính toán Style cuối cùng (Kết hợp Default Theme + Manual Override)
    const getFinalStyle = (fieldKey: string) => {
        const key = fieldKey.toLowerCase();
        const override = (fieldOverrides as Record<string, any>)[fieldKey] || {};
        
        // A. XÁC ĐỊNH MÀU MẶC ĐỊNH DỰA THEO LOẠI FIELD (Mapping logic)
        let defaultColor = colors.textSecondary; // Mặc định là màu phụ
        let defaultWeight = '400';
        let defaultSize = 12;

        if (['title', 'name', 'product_name', 'item_name'].includes(key)) {
            defaultColor = colors.textPrimary;
            defaultWeight = '600';
            defaultSize = 14;
        } else if (key.includes('price')) {
            defaultColor = colors.primary; // Hoặc colors.warning tùy theme
            defaultWeight = '700';
            defaultSize = 14;
        } else if (key.includes('rating')) {
            defaultColor = colors.warning;
        } else if (key.includes('category') || key.includes('categories')) {
            defaultColor = colors.primary;
            defaultSize = 11;
        }

        // B. LẤY GIÁ TRỊ CUỐI CÙNG (Ưu tiên Override nếu có)
        const finalColor = override.color || defaultColor;
        const finalSize = override.fontSize || defaultSize;
        const finalWeight = override.fontWeight || defaultWeight;

        // C. TẠO CHUỖI CSS
        let style = '';
        if (finalColor) style += `color: ${finalColor} !important; `;
        if (finalSize) style += `font-size: ${finalSize}px !important; `;
        if (finalWeight) style += `font-weight: ${finalWeight} !important; `;

        if (['artist', 'singer', 'performer', 'artist_name', 'description'].includes(key)) {
          style += `
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis; 
            display: block; 
            max-width: 100%;
          `;
        }
        
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

        if (['image', 'img', 'image_url', 'title', 'name', 'product_name', 'item_name'].includes(key)) return;
        if (rawValue === undefined || rawValue === null || rawValue === '') return;

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

  private renderPopup(items: RecommendationItem[], search: string, lastItem: string): void {
    this.removePopup();

    //const returnMethodValue = (this.config as any).value || "";

    const dynamicTitle = this.generateTitle(search, lastItem);
    const host = document.createElement('div');
    host.id = this.hostId;
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = this.getDynamicStyles();
    shadow.appendChild(style);

    // Main Popup
    const layout: any = this.config.layoutJson || {};
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
    } else {
        // Nếu là Grid hoặc List -> Render tất cả items ra luôn
        this.renderStaticItems(shadow, items);
    }

    shadow.querySelector('.recsys-close')?.addEventListener('click', () => {
      if (this.autoSlideTimeout) clearTimeout(this.autoSlideTimeout);
      this.isManuallyClosed = true;
      this.removePopup();
    });
  }

  private renderStaticItems(shadow: ShadowRoot, items: RecommendationItem[]): void {
    const container = shadow.querySelector('.recsys-container');
    if (!container) return;
    container.innerHTML = '';
    items.forEach((item) => {
      const itemWrapper = document.createElement('div');
      itemWrapper.className = 'recsys-item';
      itemWrapper.innerHTML = this.renderItemContent(item);
      itemWrapper.addEventListener('click', () => {
        const targetId = item.DomainItemId;
        this.handleItemClick(targetId);
      });
      container.appendChild(itemWrapper);
    });
  }

  private setupCarousel(shadow: ShadowRoot, items: RecommendationItem[]): void {
    let currentIndex = 0;
    const slideContainer = shadow.querySelector('.recsys-slide') as HTMLElement;
    
    const renderSlide = () => {
      const item = items[currentIndex];
      slideContainer.innerHTML = '';
      
      const slideElement = document.createElement('div');
      slideElement.className = 'recsys-item';
      slideElement.innerHTML = this.renderItemContent(item);

      slideElement.addEventListener('click', () => {
        const targetId = item.DomainItemId || item.id || item.Id;
        if (targetId) this.handleItemClick(targetId);
      });

      slideContainer.appendChild(slideElement);
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
      if (this.autoSlideTimeout) clearTimeout(this.autoSlideTimeout);
      this.autoSlideTimeout = setTimeout(next, this.DEFAULT_DELAY);
    };

    shadow.querySelector('.recsys-prev')?.addEventListener('click', prev);
    shadow.querySelector('.recsys-next')?.addEventListener('click', next);

    renderSlide();
    resetAutoSlide();
  }

  private removePopup(): void {
    if (this.shadowHost) {
      this.shadowHost.remove();
      this.shadowHost = null;
      this.isPendingShow = false;
    }
  }

  private clearTimeouts(): void {
    if (this.popupTimeout) clearTimeout(this.popupTimeout);
    if (this.autoCloseTimeout) clearTimeout(this.autoCloseTimeout);
    if (this.autoSlideTimeout) clearTimeout(this.autoSlideTimeout);
    this.popupTimeout = null;
    this.autoCloseTimeout = null;
    this.autoSlideTimeout = null;
  }

  private handleItemClick(id: string | number): void {
      if (!id) return;
      
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
        
      } catch (error) {
        // Fallback to traditional navigation if History API fails
        window.location.href = targetUrl; 
      }
  }
}

