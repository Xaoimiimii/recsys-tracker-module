// Error boundary cho xử lý lỗi an toàn trong SDK
export class ErrorBoundary {
    constructor(debug = false) {
        this.errorHandler = null;
        this.debug = false;
        this.debug = debug;
    }
    // Set custom error handler
    setErrorHandler(handler) {
        this.errorHandler = handler;
    }
    // Enable hoặc disable debug mode
    setDebug(debug) {
        this.debug = debug;
    }
    // Execute function an toàn với xử lý lỗi
    execute(fn, context = 'unknown') {
        try {
            return fn();
        }
        catch (error) {
            this.handleError(error, context);
            return undefined;
        }
    }
    // Execute an async function an toàn với xử lý lỗi
    async executeAsync(fn, context = 'unknown') {
        try {
            return await fn();
        }
        catch (error) {
            this.handleError(error, context);
            return undefined;
        }
    }
    // Wrap một function với error boundary
    // Trả về một function mới thực thi an toàn
    wrap(fn, context = 'unknown') {
        return (...args) => {
            return this.execute(() => fn(...args), context);
        };
    }
    // Wrap một async function với error boundary
    // Trả về một async function mới thực thi an toàn
    wrapAsync(fn, context = 'unknown') {
        return async (...args) => {
            return this.executeAsync(() => fn(...args), context);
        };
    }
    // Handle error internally
    handleError(error, context) {
        if (this.debug) {
            // console.error(`[RecSysTracker Error][${context}]`, error);
        }
        // Gọi error handler tùy chỉnh nếu có
        if (this.errorHandler) {
            try {
                this.errorHandler(error, context);
            }
            catch (handlerError) {
                // Prevent error handler from breaking
                if (this.debug) {
                    // console.error('[RecSysTracker] Error handler failed:', handlerError);
                }
            }
        }
        // Gửi lỗi đến endpoint từ xa (optional)
        this.reportError(error, context);
    }
    // Gửi lỗi đến endpoint từ xa
    reportError(error, context) {
        // Gửi lỗi không đồng bộ để không ảnh hưởng đến luồng chính
        setTimeout(() => {
            try {
                if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
                    const errorData = JSON.stringify({
                        type: 'sdk_error',
                        context,
                        message: error.message,
                        stack: error.stack,
                        timestamp: Date.now(),
                        userAgent: navigator.userAgent,
                    });
                    // Send error data
                    navigator.sendBeacon('/errors', errorData);
                }
            }
            catch (reportError) {
                // Silent fail - don't let error reporting break anything
            }
        }, 0);
    }
}
export const globalErrorBoundary = new ErrorBoundary();
//# sourceMappingURL=error-boundary.js.map