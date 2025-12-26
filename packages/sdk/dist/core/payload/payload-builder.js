// packages/sdk/src/core/services/payload-builder.ts
export class PayloadBuilder {
    constructor() {
        this.COMMON_CONTAINERS = [
            'user', 'userInfo', 'userData', 'profile', 'auth', 'session', 'account', 'identity',
            'customer', 'member', 'state'
        ];
    }
    /**
     * Hàm build đa năng: Hỗ trợ cả 2 kiểu gọi (Legacy & Mapping)
     * Để đơn giản hóa trong context này, ta tập trung vào logic Mapping.
     * Trong thực tế cần implement cả logic Legacy nếu các plugin cũ vẫn dùng.
     */
    build(arg1, arg2, arg3) {
        // KIỂM TRA: Nếu tham số đầu tiên là Mảng -> Chạy logic Mapping (New)
        if (Array.isArray(arg1)) {
            return this.buildFromMappings(arg1, arg2);
        }
        // NGƯỢC LẠI: Chạy logic Legacy (FormPlugin, ScrollPlugin...)
        return this.buildLegacy(arg1, arg2, arg3);
    }
    buildFromMappings(mappings, contextElement) {
        const result = {};
        if (!mappings || !Array.isArray(mappings))
            return result;
        for (const map of mappings) {
            let extractedValue = null;
            // Chuẩn hóa key source về chữ thường để so sánh
            const source = (map.source || '').toLowerCase();
            switch (source) {
                case 'cookie':
                    extractedValue = this.extractFromCookie(map.value);
                    break;
                case 'local_storage':
                    extractedValue = this.extractFromStorage(window.localStorage, map.value);
                    break;
                case 'session_storage':
                    extractedValue = this.extractFromStorage(window.sessionStorage, map.value);
                    break;
                case 'url_param':
                    extractedValue = this.extractFromUrl(map.value);
                    break;
                case 'element':
                    if (contextElement) {
                        extractedValue = this.extractFromElement(contextElement, map.value);
                    }
                    break;
            }
            if (this.isValidValue(extractedValue)) {
                result[map.field] = extractedValue;
            }
        }
        return result;
    }
    // --- [LEGACY LOGIC] Xử lý Rule & AI Detection (Cho Form/Scroll Plugin) ---
    buildLegacy(element, rule, _extraData) {
        // Tạo payload cơ bản
        const payload = {
            event: 'unknown', // Sẽ được plugin ghi đè (vd: rate_submit)
            url: window.location.href,
            timestamp: Date.now(),
            ruleName: (rule === null || rule === void 0 ? void 0 : rule.name) || 'unknown_rule',
            userId: '', // Sẽ được enrich bởi IdentityManager sau
            itemId: 'N/A (Failed)',
            metadata: {}
        };
        // Gán thông tin từ AI Detection (nếu có)
        if (element && typeof element === 'object' && 'id' in element) {
            const aiResult = element;
            if (aiResult.id && aiResult.id !== 'N/A (Failed)') {
                payload.itemId = aiResult.id;
                payload.itemName = aiResult.name;
                payload.itemType = aiResult.type;
                payload.confidence = aiResult.confidence;
                payload.source = aiResult.source;
                if (aiResult.metadata)
                    payload.metadata = { ...payload.metadata, ...aiResult.metadata };
            }
        }
        return payload;
    }
    // --- CÁC HÀM TRÍCH XUẤT ---
    /**
     * [NEW] Lấy dữ liệu từ DOM Element (CSS Selector)
     * Selector được tìm trong phạm vi contextElement (Form) trước, nếu không thấy thì tìm toàn document
     */
    extractFromElement(context, selector) {
        try {
            if (!selector)
                return null;
            // Tìm element: Ưu tiên trong form, fallback ra toàn trang
            let targetEl = context.querySelector(selector);
            if (!targetEl) {
                targetEl = document.querySelector(selector);
            }
            if (!targetEl)
                return null;
            // 1. Nếu là Input/Textarea/Select -> Lấy value
            if (targetEl instanceof HTMLInputElement ||
                targetEl instanceof HTMLTextAreaElement ||
                targetEl instanceof HTMLSelectElement) {
                return targetEl.value;
            }
            // 2. Nếu là thẻ thường -> Lấy text content
            return targetEl.innerText || targetEl.textContent || null;
        }
        catch {
            return null;
        }
    }
    extractFromUrl(paramName) {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get(paramName);
        }
        catch {
            return null;
        }
    }
    extractFromStorage(storage, keyConfig) {
        try {
            if (!keyConfig)
                return null;
            const cleanKey = keyConfig.trim().replace(/^\.+|\.+$/g, ''); // Sanitization
            if (!cleanKey)
                return null;
            // 1. Direct Lookup
            const directVal = this.lookupPath(storage, cleanKey);
            if (this.isValidValue(directVal))
                return directVal;
            // 2. Smart Container Lookup (Fallback)
            if (!cleanKey.includes('.')) {
                for (const container of this.COMMON_CONTAINERS) {
                    const fallbackPath = `${container}.${cleanKey}`;
                    const fallbackVal = this.lookupPath(storage, fallbackPath);
                    if (this.isValidValue(fallbackVal))
                        return fallbackVal;
                }
            }
            return null;
        }
        catch {
            return null;
        }
    }
    lookupPath(storage, path) {
        const parts = path.split('.');
        const rootKey = parts[0];
        const rawItem = storage.getItem(rootKey);
        if (!rawItem)
            return null;
        if (parts.length === 1)
            return rawItem;
        return this.getNestedValue(rawItem, parts.slice(1).join('.'));
    }
    extractFromCookie(path) {
        try {
            if (!document.cookie || !path)
                return null;
            const cleanPath = path.trim().replace(/^\.+|\.+$/g, '');
            if (!cleanPath)
                return null;
            const parts = cleanPath.split('.');
            const cookieName = parts[0];
            const match = document.cookie.match(new RegExp('(^| )' + cookieName + '=([^;]+)'));
            if (!match)
                return null;
            const cookieValue = decodeURIComponent(match[2]);
            if (parts.length === 1)
                return cookieValue;
            return this.getNestedValue(cookieValue, parts.slice(1).join('.'));
        }
        catch {
            return null;
        }
    }
    getNestedValue(jsonString, path) {
        try {
            let obj = JSON.parse(jsonString);
            const keys = path.split('.');
            for (const key of keys) {
                if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
                    obj = obj[key];
                }
                else {
                    return null;
                }
            }
            return (typeof obj === 'object') ? JSON.stringify(obj) : String(obj);
        }
        catch {
            return null;
        }
    }
    isValidValue(val) {
        return val !== null && val !== undefined && val !== '' && val !== 'null' && val !== 'undefined';
    }
}
//# sourceMappingURL=payload-builder.js.map