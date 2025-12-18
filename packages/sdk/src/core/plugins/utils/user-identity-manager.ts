import { STORAGE_KEYS } from './plugin-utils';
import { IRecsysContext } from '../interfaces/recsys-context.interface';

interface ExtendedXMLHttpRequest extends XMLHttpRequest {
    _url: string;
    _method: string;
    _isAuthRequest: boolean;
    responseText: string; 
}

declare global {
    var identityManager: UserIdentityManager | null;
    var recsysIdentityManager: UserIdentityManager;
}

let identityManagerInstance: UserIdentityManager | null = null;

export class UserIdentityManager {
    public identifiers: Record<string, any> = {};
    public sessionId: string = '';
    public currentUserId: string | null = null;
    public isLoggedIn: boolean = false;
    private initialized: boolean = false;
    private authRequests: Set<string> = new Set();
    
    private trackerContext: IRecsysContext | null = null; 

    constructor() {
        if (identityManagerInstance) {
            return identityManagerInstance;
        }

        this.identifiers = this.loadIdentifiers();
        this.sessionId = this.generateSessionId();

        identityManagerInstance = this;
        (window as any).identityManager = this;
        window.recsysIdentityManager = this;
    }
    
    public setTrackerContext(context: IRecsysContext): void {
        this.trackerContext = context;
        this.setupIdentitySynchronization();
    }

    public initialize(): void {
        if (this.initialized) return;
        
        const persistedUserId = this.getPersistedUserId();
        
        if (persistedUserId && !persistedUserId.startsWith('anon_')) {
            this.currentUserId = persistedUserId;
            this.isLoggedIn = true;
            console.log(`[RECSYS] Restored logged-in user: ${persistedUserId}`);
            this.identifiers.detectedUserId = persistedUserId;
            this.saveIdentifiers();
        } else {
            this.currentUserId = this.findOrCreateUserId();
        }
        
        this.setupEnhancedNetworkMonitoring();
        this.startMonitoring();
        
        this.initialized = true;
        console.log(`[RECSYS] Identity Manager initialized. Current user: ${this.currentUserId}, Logged in: ${this.isLoggedIn}`);
    }

    private getPersistedUserId(): string | null {
        if (this.identifiers.detectedUserId && typeof this.identifiers.detectedUserId === 'string' && !this.identifiers.detectedUserId.startsWith('anon_')) {
            return this.identifiers.detectedUserId;
        }
        
        const storedUserId = localStorage.getItem(STORAGE_KEYS.USER_ID);
        if (storedUserId && storedUserId !== 'undefined' && storedUserId !== 'null' && !storedUserId.startsWith('anon_')) {
            return storedUserId;
        }
        
        const anonId = localStorage.getItem(STORAGE_KEYS.ANON_USER_ID);
        if (anonId) {
            return anonId;
        }
        
        return null;
    }
    
    private findOrCreateUserId(): string {
        const userId = this.extractUserIdFromCookies() || 
                       this.extractUserIdFromLocalStorage() || 
                       this.extractUserIdFromJWT(localStorage.getItem('token'));
        
        if (userId && !userId.startsWith('anon_')) {
            this.handleDetectedUserId(userId, 'initial_lookup');
            this.isLoggedIn = true;
            return userId;
        }
        
        let anonId = localStorage.getItem(STORAGE_KEYS.ANON_USER_ID);
        if (!anonId) {
            anonId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
            localStorage.setItem(STORAGE_KEYS.ANON_USER_ID, anonId);
        }
        
        this.isLoggedIn = false;
        return anonId;
    }
        
    private getUserId(): string {
        if (this.currentUserId) {
            return this.currentUserId;
        }
        
        return this.findOrCreateUserId();
    }
    
    public getStableUserId(): string {
        return this.currentUserId || this.getUserId();
    }
    
    public getRealUserId(): string {
        if (this.currentUserId && !this.currentUserId.startsWith('anon_')) {
            return this.currentUserId;
        }
        
        return this.getUserId();
    }
    
    public refreshUserId(): string {
        const oldUserId = this.currentUserId;
        const newUserId = this.findOrCreateUserId();
        
        if (oldUserId !== newUserId) {
            const wasLoggedIn = this.isLoggedIn;
            this.isLoggedIn = !newUserId.startsWith('anon_');
            
            console.log(`[RECSYS] User ID changed: ${oldUserId} -> ${newUserId}, Login status: ${wasLoggedIn} -> ${this.isLoggedIn}`);
            
            this.currentUserId = newUserId;
            
            window.dispatchEvent(new CustomEvent('recsys:userIdChanged', {
                detail: { 
                    oldUserId, 
                    newUserId,
                    wasLoggedIn,
                    isNowLoggedIn: this.isLoggedIn,
                    sessionId: this.sessionId
                }
            }));
        }
        
        return newUserId;
    }
    
    private setupEnhancedNetworkMonitoring(): void {
        const self = this;
        const originalFetch = window.fetch;
        
        window.fetch = async (...args: Parameters<typeof window.fetch>) => {
            const [resource] = args;
            const url = typeof resource === 'string' ? resource : (resource as Request).url;
            
            if (url && (url.includes('/auth') || url.includes('/login') || url.includes('/signin'))) { 
                self.authRequests.add(url); 
            }
            
            try {
                const response = await originalFetch(...args);
                const clonedResponse = response.clone();
                
                if (url && self.authRequests.has(url)) {
                    setTimeout(() => { self.processAuthResponse(url, clonedResponse); }, 100);
                }
                
                return response;
            } catch (error) { 
                console.log('❌ Fetch error:', error); 
                throw error; 
            }
        };
        
        if (window.XMLHttpRequest) {
            const originalOpen = XMLHttpRequest.prototype.open;
            const originalSend = XMLHttpRequest.prototype.send;
            
            XMLHttpRequest.prototype.open = function(this: ExtendedXMLHttpRequest, method: string, url: string) {
                this._url = url;
                this._method = method;
                if (url && (url.includes('/auth') || url.includes('/login') || url.includes('/signin'))) { 
                    this._isAuthRequest = true; 
                }
                return originalOpen.apply(this, arguments as any);
            } as any;
            
            XMLHttpRequest.prototype.send = function(this: ExtendedXMLHttpRequest, _body?: Document | XMLHttpRequestBodyInit | null) {
                const xhr = this as ExtendedXMLHttpRequest;
                xhr.addEventListener('load', () => { 
                    if (xhr.status >= 200 && xhr.status < 300) {
                        if (xhr._isAuthRequest) { 
                            setTimeout(() => { self.processXHRAuthResponse(xhr); }, 100); 
                        }
                        setTimeout(() => { self.checkResponseForUserData(xhr); }, 150);
                    }
                });
                return originalSend.apply(this, arguments as any);
            } as any;
        }
        
        this.setupLocalStorageMonitor();
        this.setupCookieMonitor();
    }

    private async processAuthResponse(_url: string, response: Response): Promise<void> {
        try {
            const data = await response.json();
            const userId = this.extractUserIdFromObject(data);
            if (userId) { 
                this.handleDetectedUserId(userId, 'auth_response'); 
            } else { 
                setTimeout(() => { this.checkAllSourcesForUserId(); }, 1000); 
            }
        } catch (e) {}
    }
    
    private processXHRAuthResponse(xhr: ExtendedXMLHttpRequest): void {
        try {
            const data = JSON.parse(xhr.responseText);
            const userId = this.extractUserIdFromObject(data);
            if (userId) { 
                this.handleDetectedUserId(userId, 'xhr_auth_response'); 
            }
        } catch (e) {}
    }
    
    private checkResponseForUserData(xhr: ExtendedXMLHttpRequest): void {
        try {
            const data = JSON.parse(xhr.responseText);
            const userId = this.extractUserIdFromObject(data);
            if (userId && !this.authRequests.has(xhr._url)) {
                this.handleDetectedUserId(userId, 'api_response');
            }
        } catch (e) { /* Ignore */ }
    }

    // --- LOGIN HANDLERS ---
    // Đã đổi tên 'source' thành '_source'
    private handleDetectedUserId(userId: string, _source: string): void {
        if (this.currentUserId && !this.currentUserId.startsWith('anon_')) {
            console.log(`[RECSYS] User already authenticated as ${this.currentUserId}. Ignoring ${userId} from ${_source}`);
            return;
        }
        
        if (userId && !userId.startsWith('anon_')) {
            const oldUserId = this.currentUserId;
            const wasAnonymous = oldUserId && oldUserId.startsWith('anon_');
            
            if (wasAnonymous) {
                console.log(`[RECSYS CAPTURE] User logged in: ${oldUserId} -> ${userId} (Source: ${_source})`);
                this.onUserLoginDetected(oldUserId!, userId, _source); 
            } else if (oldUserId !== userId) {
                console.log(`[RECSYS CAPTURE] User ID updated: ${oldUserId} -> ${userId} (Source: ${_source})`);
            }
            
            this.currentUserId = userId;
            this.isLoggedIn = true;
            
            localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
            
            this.identifiers.detectedUserId = userId;
            this.identifiers.detectionMethod = _source;
            this.identifiers.detectionTime = new Date().toISOString();
            this.saveIdentifiers();
        }
    }

    // Đã đổi tên 'source' thành '_source'
    private onUserLoginDetected(anonymousId: string, userId: string, _source: string): void {
        this.sendLoginEvent(anonymousId, userId, _source);
        
        window.dispatchEvent(new CustomEvent('recsys:userLoggedIn', {
            detail: { 
                userId: userId, 
                anonymousId: anonymousId, 
                detectionMethod: _source, 
                sessionId: this.sessionId,
                timestamp: new Date().toISOString()
            }
        }));
    }

    private sendLoginEvent(anonymousId: string, userId: string, _source: string): void {
        console.log(`[RECSYS CAPTURE] Login event prepared for User ID: ${userId} (from ${anonymousId}).`);
    }

    private checkAllSourcesForUserId(): void { 
        const cookieUserId = this.extractUserIdFromCookies();
        if (cookieUserId) { 
            this.handleDetectedUserId(cookieUserId, 'cookies_after_login'); 
            return; 
        }
        
        const lsUserId = this.extractUserIdFromLocalStorage();
        if (lsUserId) { 
            this.handleDetectedUserId(lsUserId, 'localStorage_after_login'); 
            return; 
        }
        
        setTimeout(() => { this.checkCommonUserEndpoints(); }, 2000);
        this.startPostLoginPolling();
    }
    
    private startPostLoginPolling(): void { 
        let attempts = 0; 
        const maxAttempts = 10;
        
        const poll = () => {
            attempts++;
            const cookieId = this.extractUserIdFromCookies();
            const lsId = this.extractUserIdFromLocalStorage();
            
            if (cookieId) { 
                this.handleDetectedUserId(cookieId, 'polling_cookies'); 
                return; 
            }
            if (lsId) { 
                this.handleDetectedUserId(lsId, 'polling_localStorage'); 
                return; 
            }
            if (attempts < maxAttempts) { 
                setTimeout(poll, 1000); 
            }
        };
        
        setTimeout(poll, 1000);
    }
    
    private checkCommonUserEndpoints(): void { 
        const endpoints = ['/user/profile', '/api/me', '/user/me', '/account/info'];
        
        endpoints.forEach(endpoint => {
            fetch(endpoint, { method: 'GET', credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                const userId = this.extractUserIdFromObject(data);
                if (userId) { 
                    this.handleDetectedUserId(userId, `endpoint_${endpoint}`); 
                }
            }).catch(() => {});
        });
    }
    
    private setupLocalStorageMonitor(): void { 
        const self = this;
        const originalSetItem = localStorage.setItem;
        
        (localStorage.setItem as any) = function(this: Storage, key: string, value: string) {
            originalSetItem.call(this, key, value);
            if (self.isUserRelatedKey(key)) { 
                window.dispatchEvent(new CustomEvent('storage', { 
                    detail: { key, newValue: value, storageArea: this } 
                })); 
            }
        } as any;
        
        window.addEventListener('storage', ((e: StorageEvent) => {
            if (this.isUserRelatedKey(e.key)) {
                setTimeout(() => {
                    const userId = this.extractUserIdFromLocalStorage();
                    if (userId && !userId.startsWith('anon_')) { 
                        this.handleDetectedUserId(userId, 'localStorage_event'); 
                    }
                }, 100);
            }
        }) as EventListener);
    }
    
    private setupCookieMonitor(): void { 
        let lastCookieString = document.cookie;
        
        setInterval(() => {
            const currentCookieString = document.cookie;
            if (currentCookieString !== lastCookieString) {
                lastCookieString = currentCookieString;
                const userId = this.extractUserIdFromCookies();
                if (userId && !userId.startsWith('anon_')) { 
                    this.handleDetectedUserId(userId, 'cookies_polling'); 
                }
            }
        }, 2000);
    }
    
    private isUserRelatedKey(key: string | null): boolean {
        if (!key) return false;
        const keywords = ['user', 'auth', 'token', 'session', 'login', 'profile', 'id', 'account'];
        return keywords.some(kw => key!.toLowerCase().includes(kw.toLowerCase()));
    }
    
    private extractUserIdFromCookies(): string | null { 
        const cookies = document.cookie.split(';');
        const cookieMap: Record<string, string> = {};
        
        cookies.forEach(cookie => {
            const parts = cookie.trim().split('=');
            const key = parts[0];
            const value = parts.slice(1).join('=');
            if (key && value) cookieMap[key] = decodeURIComponent(value);
        });
        
        const possibleKeys = ['userId', 'user_id', 'uid', 'user-id', 'auth_user_id', STORAGE_KEYS.USER_ID];
        
        for (const key of possibleKeys) {
            if (cookieMap[key] && cookieMap[key] !== 'undefined') { 
                return cookieMap[key]; 
            }
        }
        
        const jwtKeys = ['token', 'access_token', 'jwt', 'auth_token'];
        for (const key of jwtKeys) {
            if (cookieMap[key]) {
                const userId = this.extractUserIdFromJWT(cookieMap[key]);
                if (userId) return userId;
            }
        }
        
        return null;
    }
    
    private extractUserIdFromLocalStorage(): string | null { 
        try {
            const possibleKeys = [
                'user_id', 'userId', 'uid', 'customer_id',
                'user', 'userData', 'auth', 'currentUser', 'userInfo', 'profile', 'account', 
                STORAGE_KEYS.USER_ID
            ];
            
            for (const key of possibleKeys) {
                const value = localStorage.getItem(key);
                if (value) {
                    try {
                        const parsed = JSON.parse(value);
                        const id = this.extractUserIdFromObject(parsed);
                        if (id) return id;
                    } catch (e) {
                        if (value.length < 100 && !value.includes('.')) { 
                            return value; 
                        }
                    }
                }
            }
            
            const tokenKeys = ['token', 'access_token', 'jwt', 'auth_token'];
            for (const key of tokenKeys) {
                const token = localStorage.getItem(key);
                if (token) {
                    const userId = this.extractUserIdFromJWT(token);
                    if (userId) return userId;
                }
            }
        } catch (e) { 
            return null; 
        }
        
        return null;
    }
    
    private extractUserIdFromJWT(token: string | null): string | null { 
        if (!token || !token.includes('.')) return null;
        
        try {
            const payload = token.split('.')[1];
            const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
            return decoded.sub || decoded.userId || decoded.id || decoded.user_id || decoded.UserId;
        } catch (e) { 
            return null; 
        }
    }
    
    private extractUserIdFromObject(obj: any): string | null { 
        if (!obj || typeof obj !== 'object') return null;
        
        const idKeys = ['id', 'userId', 'user_id', 'uid', '_id', 'userID', 'UserId', 'UserID'];
        
        for (const key of idKeys) {
            if (obj[key] && obj[key] !== 'undefined' && obj[key] !== 'null') { 
                return String(obj[key]); 
            }
        }
        
        for (const key in obj) {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                const found = this.extractUserIdFromObject(obj[key]);
                if (found) return found;
            }
        }
        
        return null;
    }
    
    private generateSessionId(): string {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    }
    
    private loadIdentifiers(): Record<string, any> {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.IDENTIFIERS);
            return stored ? JSON.parse(stored) : {};
        } catch (e) { 
            return {}; 
        }
    }
    
    private saveIdentifiers(): void {
        try {
            localStorage.setItem(STORAGE_KEYS.IDENTIFIERS, JSON.stringify(this.identifiers));
        } catch (e) { /* Ignore */ }
    }
    
    private startMonitoring(): void {
        setInterval(() => {
            if (!this.isLoggedIn || (this.currentUserId && this.currentUserId.startsWith('anon_'))) {
                const newUserId = this.findOrCreateUserId();
                
                if (newUserId !== this.currentUserId && !newUserId.startsWith('anon_')) {
                    console.log(`[RECSYS] Monitoring detected login: ${this.currentUserId} -> ${newUserId}`);
                    this.handleDetectedUserId(newUserId, 'monitoring');
                }
            }
        }, 5000);
    }
        
    public getUserInfo(): Record<string, any> {
        return {
            userId: this.currentUserId,
            isLoggedIn: this.isLoggedIn,
            sessionId: this.sessionId,
            detectionMethod: this.identifiers.detectionMethod,
            detectionTime: this.identifiers.detectionTime,
            isAnonymous: this.currentUserId ? this.currentUserId.startsWith('anon_') : true
        };
    }
    
    public logout(): void {
        const oldUserId = this.currentUserId;
        
        this.currentUserId = null;
        this.isLoggedIn = false;
        
        localStorage.removeItem(STORAGE_KEYS.USER_ID);
        
        const newAnonId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem(STORAGE_KEYS.ANON_USER_ID, newAnonId);
        this.currentUserId = newAnonId;
        
        console.log(`[RECSYS] User logged out: ${oldUserId} -> ${newAnonId}`);
        
        window.dispatchEvent(new CustomEvent('recsys:userLoggedOut', {
            detail: { 
                oldUserId, 
                newUserId: newAnonId,
                sessionId: this.sessionId
            }
        }));
    }
    
    private setupIdentitySynchronization(): void {
        if (!this.trackerContext) return;
        
        window.addEventListener('recsys:userLoggedIn', ((event: CustomEvent<any>) => {
            const customEvent = event as CustomEvent<any>;
            const newUserId = customEvent.detail.userId;
            const source = customEvent.detail.detectionMethod;

            if (newUserId) {
                this.trackerContext!.updateIdentity(newUserId); 
                console.log(`[Context Sync] User ID synced from IdentityManager (${source}).`);
            }
        }) as EventListener);
    }
}

export function getUserIdentityManager(): UserIdentityManager {
    if (!identityManagerInstance) {
        identityManagerInstance = new UserIdentityManager();
    }
    return identityManagerInstance;
}