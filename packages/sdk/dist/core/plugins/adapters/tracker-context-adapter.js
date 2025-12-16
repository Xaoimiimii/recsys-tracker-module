import { getUserIdentityManager } from '../utils/user-identity-manager';
import { getAIItemDetector } from '../utils/ai-item-detector';
// Adapter to convert TrackingRule to IRecsysRule
function convertToRecsysRule(trackingRule) {
    // Map triggerEventId to event type
    const triggerEvent = trackingRule.triggerEventId === 1 ? 'click' :
        trackingRule.triggerEventId === 2 ? 'page_view' : 'click';
    // Determine payload extractor source from tracking rule
    const targetValue = trackingRule.targetElementValue || '';
    const isRegex = targetValue.startsWith('^');
    return {
        ruleName: trackingRule.name,
        triggerEvent,
        targetSelector: targetValue,
        condition: { type: "NONE", operator: "NONE", value: null },
        payloadExtractor: {
            source: isRegex ? 'regex_group' : 'ai_detect',
            pattern: isRegex ? targetValue : undefined,
            groupIndex: isRegex ? 1 : undefined,
            eventKey: "itemId",
        },
    };
}
/**
 * TrackerContextAdapter - Bridge between RecSysTracker and legacy IRecsysContext
 * Keeps 100% original logic, only adapts data from new SDK config
 */
export class TrackerContextAdapter {
    constructor(tracker) {
        this.config = {
            getRules: (eventType) => {
                const config = this.tracker.getConfig();
                if (!(config === null || config === void 0 ? void 0 : config.trackingRules))
                    return [];
                const triggerEventId = eventType === 'click' ? 1 : 2;
                return config.trackingRules
                    .filter(rule => rule.triggerEventId === triggerEventId)
                    .map(convertToRecsysRule)
                    .filter((rule) => rule !== null);
            },
        };
        this.payloadBuilder = {
            build: (element, rule, extraData = {}) => {
                const userIdentityManager = getUserIdentityManager();
                const payload = {
                    event: rule.triggerEvent === "click" ? "item_click" : "page_view",
                    url: window.location.href,
                    timestamp: Date.now(),
                    ruleName: rule.ruleName,
                    userId: userIdentityManager.getRealUserId(),
                    itemId: 'N/A'
                };
                let detectionResult = null;
                const extractor = rule.payloadExtractor;
                if (!extractor || typeof extractor.source === 'undefined') {
                    console.error(`[PayloadBuilder Error] Rule '${rule.ruleName}' is missing a valid payloadExtractor or source.`);
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
                    if (rule.triggerEvent === 'page_view' && element && element.id) {
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
        this.eventBuffer = {
            enqueue: (payload) => {
                console.groupCollapsed(`✅ [RECSYS TRACK] - ${payload.event.toUpperCase()} (UserID: ${payload.userId.substring(0, Math.min(15, payload.userId.length))}... | Confidence: ${(payload.confidence !== undefined ? payload.confidence * 100 : 0).toFixed(0)}%)`);
                console.log("Payload:", payload);
                if (payload.itemId && payload.itemId !== 'N/A (Failed)') {
                    console.log(`✨ ITEM ID CAPTURED: ${payload.itemId} (${payload.itemName})`);
                    console.log(`Source: ${payload.source} | Type: ${payload.itemType}`);
                }
                else {
                    console.warn('⚠️ ITEM ID EXTRACTION FAILED. Check AIItemDetector logs.');
                }
                console.log(`--- Mock Sending to /track endpoint ---`);
                console.groupEnd();
                // Also send to real SDK event buffer if needed
                // TODO: Integrate with SDK's actual event tracking
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