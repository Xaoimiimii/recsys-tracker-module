import { InlineConfig, StyleJson, LayoutJson } from '../../types';
import { RecommendationItem, RecommendationResponse, normalizeItems } from '../recommendation';

export class InlineDisplay {
  private selector: string;
  private config: InlineConfig;
  private recommendationGetter: () => Promise<RecommendationResponse>;
  private observer: MutationObserver | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private autoSlideTimeout: NodeJS.Timeout | null = null;
  
  private readonly DEFAULT_DELAY = 5000;
  private domainKey: string;
  private apiBaseUrl: string;

  constructor(
    _domainKey: string,
    _slotName: string,
    selector: string,
    _apiBaseUrl: string,
    config: InlineConfig = {} as InlineConfig,
    recommendationGetter: () => Promise<RecommendationResponse>
  ) {
    this.selector = selector;
    this.domainKey = _domainKey;
    this.apiBaseUrl = _apiBaseUrl;
    this.recommendationGetter = recommendationGetter;
    this.config = { ...config };
  }

  start(): void {
    this.scanAndRender();
    this.setupObserver();
  }

  stop(): void {
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
  private setupObserver(): void {
    this.observer = new MutationObserver(() => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.scanAndRender();
      }, 100);
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  private scanAndRender(): void {
    const containers = this.findContainers();
    containers.forEach(container => {
      this.processContainer(container as HTMLElement);
    });
  }

  private findContainers(): NodeListOf<Element> {
    let containers = document.querySelectorAll(this.selector);
    
    if (containers.length === 0) {
      // Get the base name without special characters
      let baseName = this.selector.replace(/^[.#]/, ''); // Remove leading . or #
      
      // Strategy 1: Try as class selector
      if (!this.selector.startsWith('.')) {
        const classSelector = `.${baseName}`;
        containers = document.querySelectorAll(classSelector);
      }
      
      // Strategy 2: Try attribute selector for CSS Modules
      if (containers.length === 0) {
        const attributeSelector = `[class*="${baseName}"]`;
        containers = document.querySelectorAll(attributeSelector);
      }
      
      // Strategy 3: Try as ID
      if (containers.length === 0 && !this.selector.startsWith('#')) {
        const idSelector = `#${baseName}`;
        containers = document.querySelectorAll(idSelector);
      }
      
      // Strategy 4: Try without leading dot (for edge cases)
      if (containers.length === 0 && this.selector.startsWith('.')) {
        containers = document.querySelectorAll(baseName);
      }
    }
    
    return containers;
  }

  private async processContainer(container: HTMLElement): Promise<void> {
    if (!container || container.getAttribute('data-recsys-loaded') === 'true') {
      return;
    }
    container.setAttribute('data-recsys-loaded', 'true');

    try {
      // Render skeleton loading state immediately
      this.renderSkeletonWidget(container);
      
      // Fetch recommendations asynchronously
      const response = await this.fetchRecommendations();
      const items = normalizeItems(response);

      // Replace skeleton with actual content
      if (items && items.length > 0) {
        this.renderWidget(container, items);
      }
    } catch (error) {
      // console.error('[InlineDisplay] Error processing container', error);
    }
  }

  private async fetchRecommendations(): Promise<RecommendationResponse> {
    try {
      // const limit = (this.config.layoutJson as any)?.maxItems || 50;
      // console.log('[PopupDisplay] Calling recommendationGetter with limit:', limit);
      const result = await this.recommendationGetter();
      // console.log('[PopupDisplay] recommendationGetter result:', result);
      // recommendationGetter now returns full RecommendationResponse
      if (result && result.item && Array.isArray(result.item)) {
        return result; 
      }
      // console.log('[PopupDisplay] Invalid result, returning empty');
      return { item: [], keyword: '', lastItem: '' };
    } catch (e) { 
      // console.error('[PopupDisplay] fetchRecommendations error:', e);
      return { item: [], keyword: '', lastItem: '' }; 
    }
  }

  // --- DYNAMIC CSS GENERATOR (SYNCED WITH POPUP) ---
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
    let infoTextAlign = 'left';
    let infoAlignItems = 'flex-start';
    let itemWidthCSS = 'width: 100%;';

    if (contentMode === 'grid') {
      const cols = modeConfig.columns || 4; // Inline default thường rộng hơn popup (4 cột)
      const gapPx = tokens.spacingScale?.[modeConfig.gap || 'md'] || 16;
      containerCSS = `
          display: grid;
          grid-template-columns: repeat(${cols}, 1fr);
          gap: ${gapPx}px;
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
    } else if (contentMode === 'list') {
      itemDir = 'row';
      itemAlign = 'flex-start';
      const gapPx = tokens.spacingScale?.[modeConfig.rowGap || 'md'] || 12;
      containerCSS = `display: flex; flex-direction: column; gap: ${gapPx}px;`;
    } else if (contentMode === 'carousel') {
      const cols = modeConfig.itemsPerView || modeConfig.columns || 5; 
      const gap = tokens.spacingScale?.[modeConfig.gap || 'md'] || 16;
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
    const modeOverride = style.modeOverrides?.[contentMode as keyof typeof style.modeOverrides] || {};
    
    // Colors
    const colorTitle = getColor('textPrimary');
    //const colorBody = getColor('textSecondary');
    const colorPrimary = getColor('primary');

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
    :host { all: initial; font-family: inherit; width: 100%; display: block; box-sizing: border-box; }
    * { box-sizing: border-box; }

    .recsys-wrapper {
      width: 100%;
      background: ${getColor('surface') || 'transparent'};
      border-radius: 8px;
    }

    .recsys-header {
      border-bottom: 1px solid ${getColor('border')};
      padding-bottom: 8px;
      justify-content: space-between; align-items: center;
    }
    .recsys-header-title {
      font-size: ${tokens.typography?.title?.fontSize || 18}px;
      font-weight: ${tokens.typography?.title?.fontWeight || 600};
      color: ${colorTitle};
    }

    .recsys-container { ${containerCSS} }

    .recsys-item {
      display: flex; flex-direction: ${itemDir}; align-items: ${itemAlign};
      gap: ${tokens.spacingScale?.sm || 8}px;
      background: ${cardBg}; border: ${cardBorder}; border-radius: ${cardRadius};
      box-shadow: ${cardShadow}; padding: ${cardPadding}px;
      cursor: pointer; transition: all 0.2s;
      ${itemWidthCSS}
      min-width: 0; /* Fix flex overflow */
    }

    .recsys-item:hover .recsys-name {
      color: ${colorPrimary}; 
    }

    ${cardComp.hover?.enabled ? `
    .recsys-item:hover {
      // transform: translateY(-${cardComp.hover.liftPx || 2}px);
      scale: 1.02;
      box-shadow: ${getShadow(cardComp.hover.shadowToken || 'cardHover')};
    }
    ` : ''}

    .recsys-img-box {
        width: 100%;
        aspect-ratio: 1;
        overflow: hidden; 
        // background: ${getColor('muted')}; 
        flex-shrink: 0;
        border-radius: 4px;
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

    /* Skeleton Loading Styles */
    .skeleton-item {
      display: flex;
      flex-direction: ${itemDir};
      align-items: ${itemAlign};
      gap: ${tokens.spacingScale?.sm || 8}px;
      background: ${cardBg};
      border: ${cardBorder};
      border-radius: ${cardRadius};
      padding: ${cardPadding}px;
      ${itemWidthCSS}
      min-width: 0;
      box-sizing: border-box;
      overflow: hidden;
      pointer-events: none;
    }

    .skeleton {
      background: linear-gradient(90deg, #e0e0e0 25%, #d0d0d0 50%, #e0e0e0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .skeleton-img {
      width: 100%;
      aspect-ratio: 1;
      flex-shrink: 0;
    }

    .skeleton-info {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
      min-width: 0;
      width: 100%;
    }

    .skeleton-title {
      height: 16px;
      width: 80%;
    }

    .skeleton-text {
      height: 12px;
      width: 60%;
    }

    .skeleton-text-short {
      height: 12px;
      width: 40%;
    }
  `;
  }

  // --- SKELETON LOADING STATE ---
  private renderSkeletonItem(): string {
    return `
      <div class="skeleton-item">
        <div class="skeleton-img skeleton"></div>
        <div class="skeleton-info">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text-short"></div>
        </div>
      </div>
    `;
  }

  private renderSkeletonWidget(container: HTMLElement): void {
    const layout: any = this.config.layoutJson || {};
    const contentMode = layout.contentMode || 'grid';
    const modeConfig = layout.modes?.[contentMode as keyof typeof layout.modes] || {} as any;
    
    // Determine skeleton count based on mode
    let skeletonCount = 4;
    if (contentMode === 'grid') {
      skeletonCount = modeConfig.columns || 4;
      if (skeletonCount < 4) skeletonCount = 4; // At least 4 items for grid
    } else if (contentMode === 'list') {
      skeletonCount = 3;
    } else if (contentMode === 'carousel') {
      skeletonCount = modeConfig.itemsPerView || 5;
    }

    container.innerHTML = '';
    const shadow = container.attachShadow({ mode: 'open' });
    
    const style = document.createElement('style');
    style.textContent = this.getDynamicStyles();
    shadow.appendChild(style);

    const wrapper = document.createElement('div');
    wrapper.className = 'recsys-widget';
    
    if (contentMode === 'carousel') {
      wrapper.innerHTML = `
        <button class="recsys-nav recsys-prev">‹</button>
        <div class="recsys-container"></div>
        <button class="recsys-nav recsys-next">›</button>
      `;
    } else {
      wrapper.innerHTML = '<div class="recsys-container"></div>';
    }
    
    shadow.appendChild(wrapper);

    const containerEl = shadow.querySelector('.recsys-container');
    if (containerEl) {
      for (let i = 0; i < skeletonCount; i++) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = this.renderSkeletonItem();
        const skeletonElement = tempDiv.firstElementChild;
        if (skeletonElement) {
          containerEl.appendChild(skeletonElement);
        }
      }
    }
  }

  // --- DYNAMIC HTML RENDERER (SYNCED WITH POPUP) ---
  private renderItemContent(item: RecommendationItem): string {
    const customizingFields = this.config.customizingFields?.fields || [];
    const activeFields = customizingFields.filter(f => f.isEnabled).sort((a,b) => a.position - b.position);
    
    // 1. Configs & Colors
    const styleJson = this.config.styleJson || {} as any;
    const fieldOverrides = styleJson.components?.fieldRow?.overrides || {};
    const colors = styleJson.tokens?.colors || {};

    // Helper: Smart Get Value
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

    // Helper: Get Final Style (Override > Default)
    const getFinalStyle = (fieldKey: string) => {
      const key = fieldKey.toLowerCase();
      const override = (fieldOverrides as Record<string, any>)[fieldKey] || {};
      
      let defaultColor = colors.textSecondary;
      let defaultWeight = '400';
      let defaultSize = 12;

      if (['title', 'name', 'product_name', 'item_name'].includes(key)) {
          defaultColor = colors.textPrimary;
          defaultWeight = '600';
          defaultSize = 14;
      } else if (key.includes('price')) {
          defaultColor = colors.primary;
          defaultWeight = '700';
          defaultSize = 14;
      } else if (key.includes('rating')) {
          defaultColor = colors.warning;
      } else if (key.includes('category') || key.includes('categories')) {
          defaultColor = colors.primary;
          defaultSize = 11;
      }

      const finalColor = override.color || defaultColor;
      const finalSize = override.fontSize || defaultSize;
      const finalWeight = override.fontWeight || defaultWeight;

      let style = '';
      if (finalColor) style += `color: ${finalColor} !important; `;
      if (finalSize) style += `font-size: ${finalSize}px !important; `;
      if (finalWeight) style += `font-weight: ${finalWeight} !important; `;
      // if (['artist', 'singer', 'performer', 'artist_name', 'description'].includes(key)) {
      //   style += `
      //     white-space: nowrap; 
      //     overflow: hidden; 
      //     text-overflow: ellipsis; 
      //     display: block; 
      //     max-width: 100%;
      //     width: 100%;
      //   `;
      // }
      
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
      if (['image', 'img', 'image_url', 'title', 'name', 'product_name', 'item_name'].includes(key)) return;

      let rawValue = getValue(item, field.key);
      if (rawValue === undefined || rawValue === null || rawValue === '') return;

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
  private renderWidget(container: HTMLElement, items: RecommendationItem[]): void {
    let shadow = container.shadowRoot;
    if (!shadow) shadow = container.attachShadow({ mode: 'open' });
    shadow.innerHTML = '';

    const style = document.createElement('style');
    style.textContent = this.getDynamicStyles();
    shadow.appendChild(style);

    const styleJson = this.config.styleJson || {} as any;
    const layout: any = this.config.layoutJson || {};
    const contentMode = layout.contentMode || 'grid';
    // const title = layout.wrapper?.header?.title || 'Gợi ý cho bạn';

    const wrapper = document.createElement('div');
    wrapper.className = 'recsys-wrapper';
    
    // // Header
    // const headerHTML = `
    //   <div class="recsys-header">
    //     <span class="recsys-header-title">${title}</span>
    //   </div>
    // `;

    // [FIX] Tách biệt logic render để tránh ghi đè innerHTML
    if (contentMode === 'carousel') {
      const modeConfig = layout.modes?.carousel || {};
      const gap = styleJson?.tokens?.spacingScale?.[modeConfig.gap || 'md'] || 16;

      // Render cấu trúc Carousel
      // wrapper.innerHTML = headerHTML + `
      //   <div style="position: relative; width: 100%; max-width: 100%;">
      //     <button class="recsys-nav recsys-prev">‹</button>
          
      //     <div class="recsys-container" style="display: flex; overflow: hidden; width: 100%; gap: ${gap}px;"></div>
          
      //     <button class="recsys-nav recsys-next">›</button>
      //   </div>`;

      wrapper.innerHTML = `
        <div style="position: relative; width: 100%; max-width: 100%;">
          <button class="recsys-nav recsys-prev">‹</button>
          
          <div class="recsys-container" style="display: flex; overflow: hidden; width: 100%; gap: ${gap}px;"></div>
          
          <button class="recsys-nav recsys-next">›</button>
        </div>`;
         
      shadow.appendChild(wrapper);
      this.setupCarousel(shadow, items); // Khởi tạo logic carousel
    } else {
      // Render cấu trúc Grid/List
      // wrapper.innerHTML = headerHTML + `<div class="recsys-container"></div>`;
      wrapper.innerHTML = `<div class="recsys-container"></div>`;
      shadow.appendChild(wrapper);
      this.renderStaticItems(shadow, items);
    }
  }

  private renderStaticItems(shadow: ShadowRoot, items: RecommendationItem[]): void {
    const container = shadow.querySelector('.recsys-container');
    if (!container) return;
    container.innerHTML = '';
    items.forEach((item, index) => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = this.renderItemContent(item);
      const itemElement = tempDiv.firstElementChild as HTMLElement;
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

  // --- CAROUSEL LOGIC ---
  private setupCarousel(shadow: ShadowRoot, items: RecommendationItem[]): void {
    // Lấy số lượng item cần hiện từ config (mặc định 5 nếu không có)
    const layout = this.config.layoutJson || {} as any;
    const modeConfig = layout.modes?.carousel || {};
    const itemsPerView = modeConfig.itemsPerView || modeConfig.columns || 5;

    let currentIndex = 0;
    const slideContainer = shadow.querySelector('.recsys-container') as HTMLElement;
    
    if (!slideContainer) return;

    const renderSlide = () => {
      slideContainer.innerHTML = '';
      for (let i = 0; i < itemsPerView; i++) {
        const index = (currentIndex + i) % items.length;
        const item = items[index];
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = this.renderItemContent(item);
        const itemElement = tempDiv.firstElementChild as HTMLElement;
        if (itemElement) {
          itemElement.addEventListener('click', () => {
            const targetId = item.DomainItemId;
            if (targetId) {
              const rank = index + 1;
              this.handleItemClick(targetId, rank);
            }
          });
          slideContainer.appendChild(itemElement);
        }
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
      if (this.autoSlideTimeout) clearTimeout(this.autoSlideTimeout);
      this.autoSlideTimeout = setTimeout(next, this.DEFAULT_DELAY);
    };

    shadow.querySelector('.recsys-prev')?.addEventListener('click', prev);
    shadow.querySelector('.recsys-next')?.addEventListener('click', next);

    renderSlide();
    resetAutoSlide();
  }

  private async handleItemClick(id: string | number, rank: number): Promise<void> {
      if (!id) return;
      
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
      } catch (error) {
        // console.error('[InlineDisplay] Failed to send evaluation:', error);
      }
      
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