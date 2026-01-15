import { InlineConfig } from '../../types';
import { RecommendationItem } from '../recommendation';

export class InlineDisplay {
  private selector: string;
  private config: InlineConfig;
  private recommendationGetter: () => Promise<RecommendationItem[]>;
  private observer: MutationObserver | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(
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

  // --- DYNAMIC CSS INLINE ---
  private getWidgetStyles(): string {
    const style = this.config.styleJson || {} as any;
    const tokens = style.tokens || {};
    const contentMode = this.config.layoutJson?.contentMode || 'grid';
    const colors = tokens.colors || {};
    const typo = tokens.typography || {};
    
    // Grid settings
    const gridMode = this.config.layoutJson?.modes?.grid || {};
    const listMode: any = this.config.layoutJson?.modes?.list || {};

    const gridCSS = `
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: ${gridMode.gap || '16px'};
    `;
    const listCSS = `
        display: flex;
        flex-direction: column;
        gap: ${listMode.gap || '12px'};
    `;

    const wrapperCSS = contentMode === 'list' ? listCSS : gridCSS;
    const itemDirection = contentMode === 'list' ? 'row' : 'column';
    const imgWidth = contentMode === 'list' ? '120px' : '100%';
    const imgHeight = contentMode === 'list' ? 'auto' : '100%';
    const imgPos = contentMode === 'list' ? 'relative' : 'absolute';
    const imgBoxPadding = contentMode === 'list' ? '0' : '100%';

    return `
      :host { all: initial; font-family: ${typo.fontFamily || 'Arial, sans-serif'}; width: 100%; display: block; }
      * { box-sizing: border-box; }

      .recsys-wrapper {
        ${wrapperCSS}
        padding: 16px 0;
      }

      .recsys-item {
        background: ${colors.surface || '#fff'};
        border: 1px solid ${colors.border || '#eee'};
        border-radius: ${tokens.radius?.card || 8}px;
        overflow: hidden;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        display: flex; 
        flex-direction: ${itemDirection}; /* Dynamic direction */
        height: 100%;
        min-height: ${contentMode === 'list' ? '100px' : 'auto'};
      }

      .recsys-item:hover {
        transform: translateY(-2px);
        box-shadow: ${tokens.shadow?.cardHover || '0 4px 12px rgba(0,0,0,0.1)'};
      }

      .recsys-img-box {
        width: ${imgWidth}; 
        padding-top: ${imgBoxPadding}; 
        position: relative; 
        background: #f9f9f9;
        flex-shrink: 0; /* Không bị co lại trong list view */
      }
      
      .recsys-img-box img {
        position: ${imgPos}; top: 0; left: 0; width: 100%; height: ${imgHeight}; object-fit: cover;
      }

      .recsys-info { padding: 12px; display: flex; flex-direction: column; flex-grow: 1; gap: 4px; justify-content: center; }

      /* Styles giữ nguyên... */
      .recsys-field-product_name {
        font-size: 14px; font-weight: 600; color: ${colors.textPrimary || '#333'};
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      }
      .recsys-field-price { color: ${colors.primary || '#d32f2f'}; font-weight: bold; }
      .recsys-field-description {
        font-size: 12px; color: ${colors.textSecondary || '#666'};
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
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