export class TrackerCore {
    static findScope(targetElement, rootSelector) {
        if (!targetElement)
            return document;
        if (rootSelector) {
            const scope = targetElement.closest(rootSelector);
            if (scope)
                return scope;
        }
        return targetElement.parentElement || document;
    }
    static resolveElementValue(selector, scope = document) {
        var _a;
        if (!scope)
            return null;
        if (selector.startsWith("[") && selector.endsWith("]")) {
            const attr = selector.slice(1, -1);
            if (scope instanceof HTMLElement && scope.hasAttribute(attr)) {
                return scope.getAttribute(attr);
            }
        }
        const el = scope.querySelector(selector);
        if (!el)
            return null;
        if (selector.startsWith("[")) {
            const attr = selector.slice(1, -1);
            return el.getAttribute(attr);
        }
        return ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || null;
    }
}
//# sourceMappingURL=tracker-core.js.map