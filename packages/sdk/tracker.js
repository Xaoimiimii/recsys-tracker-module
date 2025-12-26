/**
 * AUTO TRACKER SDK - FULL CAPTURE (REQUEST + RESPONSE)
 * [REFACTORED]
 * This logic has always been integrated into the RecSysTracker SDK.
 * This script now acts as a bridge to convert legacy configuration to the new system, which uses PayloadBuilder.
 */
(function (window) {
    'use strict';

    if (!window.RecSysTracker) {
        // SDK likely not loaded yet.
    }

    const legacyConfig = window.__TRACKER_CONFIG__;

    if (legacyConfig && legacyConfig.rules) {
        console.log("[RecSysTracker] Adapting legacy tracker.js rules...");

        window.RecSysTrackerConfig = window.RecSysTrackerConfig || {};
        window.RecSysTrackerConfig.trackingRules = window.RecSysTrackerConfig.trackingRules || [];

        const newRules = legacyConfig.rules.map((rule, index) => {
            return {
                id: `legacy-${index}`,
                name: rule.label || `Legacy Rule ${index}`,
                eventTypeId: 100,
                payloadMappings: [
                    {
                        field: 'auto_value',
                        source: 'network_request', // Explicitly use network_request for PayloadBuilder
                        requestUrlPattern: rule.apiUrl,
                        requestMethod: rule.method,
                        value: rule.bodyPath
                    }
                ],
                conditions: [],
                trackingTarget: { id: 0, value: '' }
            };
        });

        window.RecSysTrackerConfig.trackingRules.push(...newRules);

        if (legacyConfig.collectorUrl && !window.RecSysTrackerConfig.trackEndpoint) {
            window.RecSysTrackerConfig.trackEndpoint = legacyConfig.collectorUrl;
        }
    }

})(window);