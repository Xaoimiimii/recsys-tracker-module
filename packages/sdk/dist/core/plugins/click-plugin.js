import { BasePlugin } from './base-plugin';
import { TrackerInit } from '../tracker-init';
export class ClickPlugin extends BasePlugin {
    constructor(config) {
        super();
        this.name = 'click-plugin';
        this.config = config;
    }
    start() {
        const configToUse = this.config || (this.tracker ? this.tracker.getConfig() : null);
        if (this.tracker && configToUse && configToUse.domainKey === 'e6f546d3797c6a91c22e215daf0ab0177d9f027606409e4b0fe609bde9906aaa') {
            console.warn("🚀 [ClickPlugin] Using INTERNAL MOCK config for Click Test Key");
            const mockRules = [
                {
                    "TrackingRule": {
                        "Id": "44",
                        "Name": "Click-plugin",
                        "EventType": "click",
                        "TargetElement": {
                            "Pattern": "css_selector",
                            "Operator": "equals",
                            "Value": "._song-row_hjtft_317"
                        },
                        "Conditions": [
                            {
                                "Pattern": "url",
                                "Operator": "contains",
                                "Value": "/favorites"
                            }
                        ],
                        "PayloadMappings": [
                            // {
                            //     "Field": "Title",
                            //     "Source": "element",
                            //     "Value": "._song-title-text_hjtft_367"
                            // },
                            {
                                "Field": "ItemId",
                                "Source": "element",
                                "Value": "data-rfd-draggable-id"
                            },
                            {
                                "Field": "userId",
                                "Source": "global_variable",
                                "Value": "LoginDetector.getCurrentUser"
                            }
                        ]
                    }
                }
            ];
            this.runPascalMode(mockRules);
            return;
        }
        console.log("[ClickPlugin] Starting with config:", configToUse);
        if (!configToUse || !configToUse.trackingRules) {
            console.warn("[ClickPlugin] No tracking rule found.");
            return;
        }
        const rules = configToUse.trackingRules;
        const isPascalCase = rules.length > 0 && (rules[0].TrackingRule || rules[0].TargetElement);
        console.log(`[ClickPlugin] Mode: ${isPascalCase ? 'PascalCase (New)' : 'Standard (Legacy)'}`);
        if (isPascalCase) {
            this.runPascalMode(rules);
        }
        else {
            this.runLegacyMode(rules);
        }
    }
    runPascalMode(rules) {
        console.log(`[ClickPlugin] Activated with ${rules.length} PascalCase rules.`);
        document.addEventListener('click', (event) => {
            rules.forEach((ruleWrapper) => {
                var _a;
                const rule = ruleWrapper.TrackingRule || ruleWrapper;
                if (!rule.TargetElement || !rule.TargetElement.Value)
                    return;
                const selector = rule.TargetElement.Value;
                const target = event.target.closest(selector);
                if (!target)
                    return;
                // 2. Check Conditions
                if (rule.Conditions) {
                    const conditionsMet = rule.Conditions.every(cond => {
                        if (cond.Pattern === 'url' && cond.Operator === 'contains') {
                            return window.location.href.includes(cond.Value);
                        }
                        return true;
                    });
                    if (!conditionsMet)
                        return;
                }
                console.log("🎯 [ClickPlugin] Match found for Rule:", rule.Name);
                if (rule.PayloadMappings) {
                    const targetElement = target;
                    const standardMappings = [];
                    let extractedData = {};
                    // Smart Extraction Strategy
                    rule.PayloadMappings.forEach(m => {
                        if (m.Source === 'element' && m.Value) {
                            // Priority 1: Check if 'Value' is an attribute on the Target Element
                            if (targetElement.hasAttribute(m.Value)) {
                                const attrVal = targetElement.getAttribute(m.Value);
                                if (attrVal) {
                                    extractedData[m.Field] = attrVal;
                                }
                            }
                            // Priority 2: Treat as Selector for child/global lookup (PayloadBuilder)
                            else {
                                standardMappings.push({
                                    field: m.Field,
                                    source: m.Source,
                                    value: m.Value
                                });
                            }
                        }
                        else {
                            // Non-element sources (global_variable etc) go to standard builder
                            standardMappings.push({
                                field: m.Field,
                                source: m.Source,
                                value: m.Value
                            });
                        }
                    });
                    // Execute Standard Mappings via PayloadBuilder
                    if (((_a = this.tracker) === null || _a === void 0 ? void 0 : _a.payloadBuilder) && standardMappings.length > 0) {
                        const builderData = this.tracker.payloadBuilder.build(standardMappings, targetElement);
                        extractedData = { ...extractedData, ...builderData };
                    }
                    console.log("🚀 Extracted Data (Merged Smart & Standard):", extractedData);
                    if (this.tracker) {
                        // Send data...
                    }
                }
                else {
                    console.warn("[ClickPlugin] PayloadBuilder not available or no mappings.");
                }
            });
        }, true);
    }
    runLegacyMode(rules) {
        const clickRules = rules.filter(rule => rule.eventTypeId === 1 || rule.eventTypeId === 44);
        if (clickRules.length === 0) {
            console.warn("[ClickPlugin] No active click rule found in config.");
            return;
        }
        console.log(`[ClickPlugin] Activated with ${clickRules.length} legacy rules.`);
        document.addEventListener('click', (event) => {
            clickRules.forEach((rule) => {
                var _a;
                const selector = (_a = rule.trackingTarget) === null || _a === void 0 ? void 0 : _a.value;
                if (!selector)
                    return;
                const target = event.target.closest(selector);
                if (target) {
                    console.log("🎯 [ClickPlugin] Match found for Rule ID:", rule.id);
                    const data = TrackerInit.handleMapping(rule, target);
                    if (this.sdk && typeof this.sdk.track === 'function') {
                        console.log("🚀 Sending to SDK.track:", data);
                    }
                    else {
                        console.log("🚀 Click Data collected:", data);
                    }
                }
            });
        }, true);
    }
}
//# sourceMappingURL=click-plugin.js.map