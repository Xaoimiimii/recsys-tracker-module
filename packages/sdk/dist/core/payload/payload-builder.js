// packages/sdk/src/core/services/payload-builder.ts
import { PathMatcher } from "../utils/path-matcher";
export class PayloadBuilder {
    constructor() {
        this.isNetworkTrackingActive = false;
        this.trackerConfig = null;
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
            // Check if context is network data (NetworkPlugin) or HTMLElement (Click/Form Plugin)
            // arg2 could be HTMLElement OR { req, res }
            return this.buildFromMappings(arg1, arg2);
        }
        // NGƯỢC LẠI: Chạy logic Legacy (FormPlugin, ScrollPlugin...)
        return this.buildLegacy(arg1, arg2, arg3);
    }
    buildFromMappings(mappings, contextData) {
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
                    if (contextData && contextData instanceof HTMLElement) {
                        extractedValue = this.extractFromElement(contextData, map.value);
                    }
                    break;
                case 'network_request':
                    // Context data should be { reqBody, resBody }
                    extractedValue = this.extractFromNetwork(contextData, map.value);
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
    /**
     * [NEW] Extract info from Network Request/Response
     * Context: { reqBody: any, resBody: any, method: string }
     * Path format: "request.field" or "response.field" or just "field" (infer)
     */
    extractFromNetwork(context, pathConfig) {
        try {
            if (!context || !pathConfig)
                return null;
            const { reqBody, resBody, method } = context;
            // Logic similar to tracker.js 'inferSource' but guided by pathConfig if possible
            // pathConfig example: "response.userId" or "request.payload.id"
            // If pathConfig doesn't start with request/response, try both.
            let val = null;
            if (pathConfig.startsWith('request.')) {
                val = this.traverseObject(reqBody, pathConfig.replace('request.', ''));
            }
            else if (pathConfig.startsWith('response.')) {
                val = this.traverseObject(resBody, pathConfig.replace('response.', ''));
            }
            else {
                // Unknown source, try inference based on Method like tracker.js
                // GET -> Response
                // POST/PUT -> Request ?? Response
                if (method === 'GET') {
                    val = this.traverseObject(resBody, pathConfig);
                }
                else {
                    // Try request first
                    val = this.traverseObject(reqBody, pathConfig);
                    if (!this.isValidValue(val)) {
                        val = this.traverseObject(resBody, pathConfig);
                    }
                }
            }
            return val;
        }
        catch {
            return null;
        }
    }
    /**
     * [NEW] Helper to traverse generic object (for Network Plugin)
     */
    traverseObject(obj, path) {
        if (!obj)
            return null;
        try {
            const keys = path.split('.');
            let current = obj;
            for (const key of keys) {
                if (current && typeof current === 'object' && key in current) {
                    current = current[key];
                }
                else {
                    return null;
                }
            }
            if (current === null || current === undefined)
                return null;
            return (typeof current === 'object') ? JSON.stringify(current) : String(current);
        }
        catch {
            return null;
        }
    }
    setConfig(config) {
        this.trackerConfig = config;
        this.checkAndEnableNetworkTracking();
    }
    checkAndEnableNetworkTracking() {
        if (!this.trackerConfig || !this.trackerConfig.trackingRules)
            return;
        const hasNetworkRules = this.trackerConfig.trackingRules.some((rule) => rule.payloadMappings && rule.payloadMappings.some((m) => (m.source || '').toLowerCase() === 'network_request' ||
            (m.source || '').toLowerCase() === 'requestbody' // Legacy support
        ));
        if (hasNetworkRules) {
            this.enableNetworkTracking(this.trackerConfig);
        }
        else {
            this.disableNetworkTracking();
        }
    }
    // --- NETWORK TRACKING LOGIC (Moved from NetworkPlugin) ---
    enableNetworkTracking(config) {
        if (this.isNetworkTrackingActive)
            return;
        this.trackerConfig = config;
        this.hookXhr();
        this.hookFetch();
        this.isNetworkTrackingActive = true;
        console.log(`[PayloadBuilder] Network Tracking Enabled`);
    }
    disableNetworkTracking() {
        if (!this.isNetworkTrackingActive)
            return;
        this.restoreXhr();
        this.restoreFetch();
        this.isNetworkTrackingActive = false;
        console.log(`[PayloadBuilder] Network Tracking Stopped`);
    }
    hookXhr() {
        this.originalXmlOpen = XMLHttpRequest.prototype.open;
        this.originalXmlSend = XMLHttpRequest.prototype.send;
        const builder = this;
        // Ghi đè phương thức open để lấy thông tin method và url
        XMLHttpRequest.prototype.open = function (method, url) {
            this._networkTrackInfo = { method, url, startTime: Date.now() };
            return builder.originalXmlOpen.apply(this, arguments);
        };
        // Ghi đè phương thức send để lấy body gửi đi và body trả về
        XMLHttpRequest.prototype.send = function (body) {
            const info = this._networkTrackInfo;
            if (info) {
                // Lắng nghe sự kiện load để bắt response
                this.addEventListener('load', () => {
                    builder.handleNetworkRequest(info.url, info.method, body, this.response);
                });
            }
            return builder.originalXmlSend.apply(this, arguments);
        };
    }
    restoreXhr() {
        if (this.originalXmlOpen)
            XMLHttpRequest.prototype.open = this.originalXmlOpen;
        if (this.originalXmlSend)
            XMLHttpRequest.prototype.send = this.originalXmlSend;
    }
    hookFetch() {
        // Backup original fetch
        this.originalFetch = window.fetch;
        const builder = this;
        window.fetch = async function (...args) {
            var _a;
            // Parse arguments
            const [resource, config] = args;
            const url = typeof resource === 'string' ? resource : resource.url;
            const method = ((_a = config === null || config === void 0 ? void 0 : config.method) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'GET';
            const body = config === null || config === void 0 ? void 0 : config.body;
            // Call original fetch
            const response = await builder.originalFetch.apply(this, args);
            // Clone response to read data without disturbing the stream
            const clone = response.clone();
            clone.text().then((text) => {
                builder.handleNetworkRequest(url, method, body, text);
            }).catch(() => { });
            return response;
        };
    }
    restoreFetch() {
        if (this.originalFetch)
            window.fetch = this.originalFetch;
    }
    handleNetworkRequest(url, method, reqBody, resBody) {
        if (!this.trackerConfig || !this.trackerConfig.trackingRules)
            return;
        // safeParse helper
        const safeParse = (data) => {
            try {
                if (typeof data === 'string')
                    return JSON.parse(data);
                return data;
            }
            catch (e) {
                return data;
            }
        };
        const reqData = safeParse(reqBody);
        const resData = safeParse(resBody);
        const networkContext = {
            reqBody: reqData,
            resBody: resData,
            method: method
        };
        for (const rule of this.trackerConfig.trackingRules) {
            if (!rule.payloadMappings)
                continue;
            // Lọc các mapping phù hợp với URL hiện tại
            const applicableMappings = rule.payloadMappings.filter((mapping) => {
                if (!mapping.requestUrlPattern)
                    return false;
                if (mapping.requestMethod && mapping.requestMethod.toUpperCase() !== method.toUpperCase()) {
                    return false;
                }
                // Debug log
                // console.log(`[PayloadBuilder] Checking ${url} against ${mapping.requestUrlPattern}`);
                if (!PathMatcher.matchStaticSegments(url, mapping.requestUrlPattern)) {
                    return false;
                }
                if (!PathMatcher.match(url, mapping.requestUrlPattern)) {
                    return false;
                }
                return true;
            });
            if (applicableMappings.length > 0) {
                // Ép kiểu source thành 'network_request' để đảm bảo logic trích xuất hoạt động
                const mappingsForBuilder = applicableMappings.map((m) => ({
                    ...m,
                    source: 'network_request',
                    value: m.value || m.requestBodyPath
                }));
                // Call build recursively to extract data
                const extractedData = this.build(mappingsForBuilder, networkContext);
                if (Object.keys(extractedData).length > 0) {
                    // *logic gửi dữ liệu gì gì đó*
                    // In NetworkPlugin implementation, this matches exactly.
                    console.groupCollapsed(`%c[TRACKER] Network Match: (${method} ${url})`, "color: orange");
                    console.log("Rule:", rule.name);
                    console.log("Extracted:", extractedData);
                    console.groupEnd();
                }
            }
        }
    }
}
//# sourceMappingURL=payload-builder.js.map