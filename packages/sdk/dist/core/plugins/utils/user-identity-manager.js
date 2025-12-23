import { STORAGE_KEYS } from './plugin-utils';
let identityManagerInstance = null;
export class UserIdentityManager {
    constructor() {
        this.identifiers = {};
        this.sessionId = '';
        this.currentUserId = null;
        this.isLoggedIn = false;
        this.initialized = false;
        this.authRequests = new Set();
        this.trackerContext = null;
        if (identityManagerInstance) {
            return identityManagerInstance;
        }
        this.identifiers = this.loadIdentifiers();
        this.sessionId = this.generateSessionId();
        identityManagerInstance = this;
        window.identityManager = this;
        window.recsysIdentityManager = this;
    }
    setTrackerContext(context) {
        this.trackerContext = context;
        this.setupIdentitySynchronization();
    }
    initialize() {
        if (this.initialized)
            return;
        const persistedUserId = this.getPersistedUserId();
        if (persistedUserId && !persistedUserId.startsWith('anon_')) {
            this.currentUserId = persistedUserId;
            this.isLoggedIn = true;
            console.log(`[RECSYS] Restored logged-in user: ${persistedUserId}`);
            this.identifiers.detectedUserId = persistedUserId;
            this.saveIdentifiers();
        }
        else {
            this.currentUserId = this.findOrCreateUserId();
        }
        this.setupEnhancedNetworkMonitoring();
        this.startMonitoring();
        this.initialized = true;
        console.log(`[RECSYS] Identity Manager initialized. Current user: ${this.currentUserId}, Logged in: ${this.isLoggedIn}`);
    }
    getPersistedUserId() {
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
    findOrCreateUserId() {
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
    getUserId() {
        if (this.currentUserId) {
            return this.currentUserId;
        }
        return this.findOrCreateUserId();
    }
    getStableUserId() {
        return this.currentUserId || this.getUserId();
    }
    getRealUserId() {
        if (this.currentUserId && !this.currentUserId.startsWith('anon_')) {
            return this.currentUserId;
        }
        return this.getUserId();
    }
    refreshUserId() {
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
    setupEnhancedNetworkMonitoring() {
        const self = this;
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const [resource] = args;
            const url = typeof resource === 'string' ? resource : resource.url;
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
            }
            catch (error) {
                console.log('❌ Fetch error:', error);
                throw error;
            }
        };
        if (window.XMLHttpRequest) {
            const originalOpen = XMLHttpRequest.prototype.open;
            const originalSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.open = function (method, url) {
                this._url = url;
                this._method = method;
                if (url && (url.includes('/auth') || url.includes('/login') || url.includes('/signin'))) {
                    this._isAuthRequest = true;
                }
                return originalOpen.apply(this, arguments);
            };
            XMLHttpRequest.prototype.send = function (_body) {
                const xhr = this;
                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        if (xhr._isAuthRequest) {
                            setTimeout(() => { self.processXHRAuthResponse(xhr); }, 100);
                        }
                        setTimeout(() => { self.checkResponseForUserData(xhr); }, 150);
                    }
                });
                return originalSend.apply(this, arguments);
            };
        }
        this.setupLocalStorageMonitor();
        this.setupCookieMonitor();
    }
    async processAuthResponse(_url, response) {
        try {
            const data = await response.json();
            const userId = this.extractUserIdFromObject(data);
            if (userId) {
                this.handleDetectedUserId(userId, 'auth_response');
            }
            else {
                setTimeout(() => { this.checkAllSourcesForUserId(); }, 1000);
            }
        }
        catch (e) { }
    }
    processXHRAuthResponse(xhr) {
        try {
            const data = JSON.parse(xhr.responseText);
            const userId = this.extractUserIdFromObject(data);
            if (userId) {
                this.handleDetectedUserId(userId, 'xhr_auth_response');
            }
        }
        catch (e) { }
    }
    checkResponseForUserData(xhr) {
        try {
            const data = JSON.parse(xhr.responseText);
            const userId = this.extractUserIdFromObject(data);
            if (userId && !this.authRequests.has(xhr._url)) {
                this.handleDetectedUserId(userId, 'api_response');
            }
        }
        catch (e) { /* Ignore */ }
    }
    // --- LOGIN HANDLERS ---
    // Đã đổi tên 'source' thành '_source'
    handleDetectedUserId(userId, _source) {
        if (this.currentUserId && !this.currentUserId.startsWith('anon_')) {
            console.log(`[RECSYS] User already authenticated as ${this.currentUserId}. Ignoring ${userId} from ${_source}`);
            return;
        }
        if (userId && !userId.startsWith('anon_')) {
            const oldUserId = this.currentUserId;
            const wasAnonymous = oldUserId && oldUserId.startsWith('anon_');
            if (wasAnonymous) {
                console.log(`[RECSYS CAPTURE] User logged in: ${oldUserId} -> ${userId} (Source: ${_source})`);
                this.onUserLoginDetected(oldUserId, userId, _source);
            }
            else if (oldUserId !== userId) {
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
    onUserLoginDetected(anonymousId, userId, _source) {
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
    sendLoginEvent(anonymousId, userId, _source) {
        console.log(`[RECSYS CAPTURE] Login event prepared for User ID: ${userId} (from ${anonymousId}).`);
    }
    checkAllSourcesForUserId() {
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
    startPostLoginPolling() {
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
    checkCommonUserEndpoints() {
        const endpoints = ['/user/profile', '/api/me', '/user/me', '/account/info'];
        endpoints.forEach(endpoint => {
            fetch(endpoint, { method: 'GET', credentials: 'include' })
                .then(res => res.json())
                .then(data => {
                const userId = this.extractUserIdFromObject(data);
                if (userId) {
                    this.handleDetectedUserId(userId, `endpoint_${endpoint}`);
                }
            }).catch(() => { });
        });
    }
    setupLocalStorageMonitor() {
        const self = this;
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = function (key, value) {
            originalSetItem.call(this, key, value);
            if (self.isUserRelatedKey(key)) {
                window.dispatchEvent(new CustomEvent('storage', {
                    detail: { key, newValue: value, storageArea: this }
                }));
            }
        };
        window.addEventListener('storage', ((e) => {
            if (this.isUserRelatedKey(e.key)) {
                setTimeout(() => {
                    const userId = this.extractUserIdFromLocalStorage();
                    if (userId && !userId.startsWith('anon_')) {
                        this.handleDetectedUserId(userId, 'localStorage_event');
                    }
                }, 100);
            }
        }));
    }
    setupCookieMonitor() {
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
    isUserRelatedKey(key) {
        if (!key)
            return false;
        const keywords = ['user', 'auth', 'token', 'session', 'login', 'profile', 'id', 'account'];
        return keywords.some(kw => key.toLowerCase().includes(kw.toLowerCase()));
    }
    extractUserIdFromCookies() {
        const cookies = document.cookie.split(';');
        const cookieMap = {};
        cookies.forEach(cookie => {
            const parts = cookie.trim().split('=');
            const key = parts[0];
            const value = parts.slice(1).join('=');
            if (key && value)
                cookieMap[key] = decodeURIComponent(value);
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
                if (userId)
                    return userId;
            }
        }
        return null;
    }
    extractUserIdFromLocalStorage() {
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
                        if (id)
                            return id;
                    }
                    catch (e) {
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
                    if (userId)
                        return userId;
                }
            }
        }
        catch (e) {
            return null;
        }
        return null;
    }
    extractUserIdFromJWT(token) {
        if (!token || !token.includes('.'))
            return null;
        try {
            const payload = token.split('.')[1];
            const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
            return decoded.sub || decoded.userId || decoded.id || decoded.user_id || decoded.UserId;
        }
        catch (e) {
            return null;
        }
    }
    extractUserIdFromObject(obj) {
        if (!obj || typeof obj !== 'object')
            return null;
        const idKeys = ['id', 'userId', 'user_id', 'uid', '_id', 'userID', 'UserId', 'UserID'];
        for (const key of idKeys) {
            if (obj[key] && obj[key] !== 'undefined' && obj[key] !== 'null') {
                return String(obj[key]);
            }
        }
        for (const key in obj) {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                const found = this.extractUserIdFromObject(obj[key]);
                if (found)
                    return found;
            }
        }
        return null;
    }
    generateSessionId() {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    }
    loadIdentifiers() {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.IDENTIFIERS);
            return stored ? JSON.parse(stored) : {};
        }
        catch (e) {
            return {};
        }
    }
    saveIdentifiers() {
        try {
            localStorage.setItem(STORAGE_KEYS.IDENTIFIERS, JSON.stringify(this.identifiers));
        }
        catch (e) { /* Ignore */ }
    }
    startMonitoring() {
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
    getUserInfo() {
        return {
            userId: this.currentUserId,
            isLoggedIn: this.isLoggedIn,
            sessionId: this.sessionId,
            detectionMethod: this.identifiers.detectionMethod,
            detectionTime: this.identifiers.detectionTime,
            isAnonymous: this.currentUserId ? this.currentUserId.startsWith('anon_') : true
        };
    }
    logout() {
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
    setupIdentitySynchronization() {
        if (!this.trackerContext)
            return;
        window.addEventListener('recsys:userLoggedIn', ((event) => {
            const customEvent = event;
            const newUserId = customEvent.detail.userId;
            const source = customEvent.detail.detectionMethod;
            if (newUserId) {
                this.trackerContext.updateIdentity(newUserId);
                console.log(`[Context Sync] User ID synced from IdentityManager (${source}).`);
            }
        }));
    }
}
export function getUserIdentityManager() {
    if (!identityManagerInstance) {
        identityManagerInstance = new UserIdentityManager();
    }
    return identityManagerInstance;
}
//# sourceMappingURL=user-identity-manager.js.map