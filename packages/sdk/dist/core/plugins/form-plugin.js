import { BasePlugin } from './base-plugin';
import { TrackerContextAdapter } from './adapters/tracker-context-adapter';
import { getAIItemDetector } from './utils/ai-item-detector';
import { getUserIdentityManager } from './utils/user-identity-manager';
const TARGET_PATTERN = {
    CSS_SELECTOR: 1,
    DOM_ATTRIBUTE: 2,
    DATA_ATTRIBUTE: 3,
};
const CONDITION_PATTERN = {
    URL_PARAM: 1,
    CSS_SELECTOR: 2,
    DOM_ATTRIBUTE: 3,
    DATA_ATTRIBUTE: 4,
};
const TARGET_OPERATOR = {
    CONTAINS: 1,
    NOT_CONTAINS: 2,
    STARTS_WITH: 3,
    ENDS_WITH: 4,
    EQUALS: 5,
    NOT_EQUALS: 6,
    EXISTS: 7,
    NOT_EXISTS: 8
};
export class FormPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'FormPlugin';
        this.context = null;
        this.detector = null;
        this.identityManager = null;
        this.handleSubmitBound = this.handleSubmit.bind(this);
    }
    init(tracker) {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            this.context = new TrackerContextAdapter(tracker);
            this.detector = getAIItemDetector();
            this.identityManager = getUserIdentityManager();
            this.identityManager.initialize();
            if (this.context) {
                this.identityManager.setTrackerContext(this.context);
            }
            console.log(`[FormPlugin] initialized with UserIdentityManager.`);
            console.log(`[FormPlugin] initialized.`);
        }, 'FormPlugin.init');
    }
    start() {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized())
                return;
            // Lắng nghe sự kiện submit toàn cục
            document.addEventListener('submit', this.handleSubmitBound, { capture: true });
            console.log("[FormPlugin] started listening for form submissions.");
            this.active = true;
        }, 'FormPlugin.start');
    }
    stop() {
        this.errorBoundary.execute(() => {
            document.removeEventListener('submit', this.handleSubmitBound, { capture: true });
            super.stop();
        }, 'FormPlugin.stop');
    }
    handleSubmit(event) {
        console.log("🔥 [DEBUG] Sự kiện Submit đã được bắt!");
        if (!this.context || !this.detector || !this.tracker)
            return;
        const form = event.target;
        const formId = form.id;
        console.log(`📝 [DEBUG] Form đang submit có ID: "${formId}"`);
        // 1. Lấy rules RATE (Dynamic ID)
        const eventId = this.tracker.getEventTypeId('Rating');
        if (!eventId) {
            console.log('[FormPlugin] Rating event type not found in config.');
            return;
        }
        const rateRules = this.context.config.getRules(eventId);
        console.log(`🔎 [DEBUG] Tìm thấy ${rateRules.length} rule(s) cho sự kiện RATE.`);
        if (rateRules.length === 0) {
            return;
        }
        for (const rule of rateRules) {
            const isTargetMatch = this.checkTargetMatch(form, rule);
            if (isTargetMatch) {
                // B. Kiểm tra Conditions (Dùng CONDITION_PATTERN)
                const isConditionMatch = this.checkConditions(form, rule);
                if (isConditionMatch) {
                    console.log(`✅ [DEBUG] Rule "${rule.name}" Matched (Target & Conditions)!`);
                    // C. Extract & Process Data
                    const { rateValue, reviewText, detectedId } = this.extractFormData(form, rule);
                    let structuredItem = this.detector.detectItem(form);
                    // Logic Tam Trụ (Hidden Input -> AI -> Radar)
                    if (detectedId) {
                        structuredItem = {
                            ...(structuredItem || {}),
                            id: detectedId,
                            confidence: 1,
                            source: 'form_hidden_input',
                            context: 'form_internal',
                            name: (structuredItem === null || structuredItem === void 0 ? void 0 : structuredItem.name) || 'Unknown Item',
                            type: (structuredItem === null || structuredItem === void 0 ? void 0 : structuredItem.type) || 'item'
                        };
                    }
                    else {
                        const isGarbageId = !structuredItem || !structuredItem.id || structuredItem.id === 'N/A (Failed)';
                        if (isGarbageId) {
                            const contextInfo = this.scanSurroundingContext(form);
                            if (contextInfo.id) {
                                structuredItem = {
                                    ...(structuredItem || {}),
                                    id: contextInfo.id,
                                    confidence: 1,
                                    source: contextInfo.source,
                                    context: 'dom_context',
                                    name: contextInfo.name || (structuredItem === null || structuredItem === void 0 ? void 0 : structuredItem.name) || 'Unknown Item',
                                    type: contextInfo.type || (structuredItem === null || structuredItem === void 0 ? void 0 : structuredItem.type) || 'item',
                                    metadata: (structuredItem === null || structuredItem === void 0 ? void 0 : structuredItem.metadata) || {}
                                };
                            }
                        }
                    }
                    // D. Build & Send Payload
                    const payload = this.context.payloadBuilder.build(structuredItem, rule);
                    this.enrichPayload(payload, structuredItem, { rateValue, reviewText });
                    this.context.eventBuffer.enqueue(payload);
                    return;
                }
                else {
                    console.log(`⚠️ Match Target nhưng FAIL Conditions của Rule: ${rule.name}`);
                }
            }
        }
    }
    /**
     * Hàm kiểm tra xem Form hiện tại có khớp với Rule không
     * Hỗ trợ mọi Operator (Equals, Contains, Regex...) và Pattern (CSS, ID...)
     */
    checkTargetMatch(form, rule) {
        const target = rule.targetElement || rule.TargetElement;
        if (!target)
            return false;
        const patternId = target.targetEventPatternId || target.EventPatternID || 1;
        const operatorId = target.targetOperatorId || target.OperatorID || 5;
        const expectedValue = target.targetElementValue || target.Value || '';
        let actualValue = null;
        switch (patternId) {
            case TARGET_PATTERN.CSS_SELECTOR: // 1
                try {
                    const isMatch = form.matches(expectedValue);
                    if (operatorId === TARGET_OPERATOR.NOT_EQUALS || operatorId === TARGET_OPERATOR.NOT_EXISTS)
                        return !isMatch;
                    return isMatch;
                }
                catch {
                    return false;
                }
            case TARGET_PATTERN.DOM_ATTRIBUTE: // 2
                actualValue = form.id;
                break;
            case TARGET_PATTERN.DATA_ATTRIBUTE: // 3
                actualValue = form.getAttribute('data-form-name') || form.getAttribute('name') || '';
                break;
            // Đã xóa case REGEX_FIELDS
            default:
                try {
                    return form.matches(expectedValue);
                }
                catch {
                    return false;
                }
        }
        return this.compareValues(actualValue, expectedValue, operatorId);
    }
    /**
     * CHECK CONDITIONS: Dùng CONDITION_PATTERN
     */
    checkConditions(form, rule) {
        const conditions = rule.Conditions || rule.conditions;
        if (!conditions || conditions.length === 0)
            return true;
        for (const condition of conditions) {
            const patternId = condition.EventPatternID || condition.eventPatternId || 1;
            const operatorId = condition.OperatorID || condition.operatorId || 5;
            const expectedValue = condition.Value || condition.value || '';
            let actualValue = null;
            let isMet = false;
            switch (patternId) {
                case CONDITION_PATTERN.URL_PARAM: // 1
                    const urlParams = new URLSearchParams(window.location.search);
                    if (urlParams.has(expectedValue)) {
                        actualValue = urlParams.get(expectedValue);
                    }
                    else {
                        actualValue = window.location.href;
                    }
                    break;
                case CONDITION_PATTERN.CSS_SELECTOR: // 2
                    try {
                        isMet = form.matches(expectedValue);
                        if (this.isNegativeOperator(operatorId)) {
                            if (!isMet)
                                continue;
                            return false;
                        }
                        if (!isMet)
                            return false;
                        continue;
                    }
                    catch {
                        return false;
                    }
                case CONDITION_PATTERN.DOM_ATTRIBUTE: // 3
                    actualValue = form.id;
                    break;
                case CONDITION_PATTERN.DATA_ATTRIBUTE: // 4
                    actualValue = form.getAttribute(expectedValue);
                    break;
                default:
                    actualValue = '';
            }
            isMet = this.compareValues(actualValue, expectedValue, operatorId);
            if (!isMet) {
                console.log(`❌ Condition Failed: Pattern ${patternId}, Expect "${expectedValue}" vs Actual "${actualValue}"`);
                return false;
            }
        }
        return true;
    }
    compareValues(actual, expected, operatorId) {
        if (actual === null)
            actual = '';
        switch (operatorId) {
            case TARGET_OPERATOR.EQUALS: return actual === expected;
            case TARGET_OPERATOR.NOT_EQUALS: return actual !== expected;
            case TARGET_OPERATOR.CONTAINS: return actual.includes(expected);
            case TARGET_OPERATOR.NOT_CONTAINS: return !actual.includes(expected);
            case TARGET_OPERATOR.STARTS_WITH: return actual.startsWith(expected);
            case TARGET_OPERATOR.ENDS_WITH: return actual.endsWith(expected);
            // Đã xóa case REGEX
            case TARGET_OPERATOR.EXISTS: return actual !== '' && actual !== null;
            case TARGET_OPERATOR.NOT_EXISTS: return actual === '' || actual === null;
            default: return actual === expected;
        }
    }
    isNegativeOperator(opId) {
        return opId === TARGET_OPERATOR.NOT_EQUALS ||
            opId === TARGET_OPERATOR.NOT_CONTAINS ||
            opId === TARGET_OPERATOR.NOT_EXISTS;
    }
    /**
     * DOM RADAR: Quét ngữ cảnh xung quanh theo phương pháp lan truyền
     * 1. Check bản thân -> 2. Check tổ tiên -> 3. Check phạm vi (Parent Scope)
     */
    scanSurroundingContext(element) {
        // Helper lấy data attribute
        const getAttrs = (el) => {
            if (!el)
                return null;
            const id = el.getAttribute('data-item-id') || el.getAttribute('data-product-id') || el.getAttribute('data-id');
            if (id) {
                return {
                    id,
                    name: el.getAttribute('data-item-name') || el.getAttribute('data-name') || undefined,
                    type: el.getAttribute('data-item-type') || undefined
                };
            }
            return null;
        };
        console.log("📡 [DOM Radar] Bắt đầu quét xung quanh form...");
        // BƯỚC 1: Quét Tổ Tiên (Ancestors - Form nằm trong thẻ Item)
        // Dùng closest để tìm ngược lên trên
        const ancestor = element.closest('[data-item-id], [data-product-id], [data-id]');
        const ancestorData = getAttrs(ancestor);
        if (ancestorData) {
            console.log("   => Tìm thấy ở Tổ tiên (Ancestor)");
            return { ...ancestorData, source: 'ancestor' };
        }
        // BƯỚC 2: Quét Phạm Vi Gần (Scope Scan - Form nằm cạnh thẻ Item)
        // Đi ngược lên Parent từng cấp (Max 5 cấp) để tìm "hàng xóm" có data
        let currentParent = element.parentElement;
        let levels = 0;
        const maxLevels = 5; // Chỉ quét tối đa 5 cấp cha để tránh performance kém
        while (currentParent && levels < maxLevels) {
            // Tìm tất cả các thẻ có ID trong phạm vi cha này
            const candidates = currentParent.querySelectorAll('[data-item-id], [data-product-id], [data-id]');
            if (candidates.length > 0) {
                // Có ứng viên! Chọn ứng viên đầu tiên không phải là chính cái form (tránh loop)
                // (Thường querySelectorAll trả về theo thứ tự DOM, nên cái nào đứng trước/gần nhất sẽ được lấy)
                for (let i = 0; i < candidates.length; i++) {
                    const candidate = candidates[i];
                    if (!element.contains(candidate)) { // Đảm bảo không tìm lại con của form (nếu có)
                        const data = getAttrs(candidate);
                        if (data) {
                            console.log(`   => Tìm thấy ở Hàng xóm (Scope Level ${levels + 1})`);
                            return { ...data, source: `scope_level_${levels + 1}` };
                        }
                    }
                }
            }
            // Tiếp tục leo lên cấp cao hơn
            currentParent = currentParent.parentElement;
            levels++;
        }
        // BƯỚC 3: Fallback URL (Cứu cánh cuối cùng)
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id') || urlParams.get('productId') || urlParams.get('item_id');
        if (urlId) {
            console.log("   => Tìm thấy ở URL Param");
            return { id: urlId, source: 'url_param' };
        }
        console.warn("❌ [DOM Radar] Không tìm thấy ngữ cảnh nào xung quanh.");
        return { id: undefined, source: 'none' };
    }
    enrichPayload(payload, itemCtx, formData) {
        // Gán Event Type chuẩn
        payload.event = 'rate_submit';
        // Merge Metadata (Form Data)
        payload.metadata = {
            ...(payload.metadata || {}),
            ...formData
        };
        // Override Item Info (Quan trọng: Đảm bảo công sức của Radar được ghi nhận)
        // Chỉ ghi đè nếu Builder thất bại ("N/A") hoặc ID rỗng
        if (itemCtx.id && (!payload.itemId || payload.itemId === 'N/A (Failed)')) {
            payload.itemId = itemCtx.id;
            payload.confidence = 1; // Khẳng định độ tin cậy
            if (itemCtx.source)
                payload.source = itemCtx.source;
        }
        // Name có thể optional
        if (itemCtx.name && (!payload.itemName || payload.itemName === 'Unknown Item')) {
            payload.itemName = itemCtx.name;
        }
        if (this.identityManager) {
            // Lấy ID thật (nếu có đăng nhập), bỏ qua anon_
            const realUserId = this.identityManager.getRealUserId();
            const stableUserId = this.identityManager.getStableUserId();
            // Ưu tiên ID thật (User ID từ DB)
            if (realUserId && !realUserId.startsWith('anon_')) {
                console.log(`👤 [FormPlugin] Auto-detected Real User ID: ${realUserId}`);
                payload.userId = realUserId;
            }
            // Nếu không có ID thật, dùng ID ổn định (có thể là anon cũ) để đảm bảo continuity
            else if (stableUserId) {
                // Chỉ ghi đè nếu payload đang trống hoặc payload đang dùng anon mới tạo
                if (!payload.userId || (payload.userId.startsWith('anon_') && stableUserId !== payload.userId)) {
                    payload.userId = stableUserId;
                }
            }
            // [MẸO] Gắn thêm SessionID để tracking phiên làm việc chuẩn xác hơn
            const userInfo = this.identityManager.getUserInfo();
            if (userInfo.sessionId) {
                payload.sessionId = userInfo.sessionId; // Đảm bảo backend có trường này hoặc để vào metadata
                payload.metadata.sessionId = userInfo.sessionId;
            }
        }
    }
    // Helper: Lấy dữ liệu từ form
    extractFormData(form, rule) {
        const formData = new FormData(form);
        const data = {};
        // Convert FormData to Object & Log raw data
        formData.forEach((value, key) => { data[key] = value; });
        console.log("RAW FORM DATA:", data);
        let rateValue = 0;
        let reviewText = '';
        let detectedId = '';
        // Ưu tiên config từ Rule
        if (rule.payload && rule.payload.length > 0) {
            rule.payload.forEach((p) => {
                const val = data[p.value];
                if (p.type === 'number')
                    rateValue = Number(val) || 0;
                else
                    reviewText = String(val || '');
            });
        }
        else {
            const idKeywords = ['productid', 'itemid', 'item_id', 'product_id', 'id', 'objectid', 'entity_id'];
            // Auto-detect Logic
            for (const [key, val] of Object.entries(data)) {
                const k = key.toLowerCase();
                const vStr = String(val);
                if (idKeywords.includes(k) && vStr.length > 0 && vStr.length < 50) {
                    // Loại trừ các giá trị rác nếu cần
                    if (vStr !== '0' && vStr !== 'undefined') {
                        detectedId = vStr;
                        console.log(`💡 [FormPlugin] Tìm thấy ID trong input [${key}]: ${vStr}`);
                    }
                }
                // Detect Rating
                if (k.includes('rate') || k.includes('star') || k.includes('score') || k.includes('rating')) {
                    // Chỉ nhận nếu là số hợp lệ và > 0
                    const parsed = Number(val);
                    if (!isNaN(parsed) && parsed > 0) {
                        rateValue = parsed;
                    }
                }
                // Detect Review
                if (k.includes('comment') || k.includes('review') || k.includes('content') || k.includes('body')) {
                    // Ưu tiên chuỗi dài hơn (tránh lấy nhầm ID)
                    if (vStr.length > reviewText.length) {
                        reviewText = vStr;
                    }
                }
            }
        }
        return { rateValue, reviewText, detectedId };
    }
}
//# sourceMappingURL=form-plugin.js.map