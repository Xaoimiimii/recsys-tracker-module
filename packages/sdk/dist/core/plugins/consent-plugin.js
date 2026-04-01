"use strict";
// import { BasePlugin } from './base-plugin';
// import { RecSysTracker } from '../..';
// export class ConsentPlugin extends BasePlugin {
//   public readonly name = 'ConsentPlugin';
//   private readonly storageKey = 'recsys_consent_status';
//   private bannerId = 'recsys-privacy-banner';
//   public init(tracker: RecSysTracker): void {
//     super.init(tracker);
//   }
//   public start(): void {
//     const status = localStorage.getItem(this.storageKey);
//     if (status === 'granted') {
//       // Nếu đã đồng ý trước đó, mở khóa toàn bộ hệ thống ngay
//       this.tracker?.setConsent(true);
//     } else if (status === null) {
//       this.renderBanner();
//       this.tracker?.setConsent(false);
//     }
//   }
//   private renderBanner(): void {
//     if (document.getElementById(this.bannerId)) return;
//     const banner = document.createElement('div');
//     banner.id = this.bannerId;
//     // CSS để Banner trông chuyên nghiệp ở góc màn hình
//     Object.assign(banner.style, {
//       position: 'fixed',
//       bottom: '24px',
//       right: '24px',
//       backgroundColor: '#fff',
//       borderLeft: '4px solid #3b82f6',
//       boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
//       padding: '20px',
//       borderRadius: '12px',
//       zIndex: '2147483647',
//       maxWidth: '320px',
//       fontFamily: 'system-ui, -apple-system, sans-serif'
//     });
//     banner.innerHTML = `
//       <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1f2937;">Quyền riêng tư dữ liệu</h4>
//       <p style="margin: 0 0 16px 0; font-size: 13px; color: #4b5563; line-height: 1.5;">
//         Chúng tôi sử dụng dữ liệu hành vi để cá nhân hóa nội dung và gợi ý sản phẩm tốt hơn cho bạn.
//       </p>
//       <div style="display: flex; gap: 8px;">
//         <button id="recsys-accept" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;">Chấp nhận</button>
//         <button id="recsys-decline" style="background: #f3f4f6; color: #374151; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px;">Từ chối</button>
//       </div>
//     `;
//     document.body.appendChild(banner);
//     // Xử lý sự kiện click
//     document.getElementById('recsys-accept')?.addEventListener('click', () => {
//       localStorage.setItem(this.storageKey, 'granted');
//       this.removeBanner();
//       this.tracker?.setConsent(true);
//     });
//     document.getElementById('recsys-decline')?.addEventListener('click', () => {
//       localStorage.setItem(this.storageKey, 'denied');
//       this.removeBanner();
//       // Vẫn giữ setConsent(false)
//     });
//   }
//   private removeBanner(): void {
//     document.getElementById(this.bannerId)?.remove();
//   }
//   public stop(): void {
//     this.removeBanner();
//     super.stop();
//   }
// }
//# sourceMappingURL=consent-plugin.js.map