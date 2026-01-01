import { InlineConfig } from './types';
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
    config: InlineConfig = {},
    recommendationGetter: () => Promise<RecommendationItem[]>
  ) {
    this.selector = selector;
    this.recommendationGetter = recommendationGetter;
    this.config = {
      pages: config.pages || ['*'], // Default show on all pages
    };
  }

  // Bắt đầu inline display
  start(): void {
    console.log(`[InlineDisplay] Starting watcher for: "${this.selector}"`);

    // Kiểm tra page có được phép không
    if (!this.isPageAllowed(window.location.pathname)) {
      console.log('[InlineDisplay] Page not allowed');
      return;
    }

    // Quét lần đầu
    this.scanAndRender();

    // Setup MutationObserver để theo dõi DOM changes
    this.setupObserver();
  }

  // Dừng inline display
  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  // Quét và render tất cả containers
  private scanAndRender(): void {
    const containers = document.querySelectorAll(this.selector);
    containers.forEach(container => {
      this.processContainer(container as HTMLElement);
    });
  }

  // Setup MutationObserver để theo dõi DOM changes
  private setupObserver(): void {
    this.observer = new MutationObserver(() => {
      // Debounce để tránh xử lý quá nhiều
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(() => {
        this.scanAndRender();
      }, 100);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // Xử lý từng container
  private async processContainer(container: HTMLElement): Promise<void> {
    // Kiểm tra đã render chưa
    if (!container || container.getAttribute('data-recsys-loaded') === 'true') {
      return;
    }

    // Đánh dấu đã xử lý
    container.setAttribute('data-recsys-loaded', 'true');

    try {
      // Fetch recommendations
      const items = await this.fetchRecommendations();

      if (items && items.length > 0) {
        this.renderWidget(container, items);
      } else {
        console.log(`[InlineDisplay] No items for ${this.selector}`);
      }
    } catch (error) {
      console.error('[InlineDisplay] Error processing container:', error);
    }
  }

  // Kiểm tra page có được phép hiển thị không
  private isPageAllowed(currentPath: string): boolean {
    const allowedPatterns = this.config.pages || [];

    if (allowedPatterns.length === 0 || allowedPatterns.includes('*')) {
      return true;
    }

    return allowedPatterns.some(pattern => {
      if (pattern === '/') return currentPath === '/';

      // Hỗ trợ wildcard
      if (pattern.endsWith('/*')) {
        const base = pattern.slice(0, -2);
        return currentPath.startsWith(base);
      }

      return currentPath === pattern;
    });
  }

  // Fetch recommendations từ DisplayManager (đã cached)
  private async fetchRecommendations(): Promise<RecommendationItem[]> {
    try {
      const items = await this.recommendationGetter();
      return items;
    } catch (error) {
      console.error('[InlineDisplay] Error getting recommendations:', error);
      return [];
    }
  }

  // Render widget với Shadow DOM
  private renderWidget(container: HTMLElement, items: RecommendationItem[]): void {
    try {
      // Setup Shadow DOM
      let shadow = container.shadowRoot;
      if (!shadow) {
        shadow = container.attachShadow({ mode: 'open' });
      }

      // Clear existing content
      shadow.innerHTML = '';

      // Add styles
      const style = document.createElement('style');
      style.textContent = this.getWidgetStyles();
      shadow.appendChild(style);

      // Create wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'recsys-wrapper';

      // Create items
      items.forEach(item => {
        const title = item.title || 'Sản phẩm';
        const description = item.description || '';
        const img = item.img;

        const itemEl = document.createElement('div');
        itemEl.className = 'recsys-item';
        itemEl.setAttribute('data-id', String(item.id));
        itemEl.setAttribute('data-domain-item-id', item.domainItemId);

        itemEl.innerHTML = `
          <div class="recsys-img-box">
            <img src="${img}" alt="${title}">
          </div>
          <div class="recsys-info">
            <div class="recsys-title">${title}</div>
            <div class="recsys-description">${description}</div>
          </div>
        `;

        wrapper.appendChild(itemEl);
      });

      shadow.appendChild(wrapper);

      // Setup click handler
      wrapper.addEventListener('click', (e) => {
        const itemEl = (e.target as HTMLElement).closest('.recsys-item') as HTMLElement;
        if (itemEl) {
          const itemId = itemEl.getAttribute('data-id');
          console.log('[InlineDisplay] Item clicked:', itemId);
          // TODO: Track click event
        }
      });
    } catch (error) {
      console.error('[InlineDisplay] Error rendering widget:', error);
    }
  }

  // Get widget styles
  private getWidgetStyles(): string {
    return `
      :host {
        display: block;
        all: initial;
        font-family: Arial, sans-serif;
        width: 100%;
      }
      * {
        box-sizing: border-box;
      }

      .recsys-wrapper {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 16px;
        padding: 10px 0;
      }

      .recsys-item {
        border: 1px solid #eee;
        border-radius: 8px;
        overflow: hidden;
        background: #fff;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        display: flex;
        flex-direction: column;
      }

      .recsys-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      }

      .recsys-img-box {
        width: 100%;
        padding-top: 100%;
        position: relative;
        background: #f9f9f9;
      }

      .recsys-img-box img {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .recsys-info {
        padding: 10px;
        flex-grow: 1;
        display: flex;
        flex-direction: column;
      }

      .recsys-title {
        font-size: 14px;
        font-weight: 600;
        color: #333;
        margin-bottom: 4px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .recsys-description {
        font-size: 12px;
        color: #666;
        margin-top: auto;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `;
  }
}
