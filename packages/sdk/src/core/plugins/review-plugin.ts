import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
import { getAIItemDetector, AIItemDetector } from './utils/ai-item-detector';
import { getUserIdentityManager, UserIdentityManager } from './utils/user-identity-manager';

const TARGET_PATTERN_ID = { CSS_SELECTOR: 1 };
const CONDITION_PATTERN_ID = { URL_PARAM: 1, CSS_SELECTOR: 2, DOM_ATTRIBUTE: 3, DATA_ATTRIBUTE: 4 };
const OPERATOR_ID = { CONTAINS: 1, NOT_CONTAINS: 2, STARTS_WITH: 3, ENDS_WITH: 4, EQUALS: 5, EXISTS: 7, NOT_EXISTS: 8 };

export class ReviewPlugin extends BasePlugin {
    public readonly name = 'ReviewPlugin';

    private detector: AIItemDetector | null = null;
    private identityManager: UserIdentityManager | null = null;
    private handleSubmitBound = this.handleSubmit.bind(this);

    public init(tracker: RecSysTracker): void {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            this.detector = getAIItemDetector();
            this.identityManager = getUserIdentityManager();
            this.identityManager.initialize();
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
            if (this.tracker) {
                document.removeEventListener('submit', this.handleSubmitBound, { capture: true });
            }
            super.stop();
        }, 'ReviewPlugin.stop'); // Using stop/destroy consistency?
    }

    private handleSubmit(event: Event): void {
        console.log("🔥 [ReviewPlugin] Detected SUBMIT event!");
        if (!this.tracker) return;
        const form = event.target as HTMLFormElement;

        console.log(`📝 [ReviewPlugin] Checking form: #${form.id} (Classes: ${form.className})`);

        // Trigger ID for Review is typically 5 (or configured)
        const eventId = this.tracker.getEventTypeId('Review') || 5;
        const config = this.tracker.getConfig();
        const reviewRules = config?.trackingRules?.filter(r => r.eventTypeId === eventId) || [];

        console.log(`🔎 [ReviewPlugin] Found ${reviewRules.length} rules for TriggerID=${eventId}`);
        if (reviewRules.length === 0) return;

        for (const rule of reviewRules) {
            // 1. Check Target
            if (!this.checkTargetMatch(form, rule)) continue;

            // 2. Check Condition
            if (!this.checkConditions(form, rule)) continue;

            console.log(`✅ [ReviewPlugin] Match Rule: "${rule.name}"`);

            // 3. Construct Payload
            const payload = this.constructPayload(form, rule, eventId);

            // 4. Send Event
            this.tracker.track(payload);

            console.log(payload);
            return;
        }

        console.log("❌ [ReviewPlugin] No rules matched the current form.");
    }

    private constructPayload(form: HTMLFormElement, rule: any, eventId: number): any {
        // Extract via PayloadBuilder
        const mappedData = this.tracker!.payloadBuilder.build(form, rule);

        console.log("🧩 [ReviewPlugin] Mapped Data from Config:", mappedData);

        // Basic Payload
        const payload: any = {
            eventTypeId: eventId,
            trackingRuleId: Number(rule.id),
            userField: 'UserId',
            userValue: '',
            itemField: 'ItemId',
            itemValue: '',
            value: ''
        };

        const potentialUserKeys = ['userId', 'userName', 'userUID'];
        const potentialItemKeys = ['itemId', 'itemName', 'itemUID'];

        // Map Extracted Data
        for (const key of potentialUserKeys) {
            if (mappedData[key]) {
                payload.userField = key;
                payload.userValue = mappedData[key];
                break;
            }
        }

        for (const key of potentialItemKeys) {
            if (mappedData[key]) {
                payload.itemField = key;
                payload.itemValue = mappedData[key];
                break;
            }
        }

        const content = mappedData.review_text || mappedData.content || mappedData.value || mappedData.review;
        if (content) {
            payload.value = content;
        }

        // --- FALLBACK ITEM ID ---
        if (!payload.itemValue) {
            console.log("⚠️ [ReviewPlugin] Missing ItemId from config. Trying Auto-detect...");
            const radarScan = this.scanSurroundingContext(form);
            if (radarScan.id) {
                payload.itemValue = radarScan.id;
            } else if (this.detector) {
                const aiItem = this.detector.detectItem(form);
                if (aiItem && aiItem.id && aiItem.id !== 'N/A (Failed)') {
                    payload.itemValue = aiItem.id;
                }
            }
        }

        // --- FALLBACK USER ID ---
        if (!payload.userValue && this.identityManager) {
            console.log("⚠️ [ReviewPlugin] Missing UserId from config. Trying IdentityManager...");
            const realId = this.identityManager.getRealUserId();
            const stableId = this.identityManager.getStableUserId();
            if (realId && !realId.startsWith('anon_')) {
                payload.userValue = realId;
            } else if (stableId) {
                payload.userValue = stableId;
            }
        }

        // --- FALLBACK REVIEW CONTENT ---
        if (!payload.value) {
            const autoContent = this.autoDetectReviewContent(form);
            if (autoContent) {
                console.log("⚠️ [ReviewPlugin] Auto-detected review content from form fields.");
                payload.value = autoContent;
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
        for (const [key, val] of (formData as any)) {
            const k = key.toLowerCase();
            const vStr = String(val);
            if (k.includes('review') || k.includes('comment') || k.includes('body') || k.includes('content')) {
                if (vStr.length > content.length) content = vStr;
            }
        }
        return content;
    }

    private scanSurroundingContext(element: HTMLElement): any {
        const getAttrs = (el: Element | null) => {
            if (!el) return null;
            const id = el.getAttribute('data-item-id') || el.getAttribute('data-product-id') || el.getAttribute('data-id');
            if (id) return { id, name: el.getAttribute('data-item-name') || undefined, type: el.getAttribute('data-item-type') || undefined };
            return null;
        };

        const ancestor = element.closest('[data-item-id], [data-product-id]');
        if (ancestor) {
            const data = getAttrs(ancestor);
            if (data) return { ...data, source: 'ancestor_attribute' };
        }

        const textContainers = Array.from(element.querySelectorAll('label, legend, h3, h4, .product-title'));
        for (const container of textContainers) {
            const text = container.textContent || '';
            const idMatch = text.match(/\((P-[A-Z0-9-]+)\)/i);
            if (idMatch && idMatch[1]) return { id: idMatch[1], source: 'text_heuristic_brackets' };

            const codeMatch = text.match(/(?:code|sku|id|mã)[:\s]+([A-Z0-9-]+)/i);
            if (codeMatch && codeMatch[1]) return { id: codeMatch[1], source: 'text_heuristic_label' };
        }

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