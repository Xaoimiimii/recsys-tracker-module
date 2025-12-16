export class BasePlugin {
    constructor() {
        this.tracker = null;
        this.active = false;
    }
    init(tracker) {
        if (this.tracker) {
            console.warn(`[${this.name}] Plugin already initialized`);
            return;
        }
        this.tracker = tracker;
        console.log(`[${this.name}] Plugin v${this.version} initialized`);
    }
    stop() {
        this.active = false;
        console.log(`[${this.name}] Plugin stopped`);
    }
    destroy() {
        this.stop();
        this.tracker = null;
        console.log(`[${this.name}] Plugin destroyed`);
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
}
//# sourceMappingURL=base-plugin.js.map