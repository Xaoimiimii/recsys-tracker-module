import { ErrorBoundary } from '../error-handling/error-boundary';
export class BasePlugin {
    constructor() {
        this.tracker = null;
        this.active = false;
        this.payloadBuilder = null;
        this.errorBoundary = new ErrorBoundary(true);
    }
    init(tracker) {
        this.errorBoundary.execute(() => {
            if (this.tracker) {
                return;
            }
            this.tracker = tracker;
            this.payloadBuilder = tracker.payloadBuilder;
        }, `${this.name}.init`);
    }
    stop() {
        this.errorBoundary.execute(() => {
            this.active = false;
            console.log(`[${this.name}] Plugin stopped`);
        }, `${this.name}.stop`);
    }
    destroy() {
        this.errorBoundary.execute(() => {
            this.stop();
            this.tracker = null;
            console.log(`[${this.name}] Plugin destroyed`);
        }, `${this.name}.destroy`);
    }
    isActive() {
        return this.active;
    }
    ensureInitialized() {
        if (!this.tracker) {
            console.error(`[${this.name}] Plugin not initialized. Call init() first.`);
            return false;
        }
        return true;
    }
    // Wrap event handlers with error boundary
    wrapHandler(handler, handlerName = 'handler') {
        return this.errorBoundary.wrap(handler, `${this.name}.${handlerName}`);
    }
    // Wrap async event handlers with error boundary
    wrapAsyncHandler(handler, handlerName = 'asyncHandler') {
        return this.errorBoundary.wrapAsync(handler, `${this.name}.${handlerName}`);
    }
    // Xử lý thông tin user, item, rating/review_value từ extracted data
    resolvePayloadIdentity(extractedData, rule) {
        // Default values
        let userField = 'UserId';
        let userValue = '';
        let itemField = 'ItemId';
        let itemValue = '';
        let value = '';
        // If rule is provided, use its mappings to determine fields
        if (rule && rule.payloadMappings && Array.isArray(rule.payloadMappings)) {
            for (const mapping of rule.payloadMappings) {
                const fieldName = mapping.Field || mapping.field; // Handle potential case differences
                const fieldValue = extractedData[fieldName];
                // Check for User fields
                if (fieldName && ['UserId', 'Username'].some(f => f.toLowerCase() === fieldName.toLowerCase())) {
                    userField = fieldName;
                    userValue = fieldValue || ''; // Ensure empty string if undefined
                }
                // Check for Item fields
                if (fieldName && ['ItemId', 'ItemTitle'].some(f => f.toLowerCase() === fieldName.toLowerCase())) {
                    itemField = fieldName;
                    itemValue = fieldValue || ''; // Ensure empty string if undefined
                }
                // Check for Value field
                if (fieldName && ['Value'].some(f => f.toLowerCase() === fieldName.toLowerCase())) {
                    value = fieldValue || '';
                }
            }
        }
        else {
            // Fallback if no rule provided
            // Common user field patterns (prioritized)
            const userFieldPatterns = ['UserId', 'Username'];
            // Common item field patterns (prioritized)
            const itemFieldPatterns = ['ItemId', 'ItemTitle'];
            // Common rating/review_value patterns (prioritized)
            const valuePatterns = ['Value'];
            // Find first available user field
            for (const key of Object.keys(extractedData)) {
                if (!userValue && userFieldPatterns.some(pattern => key.toLowerCase().includes(pattern.toLowerCase()))) {
                    userField = key;
                    userValue = extractedData[key];
                }
                if (!itemValue && itemFieldPatterns.some(pattern => key.toLowerCase().includes(pattern.toLowerCase()))) {
                    itemField = key;
                    itemValue = extractedData[key];
                }
                if (!value && valuePatterns.some(pattern => key.toLowerCase().includes(pattern.toLowerCase()))) {
                    value = extractedData[key];
                }
                if (userValue && itemValue && value)
                    break;
            }
        }
        return { userField, userValue, itemField, itemValue, value };
    }
    /**
     * Phương thức xây dựng và theo dõi payload
     * Extraction → identity resolution → payload construction → tracking
     *
     * @param context - Context for extraction (HTMLElement, NetworkContext, etc.)
     * @param rule - Tracking rule with payload mappings
     * @param eventId - Event type ID
     * @param additionalFields - Optional additional fields (ratingValue, reviewValue, metadata, etc.)
     */
    buildAndTrack(context, rule, eventId, additionalFields) {
        if (!this.tracker) {
            console.warn(`[${this.name}] Cannot track: tracker not initialized`);
            return;
        }
        // 1. Extract data using PayloadBuilder
        const extractedData = this.tracker.payloadBuilder.build(context, rule);
        // 2. Resolve identity fields dynamically
        const { userField, userValue, itemField, itemValue, value } = this.resolvePayloadIdentity(extractedData, rule);
        // 3. Construct payload
        const payload = {
            eventTypeId: eventId,
            trackingRuleId: rule.id,
            userField,
            userValue,
            itemField,
            itemValue,
            value,
            ...additionalFields
        };
        // 4. Track the event
        this.tracker.track(payload);
    }
}
//# sourceMappingURL=base-plugin.js.map