export function isPageAllowed(currentPath, allowedPatterns) {
    if (!allowedPatterns || allowedPatterns.length === 0 || allowedPatterns.includes('*')) return true;
    
    return allowedPatterns.some(pattern => {
        if (pattern === '/') return currentPath === '/';
        // Hỗ trợ wildcard đơn giản (vd: /products/*)
        if (pattern.endsWith('/*')) {
            const base = pattern.slice(0, -2);
            return currentPath.startsWith(base);
        }
        return currentPath === pattern;
    });
}