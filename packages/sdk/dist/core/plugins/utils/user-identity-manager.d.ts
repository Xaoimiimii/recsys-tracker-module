import { RecSysTracker } from '../../..';
declare global {
    var identityManager: UserIdentityManager | null;
    var recsysIdentityManager: UserIdentityManager;
}
export declare class UserIdentityManager {
    identifiers: Record<string, any>;
    sessionId: string;
    currentUserId: string | null;
    isLoggedIn: boolean;
    private initialized;
    private authRequests;
    private tracker;
    constructor();
    setTracker(tracker: RecSysTracker): void;
    initialize(): void;
    private getPersistedUserId;
    private findOrCreateUserId;
    private getUserId;
    getStableUserId(): string;
    getRealUserId(): string;
    refreshUserId(): string;
    private setupEnhancedNetworkMonitoring;
    private processAuthResponse;
    private processXHRAuthResponse;
    private checkResponseForUserData;
    private handleDetectedUserId;
    private onUserLoginDetected;
    private sendLoginEvent;
    private checkAllSourcesForUserId;
    private startPostLoginPolling;
    private checkCommonUserEndpoints;
    private setupLocalStorageMonitor;
    private setupCookieMonitor;
    private isUserRelatedKey;
    private extractUserIdFromCookies;
    private extractUserIdFromLocalStorage;
    private extractUserIdFromJWT;
    private extractUserIdFromObject;
    private generateSessionId;
    private loadIdentifiers;
    private saveIdentifiers;
    private startMonitoring;
    getUserInfo(): Record<string, any>;
    logout(): void;
}
export declare function getUserIdentityManager(): UserIdentityManager;
//# sourceMappingURL=user-identity-manager.d.ts.map