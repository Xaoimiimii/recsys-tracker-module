import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
import { IRecsysContext } from './interfaces/recsys-context.interface';
import { TrackerContextAdapter } from './adapters/tracker-context-adapter';
import { getAIItemDetector, AIItemDetector } from './utils/ai-item-detector';
import { getUserIdentityManager, UserIdentityManager } from './utils/user-identity-manager';

// Target Element chỉ cho phép CSS Selector
const TARGET_PATTERN_ID = { CSS_SELECTOR: 1 };

// Condition Patterns
const CONDITION_PATTERN_ID = {
    URL_PARAM: 1,
    CSS_SELECTOR: 2,
    DOM_ATTRIBUTE: 3,
    DATA_ATTRIBUTE: 4
};

const OPERATOR_ID = {
    CONTAINS: 1,
    NOT_CONTAINS: 2,
    STARTS_WITH: 3,
    ENDS_WITH: 4,
    EQUALS: 5,
    EXISTS: 7, 
    NOT_EXISTS: 8
};

export class ReviewPlugin extends BasePlugin {
    public readonly name = 'ReviewPlugin';
    
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
            if (this.context) this.identityManager.setTrackerContext(this.context);
            console.log(`[ReviewPlugin] initialized.`);
        }, 'ReviewPlugin.init');
    }

    public start(): void {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized()) return;
            document.addEventListener('submit', this.handleSubmitBound, { capture: true });
            this.active = true;
        }, 'ReviewPlugin.start');
    }

    public stop(): void {
        this.errorBoundary.execute(() => {
            document.removeEventListener('submit', this.handleSubmitBound, { capture: true });
            super.stop();
        }, 'ReviewPlugin.stop');
    }

    private handleSubmit(event: Event): void {
        console.log("🔥 [ReviewPlugin] Detected SUBMIT event!");
        if (!this.context) return;
        const form = event.target as HTMLFormElement;

        console.log(`📝 [ReviewPlugin] Checking form: #${form.id} (Classes: ${form.className})`);

        // Giả sử Trigger ID cho Review là 5
        const reviewRules = this.context.config.getRules(5); 
        console.log(`🔎 [ReviewPlugin] Found ${reviewRules.length} rules for TriggerID=5`);
        if (reviewRules.length === 0) {
            console.warn("⚠️ [ReviewPlugin] No rules found! Check ConfigLoader or TriggerID.");
            return;
        }

        for (const rule of reviewRules) {
            // 1. Check Target (Bắt buộc CSS Selector)
            if (!this.checkTargetMatch(form, rule)) continue;

            // 2. Check Condition (Optional)
            if (!this.checkConditions(form, rule)) continue;

            console.log(`✅ [ReviewPlugin] Match Rule: "${rule.name}"`);

            // 3. XÂY DỰNG PAYLOAD (Core Logic)
            const payload = this.constructPayload(form, rule);

            // 4. Gửi Event
            this.context.eventBuffer.enqueue(payload);

            console.log(payload);
            return; 
        }

        console.log("❌ [ReviewPlugin] No rules matched the current form.");
    }

    /**
     * Logic xây dựng Payload theo thứ tự ưu tiên:
     * Config (PayloadBuilder) -> Fallback (AI/Radar/Identity)
     */
    private constructPayload(form: HTMLFormElement, rule: any): any {
        // A. [PRIORITY 1] Dùng PayloadBuilder để lấy dữ liệu từ Config
        // Truyền 'form' vào để builder có thể lấy dữ liệu từ element (Source='element')
        const mappedData = this.context!.payloadBuilder.build(rule.payloadMappings || [], form);

        console.log("🧩 [ReviewPlugin] Mapped Data from Config:", mappedData);

        // Khởi tạo payload cơ bản
        const payload: any = {
            event: 'review', 
            metadata: {}
        };

        // B. Mapping dữ liệu từ Config vào Payload
        if (mappedData.userId) payload.userId = mappedData.userId;
        if (mappedData.itemId) payload.itemId = mappedData.itemId;
        
        // [FIX] Xử lý review_text
        const content = mappedData.review_text || mappedData.content || mappedData.value || mappedData.review;
        if (content) {
            payload.metadata.content = content;
        }

        // C. [PRIORITY 2] Fallback Logic (Chỉ chạy khi thiếu dữ liệu)

        // --- FALLBACK ITEM ID ---
        if (!payload.itemId) {
            console.log("⚠️ [ReviewPlugin] Missing ItemId from config. Trying Auto-detect...");
            const radarScan = this.scanSurroundingContext(form);
            if (radarScan.id) {
                payload.itemId = radarScan.id;
                payload.source = radarScan.source; 
            } else if (this.detector) {
                const aiItem = this.detector.detectItem(form);
                if (aiItem && aiItem.id && aiItem.id !== 'N/A (Failed)') {
                    payload.itemId = aiItem.id;
                    payload.source = 'ai_detector';
                }
            }
        }

        // --- FALLBACK USER ID ---
        if (!payload.userId && this.identityManager) {
            console.log("⚠️ [ReviewPlugin] Missing UserId from config. Trying IdentityManager...");
            const realId = this.identityManager.getRealUserId();
            const stableId = this.identityManager.getStableUserId();
            if (realId && !realId.startsWith('anon_')) {
                payload.userId = realId;
            } else if (stableId) {
                payload.userId = stableId;
            }
        }

        // --- FALLBACK REVIEW CONTENT ---
        // Nếu user quên map field review_text, thử tự tìm
        if (!payload.metadata.content) {
             const autoContent = this.autoDetectReviewContent(form);
             if (autoContent) {
                 console.log("⚠️ [ReviewPlugin] Auto-detected review content from form fields.");
                 payload.metadata.content = autoContent;
             }
        }

        return payload;
    }

    private checkTargetMatch(form: HTMLFormElement, rule: any): boolean {
        const target = rule.targetElement;
        if (!target) return false;
        
        const patternId = Number(target.targetEventPatternId);
        if (patternId !== TARGET_PATTERN_ID.CSS_SELECTOR) return false;

        try {
            return form.matches(target.targetElementValue);
        } catch { return false; }
    }

    private checkConditions(form: HTMLFormElement, rule: any): boolean {
        const conditions = rule.conditions;
        if (!conditions || conditions.length === 0) return true;

        for (const cond of conditions) {
            const pattern = Number(cond.eventPatternId);
            const operator = Number(cond.operatorId);
            const val = cond.value;
            let actual: string | null = null;
            let isMet = false;

            switch (pattern) {
                case CONDITION_PATTERN_ID.URL_PARAM:
                    const p = new URLSearchParams(location.search);
                    actual = p.get(val); 
                    break;
                case CONDITION_PATTERN_ID.CSS_SELECTOR:
                    try {
                        isMet = form.matches(val);
                        if (operator === OPERATOR_ID.EXISTS && !isMet) return false;
                        if (operator === OPERATOR_ID.NOT_EXISTS && isMet) return false;
                        actual = isMet ? 'true' : 'false'; 
                    } catch { return false; }
                    break;
                case CONDITION_PATTERN_ID.DOM_ATTRIBUTE:
                    actual = form.id;
                    break;
                case CONDITION_PATTERN_ID.DATA_ATTRIBUTE:
                    actual = form.getAttribute(val);
                    break;
            }
            
            if (pattern === CONDITION_PATTERN_ID.CSS_SELECTOR && (operator === OPERATOR_ID.EXISTS || operator === OPERATOR_ID.NOT_EXISTS)) continue;

            if (!this.compareValues(actual, val, operator)) return false;
        }
        return true;
    }

    private autoDetectReviewContent(form: HTMLFormElement): string {
        const formData = new FormData(form);
        let content = '';
        // Cast any để tránh lỗi TS iterator nếu không có type lib mới
        for (const [key, val] of (formData as any)) { 
             const k = key.toLowerCase();
             const vStr = String(val);
             // Tìm các input có tên chứa 'review', 'comment', 'body' và lấy chuỗi dài nhất
             if (k.includes('review') || k.includes('comment') || k.includes('body') || k.includes('content')) {
                 if (vStr.length > content.length) content = vStr;
             }
        }
        return content;
    }

    private scanSurroundingContext(element: HTMLElement): any {
        // 1. ANCESTOR SCAN (Ưu tiên cao nhất: Tìm attribute chuẩn)
        const ancestor = element.closest('[data-item-id], [data-product-id]');
        if (ancestor) {
            return { 
                id: ancestor.getAttribute('data-item-id') || ancestor.getAttribute('data-product-id'),
                name: ancestor.getAttribute('data-item-name') || ancestor.getAttribute('data-name'),
                source: 'ancestor_attribute' 
            };
        }

        // 2. [MỚI] TEXT HEURISTIC SCAN (Tìm trong Label/Title của Form)
        // Tìm các thẻ chứa text tiềm năng bên trong form
        const textContainers = Array.from(element.querySelectorAll('label, legend, h3, h4, .product-title'));
        
        for (const container of textContainers) {
            const text = container.textContent || '';
            
            // Regex 1: Tìm pattern nằm trong ngoặc đơn, ví dụ: (P-JSON-999)
            // Giải thích Regex: \( trùng ngoặc mở, (P-[A-Z0-9-]+) bắt nhóm ID bắt đầu bằng P-, \) trùng ngoặc đóng
            const idMatch = text.match(/\((P-[A-Z0-9-]+)\)/i);
            if (idMatch && idMatch[1]) {
                console.log(`🧠 [ReviewPlugin] Found ID inside text "${text}"`);
                return { 
                    id: idMatch[1], 
                    source: 'text_heuristic_brackets' 
                };
            }

            // Regex 2: Tìm pattern sau dấu hai chấm, ví dụ: "Mã SP: SP123"
            const codeMatch = text.match(/(?:code|sku|id|mã)[:\s]+([A-Z0-9-]+)/i);
            if (codeMatch && codeMatch[1]) {
                return {
                    id: codeMatch[1],
                    source: 'text_heuristic_label'
                };
            }
        }
        
        // 3. URL SCAN (Cuối cùng mới tìm trên URL)
        const params = new URLSearchParams(window.location.search);
        const urlId = params.get('id') || params.get('productId') || params.get('product_id');
        if (urlId) return { id: urlId, source: 'url_param' };

        return {};
    }

    private compareValues(actual: any, expected: any, op: number): boolean {
        if (!actual) actual = '';
        if (op === OPERATOR_ID.EQUALS) return actual == expected;
        if (op === OPERATOR_ID.CONTAINS) return actual.includes(expected);
        if (op === OPERATOR_ID.NOT_CONTAINS) return !actual.includes(expected);
        if (op === OPERATOR_ID.STARTS_WITH) return actual.startsWith(expected);
        if (op === OPERATOR_ID.ENDS_WITH) return actual.endsWith(expected);
        if (op === OPERATOR_ID.EXISTS) return actual !== '' && actual !== null;
        if (op === OPERATOR_ID.NOT_EXISTS) return actual === '' || actual === null;
        return false;
    }
}