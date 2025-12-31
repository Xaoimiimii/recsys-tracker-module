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
        if (!scope || !(scope instanceof HTMLElement))
            return null;
        if (scope.hasAttribute(selector)) {
            return scope.getAttribute(selector);
        }
        const el = scope.querySelector(selector);
        if (el) {
            return ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || null;
        }
        if (selector.startsWith("[") && selector.endsWith("]")) {
            const attrName = selector.slice(1, -1);
            const elWithAttr = scope.querySelector(selector);
            return elWithAttr ? elWithAttr.getAttribute(attrName) : null;
        }
        return null;
    }
}
//# sourceMappingURL=tracker-core.js.map