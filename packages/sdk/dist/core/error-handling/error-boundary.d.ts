export type ErrorHandler = (error: Error, context: string) => void;
export declare class ErrorBoundary {
    private errorHandler;
    private debug;
    constructor(debug?: boolean);
    setErrorHandler(handler: ErrorHandler): void;
    setDebug(debug: boolean): void;
    execute<T>(fn: () => T, context?: string): T | undefined;
    executeAsync<T>(fn: () => Promise<T>, context?: string): Promise<T | undefined>;
    wrap<T extends any[], R>(fn: (...args: T) => R, context?: string): (...args: T) => R | undefined;
    wrapAsync<T extends any[], R>(fn: (...args: T) => Promise<R>, context?: string): (...args: T) => Promise<R | undefined>;
    private handleError;
    private reportError;
}
export declare const globalErrorBoundary: ErrorBoundary;
//# sourceMappingURL=error-boundary.d.ts.map