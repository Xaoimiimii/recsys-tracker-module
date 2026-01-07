export type ErrorHandler = (error: Error, context: string) => void;

// Error boundary cho xử lý lỗi an toàn trong SDK
export class ErrorBoundary {
  private errorHandler: ErrorHandler | null = null;
  private debug: boolean = false;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  // Set custom error handler
  setErrorHandler(handler: ErrorHandler): void {
    this.errorHandler = handler;
  }

  // Enable hoặc disable debug mode
  setDebug(debug: boolean): void {
    this.debug = debug;
  }

  // Execute function an toàn với xử lý lỗi
  execute<T>(fn: () => T, context: string = 'unknown'): T | undefined {
    try {
      return fn();
    } catch (error) {
      this.handleError(error as Error, context);
      return undefined;
    }
  }

  // Execute an async function an toàn với xử lý lỗi
  async executeAsync<T>(
    fn: () => Promise<T>,
    context: string = 'unknown'
  ): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error) {
      this.handleError(error as Error, context);
      return undefined;
    }
  }

  // Wrap một function với error boundary
  // Trả về một function mới thực thi an toàn
  wrap<T extends any[], R>(
    fn: (...args: T) => R,
    context: string = 'unknown'
  ): (...args: T) => R | undefined {
    return (...args: T): R | undefined => {
      return this.execute(() => fn(...args), context);
    };
  }

  // Wrap một async function với error boundary
  // Trả về một async function mới thực thi an toàn
  wrapAsync<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context: string = 'unknown'
  ): (...args: T) => Promise<R | undefined> {
    return async (...args: T): Promise<R | undefined> => {
      return this.executeAsync(() => fn(...args), context);
    };
  }

  // Handle error internally
  private handleError(error: Error, context: string): void {
    if (this.debug) {
      // console.error(`[RecSysTracker Error][${context}]`, error);
    }

    // Gọi error handler tùy chỉnh nếu có
    if (this.errorHandler) {
      try {
        this.errorHandler(error, context);
      } catch (handlerError) {
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
  private reportError(error: Error, context: string): void {
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
      } catch (reportError) {
        // Silent fail - don't let error reporting break anything
      }
    }, 0);
  }
}

export const globalErrorBoundary = new ErrorBoundary();
