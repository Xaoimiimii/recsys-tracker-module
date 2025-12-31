"use strict";
// // packages/sdk/src/core/services/payload-builder.ts
// import { IAIItemDetectionResult, IPayloadExtraData, IRecsysPayload, TrackingRule } from "../plugins/interfaces/recsys-context.interface";
// import { TrackerCore } from "../tracker-core";
// export interface IPayloadMapping {
//     field: string;
//     source: string;
//     value: string;
// }
// export class PayloadBuilder {
//     private readonly COMMON_CONTAINERS = [
//         'user', 'userInfo', 'userData', 'profile', 'auth', 'session', 'account', 'identity',
//         'customer', 'member', 'state'
//     ];
//     /**
//      * Hàm build đa năng: Hỗ trợ cả 2 kiểu gọi (Legacy & Mapping)
//      * Để đơn giản hóa trong context này, ta tập trung vào logic Mapping.
//      * Trong thực tế cần implement cả logic Legacy nếu các plugin cũ vẫn dùng.
//      */
//     public build(arg1: any, arg2?: any, arg3?: any): any {
//         // KIỂM TRA: Nếu tham số đầu tiên là Mảng -> Chạy logic Mapping (New)
//         if (Array.isArray(arg1)) {
//             // Check if context is network data (NetworkPlugin) or HTMLElement (Click/Form Plugin)
//             // arg2 could be HTMLElement OR { req, res }
//             return this.buildFromMappings(arg1 as IPayloadMapping[], arg2);
//         }
//         // NGƯỢC LẠI: Chạy logic Legacy (FormPlugin, ScrollPlugin...)
//         return this.buildLegacy(arg1, arg2, arg3);
//     }
//     private buildFromMappings(mappings: IPayloadMapping[], contextData?: any): Record<string, any> {
//         const result: Record<string, any> = {};
//         if (!mappings || !Array.isArray(mappings)) return result;
//         for (const map of mappings) {
//             let extractedValue: any = null;
//             // Chuẩn hóa key source về chữ thường để so sánh
//             const source = (map.source || '').toLowerCase();
//             switch (source) {
//                 case 'cookie':
//                     extractedValue = this.extractFromCookie(map.value);
//                     break;
//                 case 'local_storage':
//                     extractedValue = this.extractFromStorage(window.localStorage, map.value);
//                     break;
//                 case 'session_storage':
//                     extractedValue = this.extractFromStorage(window.sessionStorage, map.value);
//                     break;
//                 case 'url_param':
//                     extractedValue = this.extractFromUrl(map.value);
//                     break;
//                 case 'element':
//                     if (contextData && contextData instanceof HTMLElement) {
//                         extractedValue = this.extractFromElement(contextData, map.value);
//                     }
//                     break;
//                 case 'network_request':
//                     // Context data should be { reqBody, resBody }
//                     extractedValue = this.extractFromNetwork(contextData, map.value);
//                     break;
//             }
//             if (this.isValidValue(extractedValue)) {
//                 result[map.field] = extractedValue;
//             }
//         }
//         return result;
//     }
//     // --- [LEGACY LOGIC] Xử lý Rule & AI Detection (Cho Form/Scroll Plugin) ---
//     private buildLegacy(
//         element: Element | IAIItemDetectionResult | null,
//         rule: TrackingRule,
//         _extraData?: IPayloadExtraData
//     ): IRecsysPayload {
//         // Tạo payload cơ bản
//         const payload: IRecsysPayload = {
//             event: 'unknown', // Sẽ được plugin ghi đè (vd: rate_submit)
//             url: window.location.href,
//             timestamp: Date.now(),
//             ruleName: rule?.name || 'unknown_rule',
//             userId: '', // Sẽ được enrich bởi IdentityManager sau
//             itemId: 'N/A (Failed)',
//             metadata: {}
//         };
//         // Gán thông tin từ AI Detection (nếu có)
//         if (element && typeof element === 'object' && 'id' in element) {
//             const aiResult = element as IAIItemDetectionResult;
//             if (aiResult.id && aiResult.id !== 'N/A (Failed)') {
//                 payload.itemId = aiResult.id;
//                 payload.itemName = aiResult.name;
//                 payload.itemType = aiResult.type;
//                 payload.confidence = aiResult.confidence;
//                 payload.source = aiResult.source;
//                 if (aiResult.metadata) payload.metadata = { ...payload.metadata, ...aiResult.metadata };
//             }
//         }
//         return payload;
//     }
//     // --- CÁC HÀM TRÍCH XUẤT ---
//     /**
//      * [NEW] Lấy dữ liệu từ DOM Element (CSS Selector)
//      * Selector được tìm trong phạm vi contextElement (Form) trước, nếu không thấy thì tìm toàn document
//      */
//     private extractFromElement(context: HTMLElement, selector: string): string | null {
//         try {
//             if (!selector) return null;
//             // Use context as scope if possible, or fallback to document
//             // TrackerCore.resolveElementValue handles [attr] syntax and text content
//             // However, we need to respect the "search in context first" logic of PayloadBuilder
//             // Check if context itself matches selector (for ClickPlugin usage where context IS the target)
//             if (context.matches && context.matches(selector)) {
//                  // Context IS the element. Now we need to extract value from it.
//                  // We can use resolveElementValue but we need to pass a scope that contains it? 
//                  // Actually resolveElementValue finds element INSIDE scope.
//                  // If selector is [attr], we just get attr from context
//                  if (selector.startsWith('[') && selector.endsWith(']')) {
//                      const attr = selector.slice(1, -1);
//                      if (context.hasAttribute(attr)) return context.getAttribute(attr);
//                  }
//                  // If selector is normal, and context matches, we return context's text/value
//                  if (context instanceof HTMLInputElement || context instanceof HTMLTextAreaElement || context instanceof HTMLSelectElement) {
//                     return context.value;
//                  }
//                  return context.innerText || context.textContent || null;
//             }
//             // Otherwise search inside context
//             const val = TrackerCore.resolveElementValue(selector, context);
//             if (val) return val;
//             // Fallback to document
//             return TrackerCore.resolveElementValue(selector, document);
//         } catch { return null; }
//     }
//     private extractFromUrl(paramName: string): string | null {
//         try {
//             const params = new URLSearchParams(window.location.search);
//             return params.get(paramName);
//         } catch { return null; }
//     }
//     private extractFromStorage(storage: Storage, keyConfig: string): string | null {
//         try {
//             if (!keyConfig) return null;
//             const cleanKey = keyConfig.trim().replace(/^\.+|\.+$/g, ''); // Sanitization
//             if (!cleanKey) return null;
//             // 1. Direct Lookup
//             const directVal = this.lookupPath(storage, cleanKey);
//             if (this.isValidValue(directVal)) return directVal;
//             // 2. Smart Container Lookup (Fallback)
//             if (!cleanKey.includes('.')) {
//                 for (const container of this.COMMON_CONTAINERS) {
//                     const fallbackPath = `${container}.${cleanKey}`;
//                     const fallbackVal = this.lookupPath(storage, fallbackPath);
//                     if (this.isValidValue(fallbackVal)) return fallbackVal;
//                 }
//             }
//             return null;
//         } catch { return null; }
//     }
//     private lookupPath(storage: Storage, path: string): string | null {
//         const parts = path.split('.');
//         const rootKey = parts[0];
//         const rawItem = storage.getItem(rootKey);
//         if (!rawItem) return null;
//         if (parts.length === 1) return rawItem;
//         return this.getNestedValue(rawItem, parts.slice(1).join('.'));
//     }
//     private extractFromCookie(path: string): string | null {
//         try {
//             if (!document.cookie || !path) return null;
//             const cleanPath = path.trim().replace(/^\.+|\.+$/g, '');
//             if (!cleanPath) return null;
//             const parts = cleanPath.split('.');
//             const cookieName = parts[0];
//             const match = document.cookie.match(new RegExp('(^| )' + cookieName + '=([^;]+)'));
//             if (!match) return null;
//             const cookieValue = decodeURIComponent(match[2]);
//             if (parts.length === 1) return cookieValue;
//             return this.getNestedValue(cookieValue, parts.slice(1).join('.'));
//         } catch { return null; }
//     }
//     private getNestedValue(jsonString: string, path: string): string | null {
//         try {
//             let obj = JSON.parse(jsonString);
//             const keys = path.split('.');
//             for (const key of keys) {
//                 if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
//                     obj = obj[key];
//                 } else {
//                     return null;
//                 }
//             }
//             return (typeof obj === 'object') ? JSON.stringify(obj) : String(obj);
//         } catch { return null; }
//     }
//     private isValidValue(val: any): boolean {
//         return val !== null && val !== undefined && val !== '' && val !== 'null' && val !== 'undefined';
//     }
//     /**
//      * [NEW] Extract info from Network Request/Response
//      * Context: { reqBody: any, resBody: any, method: string }
//      * Path format: "request.field" or "response.field" or just "field" (infer)
//      */
//     private extractFromNetwork(context: any, pathConfig: string): any {
//         try {
//             if (!context || !pathConfig) return null;
//             const { reqBody, resBody, method } = context;
//             // Logic similar to tracker.js 'inferSource' but guided by pathConfig if possible
//             // pathConfig example: "response.userId" or "request.payload.id"
//             // If pathConfig doesn't start with request/response, try both.
//             let val = null;
//             if (pathConfig.startsWith('request.')) {
//                 val = this.traverseObject(reqBody, pathConfig.replace('request.', ''));
//             } else if (pathConfig.startsWith('response.')) {
//                 val = this.traverseObject(resBody, pathConfig.replace('response.', ''));
//             } else {
//                 // Unknown source, try inference based on Method like tracker.js
//                 // GET -> Response
//                 // POST/PUT -> Request ?? Response
//                 if (method === 'GET') {
//                     val = this.traverseObject(resBody, pathConfig);
//                 } else {
//                     // Try request first
//                     val = this.traverseObject(reqBody, pathConfig);
//                     if (!this.isValidValue(val)) {
//                         val = this.traverseObject(resBody, pathConfig);
//                     }
//                 }
//             }
//             return val;
//         } catch { return null; }
//     }
//     /**
//      * [NEW] Helper to traverse generic object (for Network Plugin)
//      */
//     private traverseObject(obj: any, path: string): string | null {
//         if (!obj) return null;
//         try {
//             const keys = path.split('.');
//             let current = obj;
//             for (const key of keys) {
//                 if (current && typeof current === 'object' && key in current) {
//                     current = current[key];
//                 } else {
//                     return null;
//                 }
//             }
//             if (current === null || current === undefined) return null;
//             return (typeof current === 'object') ? JSON.stringify(current) : String(current);
//         } catch { return null; }
//     }
// }
//# sourceMappingURL=test-entry.js.map