import { getUserIdentityManager } from '../utils/user-identity-manager';
import { getAIItemDetector } from '../utils/ai-item-detector';
export class TrackerContextAdapter {
    constructor(tracker) {
        this.config = {
            getRules: (triggerEventId) => {
                const config = this.tracker.getConfig();
                if (!(config === null || config === void 0 ? void 0 : config.trackingRules))
                    return [];
                return config.trackingRules
                    .filter(rule => rule.triggerEventId === triggerEventId);
            },
        };
        this.payloadBuilder = {
            build: (element, rule, extraData = {}) => {
                const userIdentityManager = getUserIdentityManager();
                const payload = {
                    event: rule.triggerEventId === 1 ? "item_click" : "page_view",
                    url: window.location.href,
                    timestamp: Date.now(),
                    ruleName: rule.name,
                    userId: userIdentityManager.getRealUserId(),
                    itemId: 'N/A'
                };
                // Build payload extractor from rule data
                const targetValue = rule.targetElement.targetElementValue || '';
                const isRegex = targetValue.startsWith('^');
                const extractor = {
                    source: isRegex ? 'regex_group' : 'ai_detect',
                    eventKey: 'itemId',
                    pattern: isRegex ? targetValue : undefined,
                    groupIndex: isRegex ? 1 : undefined,
                };
                let detectionResult = null;
                if (!extractor || typeof extractor.source === 'undefined') {
                    console.error(`[PayloadBuilder Error] Rule '${rule.name}' is missing a valid payloadExtractor or source.`);
                    return {
                        ...payload,
                        itemId: 'N/A (Invalid Rule Config)',
                        itemName: 'Invalid Rule',
                        confidence: 0,
                        source: 'invalid_rule_config'
                    };
                }
                if (extractor.source === 'regex_group' && extraData.regexMatch) {
                    const match = extraData.regexMatch;
                    const groupIndex = extractor.groupIndex;
                    if (groupIndex !== undefined && match.length > groupIndex) {
                        const itemId = match[groupIndex];
                        return {
                            ...payload,
                            itemId: itemId,
                            itemName: itemId,
                            itemType: 'song',
                            confidence: 1.0,
                            source: 'regex_url'
                        };
                    }
                }
                if (extractor.source === 'ai_detect') {
                    const detector = getAIItemDetector();
                    if (rule.triggerEventId === 3 && element && element.id) {
                        detectionResult = element;
                    }
                    else if (detector && element instanceof Element) {
                        detectionResult = detector.detectItem(element);
                    }
                    if (detectionResult && detectionResult.id && detectionResult.id !== 'N/A (AI Failed)') {
                        return {
                            ...payload,
                            itemId: detectionResult.id,
                            itemName: detectionResult.name || 'Unknown',
                            itemType: detectionResult.type || 'content',
                            confidence: detectionResult.confidence || 0,
                            source: detectionResult.source || 'dom_based',
                            metadata: detectionResult.metadata || {}
                        };
                    }
                    else {
                        return {
                            ...payload,
                            itemId: 'N/A (Failed)',
                            itemName: 'Unknown Item',
                            confidence: 0,
                            source: 'rule_match_no_ai_id'
                        };
                    }
                }
                return payload;
            },
        };
        // File: core/adapters/tracker-context-adapter.ts
        this.eventBuffer = {
            enqueue: (payload) => {
                let triggerTypeId = 2;
                switch (payload.event) {
                    case 'item_click':
                        triggerTypeId = 1;
                        break;
                    case 'rate_submit':
                        triggerTypeId = 2;
                        break;
                    case 'page_view':
                        triggerTypeId = 3;
                        break;
                    default:
                        triggerTypeId = 3;
                }
                const trackData = {
                    triggerTypeId,
                    userId: parseInt(payload.userId) || 0,
                    itemId: parseInt(payload.itemId) || 0, // Lưu ý: server nhận int
                };
                if (payload.metadata && payload.metadata.rateValue !== undefined) {
                    trackData.rate = {
                        Value: Number(payload.metadata.rateValue),
                        Review: String(payload.metadata.reviewText || '')
                    };
                }
                if (payload.itemId && !payload.itemId.toString().startsWith('N/A')) {
                    this.tracker.track(trackData);
                }
            },
        };
        this.tracker = tracker;
    }
    updateIdentity(newUserId) {
        console.log(`[TrackerContext] Identity updated to: ${newUserId}`);
        this.tracker.setUserId(newUserId);
    }
}
//# sourceMappingURL=tracker-context-adapter.js.map