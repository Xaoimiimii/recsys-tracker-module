import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';

// --- BỘ TỪ ĐIỂN ĐA NGÔN NGỮ CHO CONSENT ---
const translations: Record<string, Record<string, string>> = {
  'vi': {
    title: 'Chúng tôi tôn trọng quyền riêng tư của bạn',
    description: 'Website của chúng tôi sẽ tiến hành thu thập các tương tác của người dùng với trang web và các thông tin cần thiết nhằm phục vụ cho việc cá nhân hóa trải nghiệm của bạn trên website. Bằng cách nhấp vào "Chấp nhận tất cả", bạn đồng ý với việc chúng tôi sử dụng các công cụ này cho quảng cáo, phân tích và hỗ trợ.',
    decline: 'Không chấp nhận',
    accept: 'Chấp nhận tất cả'
  },
  'en': {
    title: 'We respect your privacy',
    description: 'Our website collects user interactions and necessary information to personalize your experience on the site. By clicking "Accept all", you agree to our use of these tools for advertising, analytics, and support.',
    decline: 'Decline',
    accept: 'Accept all'
  },
  'de': {
    title: 'Wir tôn trọng Ihre Privatsphäre',
    description: 'Unsere Website sammelt Benutzerinteraktionen und notwendige Informationen, um Ihr Erlebnis auf der Website zu personalisieren. Durch Klicken auf „Alle akzeptieren“ stimmen Sie der Verwendung dieser Tools für Werbung, Analysen und Support zu.',
    decline: 'Ablehnen',
    accept: 'Alle akzeptieren'
  },
  'ja': {
    title: 'お客様のプライバシーを尊重します',
    description: '当ウェブサイトでは、お客様の体験をパーソナライズするために、ユーザーのインタラクションと必要な情報を収集します。「すべて同意する」をクリックすると、広告、分析、サポートのためにこれらのツールを使用することに同意したことになります。',
    decline: '拒否する',
    accept: 'すべて同意する'
  },
  'ru': {
    title: 'Мы уважаем вашу конфиденциальность',
    description: 'Наш веб-сайт собирает данные о взаимодействии пользователей и необходимую информацию для персонализации вашего опыта на сайте. Нажимая «Принять все», вы соглашаетесь на использование этих инструментов для рекламы, аналитики и поддержки.',
    decline: 'Отклонить',
    accept: 'Принять все'
  },
  'fr': {
    title: 'Nous respectons votre vie privée',
    description: 'Notre site web collecte les interactions des utilisateurs et les informations nécessaires pour personnaliser votre expérience sur le site. En cliquant trên « Tout accepter », vous acceptez l\'utilisation de ces outils à des fins de publicité, d\'analyse et d\'assistance.',
    decline: 'Refuser',
    accept: 'Tout accepter'
  },
  'es': {
    title: 'Respetamos su privacidad',
    description: 'Nuestro sitio web recopila las interacciones de los usuarios y la información necesaria para personalizar su experiencia en el sitio. Al hacer clic en "Aceptar todo", acepta nuestro uso de estas herramientas para publicidad, análisis y soporte.',
    decline: 'Rechazar',
    accept: 'Aceptar todo'
  },
  'zh': {
    title: '我们尊重您的隐私',
    description: '我们的网站会收集用户互动和必要信息，以个性化您的网站体验。点击“全部接受”，即表示您同意我们将这些工具用于广告、分析和支持。',
    decline: '拒绝',
    accept: '全部接受'
  },
  'ko': {
    title: '귀하의 개인 정보를 존중합니다',
    description: '당사의 웹사이트는 귀하의 경험을 개인화하기 위해 사용자 상호 작용 및 필요한 정보를 수집합니다. "모두 수락"을 클릭하면 광고, 분석 및 지원을 위해 이러한 도구를 사용하는 데 동의하게 됩니다.',
    decline: '거부',
    accept: '모두 수락'
  }
};

export class ConsentPlugin extends BasePlugin {
  public readonly name = 'ConsentPlugin';
  private readonly storageKey = 'recsys_consent_status';
  private bannerId = 'recsys-privacy-banner';
  private currentLangCode: string = 'en';
  private langObserver: MutationObserver | null = null;

  public init(tracker: RecSysTracker): void {
    super.init(tracker);
    this.detectLanguage();
  }

  public start(): void {
    const status = localStorage.getItem(this.storageKey);

    if (status === 'granted') {
      this.tracker?.setConsent(true);
    } else if (status === null) {
      this.setupLanguageObserver();
      this.renderBanner();
      this.tracker?.setConsent(false);
    }
  }

  // --- LOGIC ĐA NGÔN NGỮ ---
  private detectLanguage(): void {
    const langCode = document.documentElement.lang || navigator.language;
    const shortCode = langCode ? langCode.substring(0, 2).toLowerCase() : 'vi';
    this.currentLangCode = translations[shortCode] ? shortCode : 'en';
  }

  private t(key: string): string {
    return translations[this.currentLangCode]?.[key] || translations['en'][key];
  }

  private setupLanguageObserver(): void {
    if (this.langObserver) return;

    this.langObserver = new MutationObserver(() => {
      const oldLang = this.currentLangCode;
      this.detectLanguage();
      if (oldLang !== this.currentLangCode && document.getElementById(this.bannerId)) {
        this.updateBannerText();
      }
    });

    this.langObserver.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['lang'] 
    });
  }
  private updateBannerText(): void {
    const banner = document.getElementById(this.bannerId);
    if (!banner) return;

    const title = banner.querySelector('h2');
    const desc = banner.querySelector('.recsys-desc');
    const declineBtn = document.getElementById('recsys-decline');
    const acceptBtn = document.getElementById('recsys-accept');

    if (title) title.textContent = this.t('title');
    if (desc) {
      desc.innerHTML = `${this.t('description')} ${this.t('policyLink')}`;
    }
    if (declineBtn) declineBtn.textContent = this.t('decline');
    if (acceptBtn) acceptBtn.textContent = this.t('accept');
  }

  private renderBanner(): void {
    if (document.getElementById(this.bannerId)) return;

    const banner = document.createElement('div');
    banner.id = this.bannerId;
    
    Object.assign(banner.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      backgroundColor: '#fff',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      padding: '32px',
      borderRadius: '24px',
      zIndex: '2147483647',
      maxWidth: '480px',
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      border: '1px solid #f3f4f6'
    });

    banner.innerHTML = `
      <style>
        #${this.bannerId} a { color: #06b6d4; text-decoration: none; font-weight: 600; }
        #${this.bannerId} a:hover { text-decoration: underline; }
        .recsys-btn { padding: 12px 24px; border-radius: 12px; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s; border: 2px solid transparent; }
        .recsys-btn-primary { background-color: #0f172a; color: white; }
        .recsys-btn-outline { background-color: transparent; border-color: #0f172a; color: #0f172a; }
        .recsys-btn-text { background: none; border: none; color: #0891b2; padding: 0; }
      </style>

      <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #06b6d4;">${this.t('title')}</h2>
      
      <p class="recsys-desc" style="margin: 0 0 24px 0; font-size: 15px; color: #475569; line-height: 1.6;">
        ${this.t('description')}
      </p>

      <div style="display: flex; align-items: right; justify-content: flex-end;">
        <div style="display: flex; gap: 12px;">
          <button class="recsys-btn recsys-btn-outline" id="recsys-decline">${this.t('decline')}</button>
          <button class="recsys-btn recsys-btn-primary" id="recsys-accept">${this.t('accept')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    document.getElementById('recsys-accept')?.addEventListener('click', () => {
      localStorage.setItem(this.storageKey, 'granted');
      this.removeBanner();
      this.tracker?.setConsent(true);
    });

    document.getElementById('recsys-decline')?.addEventListener('click', () => {
      localStorage.setItem(this.storageKey, 'denied');
      this.removeBanner();
    });
  }

  private removeBanner(): void {
    const el = document.getElementById(this.bannerId);
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'all 0.3s ease';
      setTimeout(() => el.remove(), 300);
    }
    if (this.langObserver) {
      this.langObserver.disconnect();
      this.langObserver = null;
    }
  }

  public stop(): void {
    this.removeBanner();
    super.stop();
  }
}