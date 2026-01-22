import { InlineConfig, StyleJson, LayoutJson } from '../../types';
import { RecommendationItem } from '../recommendation';

export class InlineDisplay {
  private selector: string;
  private config: InlineConfig;
  private recommendationGetter: () => Promise<RecommendationItem[]>;
  private observer: MutationObserver | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(
    _domainKey: string,
    _slotName: string,
    selector: string,
    _apiBaseUrl: string,
    config: InlineConfig = {} as InlineConfig,
    recommendationGetter: () => Promise<RecommendationItem[]>
  ) {
    this.selector = selector;
    this.recommendationGetter = recommendationGetter;
    this.config = { ...config };
  }

  start(): void {
    // Inline thường chỉ cần check selector tồn tại, 
    // nhưng nếu có trigger config check URL thì thêm ở đây
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
      containers = document.querySelectorAll(`.${this.selector}`);
      if (containers.length === 0) {
        containers = document.querySelectorAll(`#${this.selector}`);
      }
    }
    return containers;
  }

  private setupObserver(): void {
    this.observer = new MutationObserver(() => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.scanAndRender();
      }, 100);
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  private async processContainer(container: HTMLElement): Promise<void> {
    if (!container || container.getAttribute('data-recsys-loaded') === 'true') return;
    container.setAttribute('data-recsys-loaded', 'true');

    try {
      const items = await this.fetchRecommendations();
      if (items && items.length > 0) {
        this.renderWidget(container, items);
      }
    } catch (error) {}
  }

  private async fetchRecommendations(): Promise<RecommendationItem[]> {
    try {
      return await this.recommendationGetter();
    } catch { return []; }
  }

  private getTokenColor(tokenName: string, tokens: any): string {
    return tokens?.colors?.[tokenName] || tokenName || 'transparent';
  }

  private getTokenRadius(tokenName: string, tokens: any): string {
    const val = tokens?.radius?.[tokenName];
    return val !== undefined ? `${val}px` : '0px';
  }

  // --- DYNAMIC CSS INLINE ---
  private getWidgetStyles(): string {
    const style = this.config.styleJson || {} as StyleJson;
    const layout = this.config.layoutJson || {} as LayoutJson;
    
    const tokens = style.tokens || {};
    const components = style.components || {};
    const contentMode = layout.contentMode || 'grid'; // grid | list
    const currentModeConfig = layout.modes?.[contentMode as keyof typeof layout.modes] || {};
    
    // Override cho mode hiện tại (nếu có)
    const modeOverride = style.modeOverrides?.[contentMode as keyof typeof style.modeOverrides] || {};

    // 1. Base Styles & Grid/List Setup
    let containerCSS = '';
    if (contentMode === 'grid') {
        const gridConfig = currentModeConfig as any;
        const gap = gridConfig.gap || '16px';
        const cols = gridConfig.columns || 4;
        containerCSS = `
            display: grid;
            grid-template-columns: repeat(${cols}, 1fr);
            gap: ${style.tokens?.spacingScale?.[gap] || 12}px;
        `;
        // Responsive (Example logic based on breakpoints provided in JSON)
        if (gridConfig.responsive) {
             // Logic media query simple
             containerCSS += `
                @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); }
                @media (max-width: 480px) { grid-template-columns: 1fr; }
             `;
        }
    } else { // List
        const listConfig = currentModeConfig as any;
        const gap = listConfig.rowGap || '12px';
        containerCSS = `
            display: flex;
            flex-direction: column;
            gap: ${style.tokens?.spacingScale?.[gap] || 12}px;
        `;
    }

    // 2. Card Styles
    const cardComp = { ...components.card, ...modeOverride.card };
    const cardBg = this.getTokenColor(cardComp.backgroundToken, tokens);
    const cardBorderColor = this.getTokenColor(cardComp.borderColorToken, tokens);
    const cardRadius = this.getTokenRadius(cardComp.radiusToken, tokens);
    const cardShadow = (tokens.shadow as any)?.[cardComp.shadowToken] || 'none';
    const cardPadding = style.tokens?.densityBySize?.[style.size || 'md']?.cardPadding || 12;

    // 3. Image Styles
    const imgComp = { ...components.image, ...modeOverride.image };
    const imgLayout = layout.card.image || {};
    const imgSize = (imgLayout.sizeByMode as any)?.[contentMode] || {};
    
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
    } else {
        // Grid
        imgContainerCSS = `
            width: 100%;
            height: ${imgSize.height || 140}px;
        `;
    }

    // 4. Typography & Colors
    const typo = tokens.typography || {};
    const textColor = this.getTokenColor(components.fieldRow?.value?.colorToken || 'textPrimary', tokens);
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

      ${cardComp.hover?.enabled ? `
      .recsys-item:hover {
        transform: translateY(-${cardComp.hover.liftPx || 0}px);
        box-shadow: ${(tokens.shadow as any)?.[cardComp.hover.shadowToken]|| 'none'};
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
        gap: ${tokens.spacingScale?.[components.fieldRow?.rowGapToken] || 4}px;
        justify-content: center;
        min-width: 0; /* Fix flex overflow text */
      }

      /* Field Styling */
      
      .recsys-title {
          font-size: ${typo.title?.fontSize || 16}px;
          font-weight: ${typo.title?.fontWeight || 600};
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
          border-radius: ${this.getTokenRadius((tokens.radius as any)?.badge || 'badge', tokens)};
          background: ${this.getTokenColor(components.badge?.backgroundToken || 'primary', tokens)};
          color: ${components.badge?.textColor || '#fff'};
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
          border-radius: ${this.getTokenRadius((tokens.radius as any)?.button || 'button', tokens)};
          font-size: 12px;
          cursor: pointer;
      }
    `;
  }

  // --- DYNAMIC HTML INLINE ---
  private renderItemContent(item: RecommendationItem): string {
    const fields = this.config.customizingFields?.fields || [];
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
        if (key === 'image' || key === 'img') return; // Đã render ở trên

        let value: any = '';
        if (key === 'product_name' || key === 'name') value = item.title;
        else if (key === 'description') value = item.description;
        else value = (item as any)[key];

        if (value) {
            html += `<div class="recsys-field-${key}">${value}</div>`;
        }
    });
    html += `</div>`;

    return html;
  }

  private renderWidget(container: HTMLElement, items: RecommendationItem[]): void {
    let shadow = container.shadowRoot;
    if (!shadow) shadow = container.attachShadow({ mode: 'open' });
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