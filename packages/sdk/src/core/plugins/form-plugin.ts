import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
import { IRecsysContext } from './interfaces/recsys-context.interface';
import { TrackerContextAdapter } from './adapters/tracker-context-adapter';
import { getAIItemDetector, AIItemDetector } from './utils/ai-item-detector';
import { getUserIdentityManager, UserIdentityManager } from './utils/user-identity-manager';

export class FormPlugin extends BasePlugin {
    public readonly name = 'FormPlugin';

    private context: IRecsysContext | null = null;
    private detector: AIItemDetector | null = null;
    private identityManager: UserIdentityManager | null = null;
    private handleSubmitBound = this.handleSubmit.bind(this);

    public init(tracker: RecSysTracker): void {
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

    public start(): void {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized()) return;
            // Lắng nghe sự kiện submit toàn cục
            document.addEventListener('submit', this.handleSubmitBound, { capture: true });
            console.log("[FormPlugin] started listening for form submissions.");
            this.active = true;
        }, 'FormPlugin.start');
    }

    public stop(): void {
        this.errorBoundary.execute(() => {
            document.removeEventListener('submit', this.handleSubmitBound, { capture: true });
            super.stop();
        }, 'FormPlugin.stop');
    }

    // private handleSubmit(event: Event): void {
    //     if (!this.context || !this.detector) return;

    //     const form = event.target as HTMLFormElement;

    //     // 1. Lấy rules có Trigger là RATE (Giả sử ID = 2)
    //     const rateRules = this.context.config.getRules(2); 

    //     if (rateRules.length === 0) return;

    //     for (const rule of rateRules) {
    //         // 2. Check xem Form này có khớp với Rule không (dựa vào selector)
    //         const selector = rule.targetElement.targetElementValue || '';
    //         if (!selector) continue;

    //         // Logic check khớp selector đơn giản (giống checkTargetMatch cũ nhưng gọn hơn)
    //         let isMatch = false;
    //         try {
    //             if (form.matches(selector)) isMatch = true;
    //             // Fallback check ID nếu selector là #id
    //             else if (selector.startsWith('#') && form.id === selector.substring(1)) isMatch = true;
    //         } catch (e) { console.warn('Invalid selector', selector); }

    //         if (isMatch) {
    //             // 1. Detect Item Context
    //             const structuredItem = this.detector.detectItem(form);

    //             // 2. Extract Form Data
    //             const { rateValue, reviewText } = this.extractFormData(form, rule);

    //             // 3. Build Payload cơ bản
    //             const payload = this.context.payloadBuilder.build(structuredItem, rule);

    //             // 4. Override event type
    //             payload.event = 'rate_submit';

    //             // 5. Đưa dữ liệu vào METADATA (Merge với metadata cũ nếu có)
    //             payload.metadata = {
    //                 ...(payload.metadata || {}), 
    //                 rateValue: rateValue,   
    //                 reviewText: reviewText  
    //             };

    //             // 6. Gửi đi
    //             this.context.eventBuffer.enqueue(payload);
    //             return;
    //         }
    //     }
    // }

    private handleSubmit(event: Event): void {
        console.log("🔥 [DEBUG] Sự kiện Submit đã được bắt!");

        if (!this.context || !this.detector || !this.tracker) return;

        const form = event.target as HTMLFormElement;
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
            // Lấy selector từ cấu trúc lồng nhau (như trong index.ts bạn viết)
            // Dùng optional chaining (?.) để an toàn
            const selector = rule.trackingTarget?.value || (rule as any).targetElementValue;

            console.log(`   👉 Checking Rule [${rule.id}]: Cần tìm selector "${selector}"`);

            if (!selector) {
                console.log("      -> Bỏ qua: Rule không có selector");
                continue;
            }

            // Logic check khớp
            let isMatch = false;
            try {
                if (form.matches(selector)) isMatch = true;
                else if (selector.startsWith('#') && formId === selector.substring(1)) isMatch = true;
            } catch (e) {
                console.warn('      -> Lỗi cú pháp selector', e);
            }

            if (isMatch) {
                console.log("✅ [DEBUG] MATCH THÀNH CÔNG! Bắt đầu trích xuất dữ liệu...");

                // 1. Detect Item Context
                let structuredItem = this.detector.detectItem(form);

                const isGarbageId = structuredItem?.id?.startsWith('pos_') ||
                    structuredItem?.source === 'fallback_position_based' ||
                    structuredItem?.name?.startsWith('Element at');

                if (!structuredItem || !structuredItem.id || structuredItem.id === 'N/A (Failed)' || isGarbageId) {
                    console.log("🔍 [FormPlugin] AI form failed. Scanning surrounding context...");
                    const contextInfo = this.scanSurroundingContext(form);

                    if (contextInfo.id) {
                        // Merge kết quả tìm được
                        structuredItem = {
                            confidence: 1,
                            source: contextInfo.source,
                            context: 'dom_context',
                            metadata: {},
                            ...(structuredItem || {}), // Giữ lại metadata cũ nếu có
                            id: contextInfo.id,
                            name: contextInfo.name || structuredItem?.name || '',
                            type: contextInfo.type || structuredItem?.type || ''
                        };
                        console.log("[FormPlugin] Found Context Item:", contextInfo);
                    }
                }

                // 2. Extract Form Data
                const { rateValue, reviewText } = this.extractFormData(form, rule);

                console.log("📦 [DEBUG] Dữ liệu trích xuất được:", { rateValue, reviewText });

                // 3. Build Payload
                const payload = this.context.payloadBuilder.build(structuredItem, rule);

                this.enrichPayload(payload, structuredItem, { rateValue, reviewText });

                payload.event = 'rate_submit';
                payload.metadata = {
                    ...(payload.metadata || {}),
                    rateValue: rateValue,
                    reviewText: reviewText
                };

                // 4. Send
                console.log("🚀 [DEBUG] Đang gửi vào Buffer:", payload);
                this.context.eventBuffer.enqueue(payload);
                return;
            } else {
                console.log(`      ❌ KHÔNG KHỚP: Form "${formId}" != Selector "${selector}"`);
            }
        }
    }

    /**
     * DOM RADAR: Quét ngữ cảnh xung quanh theo phương pháp lan truyền
     * 1. Check bản thân -> 2. Check tổ tiên -> 3. Check phạm vi (Parent Scope)
     */
    private scanSurroundingContext(element: HTMLElement): { id?: string, name?: string, type?: string, source: string } {
        // Helper lấy data attribute
        const getAttrs = (el: Element | null) => {
            if (!el) return null;
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

    private enrichPayload(payload: any, itemCtx: any, formData: { rateValue: number, reviewText: string }) {
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
            if (itemCtx.source) payload.source = itemCtx.source;
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
    private extractFormData(form: HTMLFormElement, rule: any): { rateValue: number, reviewText: string } {
        const formData = new FormData(form);
        const data: Record<string, any> = {};

        // Convert FormData to Object & Log raw data
        formData.forEach((value, key) => { data[key] = value });
        console.log("RAW FORM DATA:", data);

        let rateValue = 0;
        let reviewText = '';

        // Ưu tiên config từ Rule
        if (rule.payload && rule.payload.length > 0) {
            rule.payload.forEach((p: any) => {
                const val = data[p.value];
                if (p.type === 'number') rateValue = Number(val) || 0;
                else reviewText = String(val || '');
            });
        } else {
            // Auto-detect Logic
            for (const [key, val] of Object.entries(data)) {
                const k = key.toLowerCase();
                const vStr = String(val);

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

        return { rateValue, reviewText };
    }
}
