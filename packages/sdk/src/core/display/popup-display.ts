import { RecommendationItem, PopupConfig } from './types';

export class PopupDisplay {
  private domainKey: string;
  private slotName: string;
  private apiBaseUrl: string;
  private config: PopupConfig;
  private popupTimeout: NodeJS.Timeout | null = null;
  private autoCloseTimeout: NodeJS.Timeout | null = null;
  private autoSlideTimeout: NodeJS.Timeout | null = null;
  private shadowHost: HTMLElement | null = null;

  private readonly DEFAULT_MIN_DELAY = 10000; // 10s
  private readonly DEFAULT_MAX_DELAY = 20000; // 20s
  private readonly AUTO_SLIDE_DELAY = 5000; // 5s auto slide

  constructor(
    domainKey: string,
    slotName: string,
    apiBaseUrl: string,
    config: PopupConfig = {}
  ) {
    this.domainKey = domainKey;
    this.slotName = slotName;
    this.apiBaseUrl = apiBaseUrl;
    this.config = {
      minDelay: config.minDelay || this.DEFAULT_MIN_DELAY,
      maxDelay: config.maxDelay || this.DEFAULT_MAX_DELAY,
      autoCloseDelay: config.autoCloseDelay,
      pages: config.pages || ['*'], // Default show on all pages
    };
  }

  // Bắt đầu schedule popup
  start(): void {
    this.scheduleNextPopup();
  }

  // Dừng popup
  stop(): void {
    this.clearTimeouts();
    this.removePopup();
  }

  // Lập lịch hiển thị popup tiếp theo
  private scheduleNextPopup(): void {
    this.clearTimeouts();

    const delay = this.getRandomDelay();
    console.log(`[PopupDisplay] Next popup in ${delay / 1000}s`);

    this.popupTimeout = setTimeout(() => {
      if (this.isPageAllowed(window.location.pathname)) {
        this.showPopup();
      } else {
        console.log('[PopupDisplay] Skipped (Page not allowed)');
        this.scheduleNextPopup();
      }
    }, delay);
  }

  // Tính toán delay ngẫu nhiên
  private getRandomDelay(): number {
    const min = this.config.minDelay!;
    const max = this.config.maxDelay!;
    return Math.floor(Math.random() * (max - min) + min);
  }

  // Kiểm tra page có được phép hiển thị không
  private isPageAllowed(currentPath: string): boolean {
    const allowedPatterns = this.config.pages || [];
    
    if (allowedPatterns.length === 0 || allowedPatterns.includes('*')) {
      return true;
    }

    return allowedPatterns.some(pattern => {
      if (pattern === '/') return currentPath === '/';
      
      // Hỗ trợ wildcard (vd: /products/*)
      if (pattern.endsWith('/*')) {
        const base = pattern.slice(0, -2);
        return currentPath.startsWith(base);
      }
      
      return currentPath === pattern;
    });
  }

  // Hiển thị popup
  private async showPopup(): Promise<void> {
    try {
      const items = await this.fetchRecommendations();
      
      if (items && items.length > 0) {
        this.renderPopup(items);
        
        // Auto close nếu có config
        if (this.config.autoCloseDelay) {
          this.autoCloseTimeout = setTimeout(() => {
            this.removePopup();
            this.scheduleNextPopup();
          }, this.config.autoCloseDelay);
        }
      } else {
        // Không có items, schedule lại
        this.scheduleNextPopup();
      }
    } catch (error) {
      console.error('[PopupDisplay] Error showing popup:', error);
      this.scheduleNextPopup();
    }
  }

  // Fetch recommendations từ API
  private async fetchRecommendations(): Promise<RecommendationItem[]> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/recommendations?domainKey=${this.domainKey}&slot=${this.slotName}`
      );

      if (!response.ok) {
        throw new Error('API Error');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[PopupDisplay] Error fetching recommendations:', error);
      
      // Fallback mock data for development
      return [
        { 
          id: 1, 
          name: 'Sản phẩm 1', 
          img: 'https://via.placeholder.com/180x130',
          price: '199.000đ' 
        },
        { 
          id: 2, 
          name: 'Sản phẩm 2',
          img: 'https://via.placeholder.com/180x130',
          price: '299.000đ' 
        },
        { 
          id: 3, 
          name: 'Sản phẩm 3',
          img: 'https://via.placeholder.com/180x130',
          price: '399.000đ' 
        }
      ];
    }
  }

  // Render popup với Shadow DOM
  private renderPopup(items: RecommendationItem[]): void {
    // Remove existing popup if any
    this.removePopup();

    // Create shadow host
    const host = document.createElement('div');
    host.id = 'recsys-popup-host';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    // Add styles
    const style = document.createElement('style');
    style.textContent = this.getPopupStyles();
    shadow.appendChild(style);

    // Create popup structure
    const popup = document.createElement('div');
    popup.className = 'recsys-popup';
    popup.innerHTML = `
      <div class="recsys-header">
        Gợi ý dành cho 
        <button class="recsys-close">✕</button>
      </div>
      <div class="recsys-body">
        <button class="recsys-nav recsys-prev">◀</button>
        <div class="recsys-slide"></div>
        <button class="recsys-nav recsys-next">▶</button>
      </div>
    `;
    shadow.appendChild(popup);

    this.shadowHost = host;

    // Setup carousel
    this.setupCarousel(shadow, items);

    // Setup close button
    const closeBtn = shadow.querySelector('.recsys-close') as HTMLElement;
    closeBtn?.addEventListener('click', () => {
      if (this.autoSlideTimeout) {
        clearTimeout(this.autoSlideTimeout);
        this.autoSlideTimeout = null;
      }
      this.removePopup();
      this.scheduleNextPopup();
    });
  }

  // Setup carousel functionality
  private setupCarousel(shadow: ShadowRoot, items: RecommendationItem[]): void {
    let currentIndex = 0;
    const slideContainer = shadow.querySelector('.recsys-slide') as HTMLElement;
    const prevBtn = shadow.querySelector('.recsys-prev') as HTMLElement;
    const nextBtn = shadow.querySelector('.recsys-next') as HTMLElement;

    const renderSlide = () => {
      const item = items[currentIndex];
      const name = item.name || item.title || 'Sản phẩm';
      const img = item.img || item.image || '';

      slideContainer.innerHTML = `
        <div class="recsys-item" data-id="${item.id}">
          <img src="${img}" alt="${name}" />
          <div class="recsys-name">${name}</div>
          <div class="recsys-price">${item.price}</div>
        </div>
      `;
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
      if (this.autoSlideTimeout) {
        clearTimeout(this.autoSlideTimeout);
      }
      this.autoSlideTimeout = setTimeout(next, this.AUTO_SLIDE_DELAY);
    };

    prevBtn?.addEventListener('click', prev);
    nextBtn?.addEventListener('click', next);

    // Click handler for items
    slideContainer?.addEventListener('click', (e) => {
      const itemEl = (e.target as HTMLElement).closest('.recsys-item') as HTMLElement;
      if (itemEl) {
        const itemId = itemEl.getAttribute('data-id');
        console.log('[PopupDisplay] Item clicked:', itemId);
        // TODO: Track click event
      }
    });

    // Start carousel
    renderSlide();
    resetAutoSlide();
  }

  // Remove popup
  private removePopup(): void {
    if (this.shadowHost) {
      this.shadowHost.remove();
      this.shadowHost = null;
    }
  }

  // Clear all timeouts
  private clearTimeouts(): void {
    if (this.popupTimeout) {
      clearTimeout(this.popupTimeout);
      this.popupTimeout = null;
    }
    if (this.autoCloseTimeout) {
      clearTimeout(this.autoCloseTimeout);
      this.autoCloseTimeout = null;
    }
    if (this.autoSlideTimeout) {
      clearTimeout(this.autoSlideTimeout);
      this.autoSlideTimeout = null;
    }
  }

  // Get popup styles
  private getPopupStyles(): string {
    return `
      :host { all: initial; font-family: Arial, sans-serif; }
      * { box-sizing: border-box; }

      .recsys-popup {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 340px;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 4px 28px rgba(0,0,0,0.25);
        z-index: 2147483647;
        overflow: hidden;
        animation: fadeIn 0.3s ease;
        display: flex;
        flex-direction: column;
        border: 1px solid #e0e0e0;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .recsys-header {
        background: #111;
        color: #fff;
        padding: 12px 14px;
        font-size: 15px;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .recsys-close {
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        opacity: 0.8;
        background: none;
        border: none;
        color: white;
        padding: 0;
      }

      .recsys-close:hover {
        opacity: 1;
      }

      .recsys-body {
        position: relative;
        height: 220px;
        background: #fff;
      }

      .recsys-nav {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        font-size: 20px;
        background: rgba(255,255,255,0.8);
        border: 1px solid #ddd;
        cursor: pointer;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
        transition: all 0.2s;
        color: #333;
        padding: 0;
      }

      .recsys-nav:hover {
        background: #fff;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      }

      .recsys-prev {
        left: 10px;
      }

      .recsys-next {
        right: 10px;
      }

      .recsys-slide {
        text-align: center;
        padding: 15px;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .recsys-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }

      .recsys-item img {
        width: 180px;
        height: 130px;
        border-radius: 8px;
        object-fit: cover;
      }

      .recsys-name {
        font-size: 16px;
        font-weight: 600;
        margin: 5px 0 0;
        color: #333;
      }

      .recsys-price {
        font-size: 14px;
        color: #d10000;
        font-weight: bold;
      }
    `;
  }
}
