export class TrackerCore {
  static findScope(
    targetElement: HTMLElement | null,
    rootSelector: string | null
  ): HTMLElement | Document {
    if (!targetElement) return document;

    if (rootSelector) {
      const scope = targetElement.closest(rootSelector) as HTMLElement;
      if (scope) return scope;
    }

    return targetElement.parentElement || document;
  }

  static resolveElementValue(
    selector: string,
    scope: HTMLElement | Document = document
  ): string | null {
    if (!scope || !(scope instanceof HTMLElement)) return null;

    if (scope.hasAttribute(selector)) {
      return scope.getAttribute(selector);
    }

    const el = scope.querySelector(selector);
    if (el) {
      return el.textContent?.trim() || null;
    }

    if (selector.startsWith("[") && selector.endsWith("]")) {
      const attrName = selector.slice(1, -1);
      const elWithAttr = scope.querySelector(selector);
      return elWithAttr ? elWithAttr.getAttribute(attrName) : null;
    }

    return null;
  }
}
