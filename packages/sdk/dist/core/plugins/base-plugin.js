import { ErrorBoundary } from '../error-handling/error-boundary';
export class BasePlugin {
    constructor() {
        this.tracker = null;
        this.active = false;
        this.errorBoundary = new ErrorBoundary(true); // Enable debug mode
    }
    init(tracker) {
        this.errorBoundary.execute(() => {
            if (this.tracker) {
                console.warn(`[${this.name}] Plugin already initialized`);
                return;
            }
            this.tracker = tracker;
            console.log(`[${this.name}] Plugin initialized`);
        }, `${this.name}.init`);
    }
    stop() {
        this.errorBoundary.execute(() => {
            this.active = false;
            console.log(`[${this.name}] Plugin stopped`);
        }, `${this.name}.stop`);
    }
    destroy() {
        this.errorBoundary.execute(() => {
            this.stop();
            this.tracker = null;
            console.log(`[${this.name}] Plugin destroyed`);
        }, `${this.name}.destroy`);
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
    // Wrap event handlers with error boundary
    wrapHandler(handler, handlerName = 'handler') {
        return this.errorBoundary.wrap(handler, `${this.name}.${handlerName}`);
    }
    // Wrap async event handlers with error boundary
    wrapAsyncHandler(handler, handlerName = 'asyncHandler') {
        return this.errorBoundary.wrapAsync(handler, `${this.name}.${handlerName}`);
    }
}
//# sourceMappingURL=base-plugin.js.map