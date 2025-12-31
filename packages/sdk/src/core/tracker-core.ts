export class TrackerCore {
  static findScope(targetElement: HTMLElement | null, rootSelector: string | null): HTMLElement | Document {
    if (!targetElement) return document;

    if (rootSelector) {
      const scope = targetElement.closest(rootSelector) as HTMLElement;
      if (scope) return scope;
    }

    return targetElement.parentElement || document;
  }

  static resolveElementValue(selector: string, scope: HTMLElement | Document = document): string | null {
    if (!scope) return null;

    if (selector.startsWith("[") && selector.endsWith("]")) {
      const attr = selector.slice(1, -1);
      if (scope instanceof HTMLElement && scope.hasAttribute(attr)) {
        return scope.getAttribute(attr);
      }
    }

    const el = scope.querySelector(selector);
    if (!el) return null;

    if (selector.startsWith("[")) {
      const attr = selector.slice(1, -1);
      return el.getAttribute(attr);
    }

    return el.textContent?.trim() || null;
  }
}