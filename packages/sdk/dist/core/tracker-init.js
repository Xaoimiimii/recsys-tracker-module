import { TrackerCore } from './tracker-core';
export class TrackerInit {
    static getUsername() {
        var _a;
        if (this.usernameCache !== null) {
            return this.usernameCache;
        }
        // @ts-ignore
        const user = (_a = window.LoginDetector) === null || _a === void 0 ? void 0 : _a.getCurrentUser();
        return this.usernameCache = user !== null && user !== void 0 ? user : "guest";
    }
    static init() {
        console.log("✅ [TrackerInit] Static system initialized");
    }
    static handleMapping(rule, target = null) {
        var _a;
        const payload = {
            ruleId: rule.id,
            eventTypeId: rule.eventTypeId
        };
        const scope = TrackerCore.findScope(target, ((_a = rule.trackingTarget) === null || _a === void 0 ? void 0 : _a.value) || null);
        const mappings = rule.payloadMappings || [];
        mappings.forEach((map) => {
            const field = map.field;
            const source = map.source;
            const value = map.value;
            if (source === 'element') {
                payload[field] = TrackerCore.resolveElementValue(value, scope);
            }
            else if (source === 'static') {
                payload[field] = value;
            }
            else if (source === 'login_detector' || field.toLowerCase() === 'userid') {
                payload[field] = this.getUsername();
            }
        });
        return payload;
    }
    static checkConditions(conditions) {
        if (!conditions || conditions.length === 0)
            return true;
        return true;
    }
}
TrackerInit.usernameCache = null;
//# sourceMappingURL=tracker-init.js.map