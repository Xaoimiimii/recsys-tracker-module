import { IPayloadExtractor } from './payload-extractor.interface';
import { PayloadMapping } from '../../../types';

export class StorageExtractor implements IPayloadExtractor {
    extract(mapping: PayloadMapping, _context?: any): string | null {
        try {
            const source = (mapping.source || '').toLowerCase();
            const keyPath = mapping.value;

            if (!keyPath) return null;

            if (source === 'localstorage') {
                return this.extractFromStorage(window.localStorage, keyPath);
            }

            if (source === 'sessionstorage') {
                return this.extractFromStorage(window.sessionStorage, keyPath);
            }

            if (source === 'cookie') {
                return this.extractFromCookie(keyPath);
            }

            return null;
        } catch {
            return null;
        }
    }

    private extractFromStorage(storage: Storage, keyPath: string): string | null {
        if (!storage || !keyPath) return null;
        const cleanKey = keyPath.trim();

        // Split key.path
        const parts = cleanKey.split('.');
        const rootKey = parts[0];

        const rawVal = storage.getItem(rootKey);
        if (!rawVal) return null;

        if (parts.length === 1) return rawVal;

        return this.getNestedValue(rawVal, parts.slice(1).join('.'));
    }

    private extractFromCookie(keyPath: string): string | null {
        if (typeof document === 'undefined' || !document.cookie) return null;

        const parts = keyPath.trim().split('.');
        const cookieName = parts[0];

        const match = document.cookie.match(new RegExp('(^| )' + cookieName + '=([^;]+)'));
        if (!match) return null;

        const cookieVal = decodeURIComponent(match[2]);

        if (parts.length === 1) return cookieVal;

        return this.getNestedValue(cookieVal, parts.slice(1).join('.'));
    }

    private getNestedValue(jsonString: string, path: string): string | null {
        try {
            let obj = JSON.parse(jsonString);
            const keys = path.split('.');
            for (const key of keys) {
                if (obj && typeof obj === 'object' && key in obj) {
                    obj = obj[key];
                } else {
                    return null;
                }
            }
            return (typeof obj === 'object') ? JSON.stringify(obj) : String(obj);
        } catch {
            return null;
        }
    }
}
