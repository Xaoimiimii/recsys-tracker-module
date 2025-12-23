let aiItemDetectorInstance = null;
export class AIItemDetector {
    constructor() {
        this.itemCache = new Map();
        this.domObserver = null;
        if (aiItemDetectorInstance) {
            return aiItemDetectorInstance;
        }
        this.init();
        aiItemDetectorInstance = this;
    }
    init() {
        console.log('[Recsys AI] 🤖 AI Item Detector initialized');
        this.setupDOMMutationObserver();
    }
    detectItemFromClick(event) {
        const element = event.target;
        console.log('[Recsys AI] 🔍 Analyzing clicked element...');
        const domItem = this.detectItemFromDOM(element);
        if (domItem)
            return domItem;
        const textItem = this.detectItemFromText(element);
        if (textItem)
            return textItem;
        const mediaItem = this.detectItemFromMedia(element);
        if (mediaItem)
            return mediaItem;
        const structuredItem = this.detectItemFromStructuredData(element);
        if (structuredItem)
            return structuredItem;
        return this.detectItemFromPosition(element);
    }
    detectItemFromDOM(element) {
        console.log('[Recsys AI] 🔍 Analyzing DOM context (Self/Parent Check)...');
        let current = element;
        for (let i = 0; i < 5; i++) {
            if (!current)
                break;
            const itemData = this.extractItemDataFromElement(current);
            if (itemData) {
                return itemData;
            }
            current = current.parentElement;
        }
        return null;
    }
    detectItemFromChildren(parentElement) {
        var _a;
        console.log('[Recsys AI] 🔍 Analyzing Item Card Children...');
        const itemSelectors = ['[data-item-id]', '[data-id]',
            '[data-song-id]', '[data-track-id]', '[data-video-id]',
            '[data-product-id]', '[data-sku]', '[data-listing-id]',
            '[data-article-id]', '[data-post-id]', '[data-thread-id]',
            '[data-user-id]', '[data-author-id]',
            '[data-content-id]'
        ];
        for (const selector of itemSelectors) {
            const childElement = parentElement.querySelector(selector);
            if (childElement) {
                const itemData = this.extractItemDataFromElement(childElement);
                if (itemData) {
                    console.log('[Recsys AI] ✅ Found item in Child Element via Data Attribute:', itemData);
                    return itemData;
                }
            }
        }
        const prominentChildren = parentElement.querySelectorAll('a, button, [role="link"], [role="button"]');
        for (const child of Array.from(prominentChildren)) {
            const itemData = this.extractItemDataFromElement(child);
            if (itemData) {
                console.log('[Recsys AI] ✅ Found item in Prominent Child Element:', itemData);
                return itemData;
            }
        }
        const titleElement = parentElement.querySelector('h1, h2, h3, h4, [data-title]');
        const title = (_a = titleElement === null || titleElement === void 0 ? void 0 : titleElement.textContent) === null || _a === void 0 ? void 0 : _a.trim();
        if (title) {
            console.log('[Recsys AI] 💡 Detected item via Title Fallback:', title);
            return {
                id: this.generateHashId(title),
                name: title,
                type: 'content',
                confidence: 0.6,
                source: 'title_fallback'
            };
        }
        return null;
    }
    detectItemFromText(element) {
        console.log('[Recsys AI] 🔍 Analyzing text content...');
        const textContext = this.getTextContext(element, 2);
        if (!textContext)
            return null;
        const patterns = {
            song: [
                /(["'])(.+?)\1\s*(?:-|-|by)\s*(.+)/i,
                /(.+?)\s*(?:-|-)\s*(.+)/i,
                /Track\s*\d+[:\s]*(.+)/i,
                /(.+?)\s*\(feat\.\s*(.+)\)/i,
            ],
            album: [
                /Album[:\s]*(.+)/i,
                /(.+?)\s*(?:album|LP|EP)/i,
            ],
            artist: [
                /Artist[:\s]*(.+)/i,
                /by\s*(.+)/i,
            ],
            product: [
                /(Mã|SKU|Code|Item)\s*[:#]\s*([A-Z0-9-]+)/i,
                /(Product|Sản phẩm)\s*[:\s]*(.+)/i,
            ],
            article: [
                /(Bài viết|Post|News)\s*[:\s]*(.+)/i,
                /Published\s*(?:by|on)\s*(.+)/i,
            ],
        };
        for (const [type, typePatterns] of Object.entries(patterns)) {
            for (const pattern of typePatterns) {
                const match = textContext.match(pattern);
                if (match) {
                    const itemName = (match[2] || match[1] || '').trim();
                    if (!itemName)
                        continue;
                    const idValue = (type === 'product' && itemName.length < 50) ? itemName : this.generateHashId(itemName);
                    console.log(`[Recsys AI] ✅ Detected ${type}: ${itemName}`);
                    return {
                        id: idValue,
                        name: itemName,
                        type: type,
                        confidence: 0.7,
                        source: 'text_pattern',
                        context: textContext.substring(0, 100)
                    };
                }
            }
        }
        const keywords = {
            song: ['play', 'listen', 'track', 'song', 'music', 'audio'],
            video: ['watch', 'view', 'video', 'movie', 'film', 'trailer'],
            product: ['buy', 'purchase', 'shop', 'product', 'item', 'add to cart', 'giá', 'mua hàng', 'price'],
            article: ['read more', 'continue reading', 'bài viết', 'tin tức', 'blog post', 'tác giả'],
            user: ['follow', 'profile', 'người dùng', 'tài khoản', 'friend'],
            comment: ['like', 'share', 'comment', 'bình luận'],
        };
        const lowerText = textContext.toLowerCase();
        for (const [type, words] of Object.entries(keywords)) {
            if (words.some(word => lowerText.includes(word))) {
                const words = textContext.split(/\s+/).slice(0, 5).join(' ');
                if (words.length > 3) {
                    return {
                        id: this.generateHashId(words),
                        name: words,
                        type: type,
                        confidence: 0.5,
                        source: 'keyword_match',
                        context: textContext.substring(0, 100)
                    };
                }
            }
        }
        return null;
    }
    detectItemFromLimitedText(element) {
        const textContext = this.getTextContext(element, 1);
        if (!textContext)
            return null;
        const MAX_CONTEXT_LENGTH = 120;
        if (textContext.length > MAX_CONTEXT_LENGTH) {
            console.log('[Recsys AI] Text fallback ignored: Context too long (>' + MAX_CONTEXT_LENGTH + ').');
            return null;
        }
        const patterns = {
            song: [
                /(["'])(.+?)\1\s*(?:-|-|by)\s*(.+)/i,
                /(.+?)\s*(?:-|-)\s*(.+)/i,
                /Track\s*\d+[:\s]*(.+)/i,
                /(.+?)\s*\(feat\.\s*(.+)\)/i,
            ],
            product: [
                /(Mã|SKU|Code|Item)\s*[:#]\s*([A-Z0-9-]+)/i,
                /(Product|Sản phẩm)\s*[:\s]*(.+)/i,
            ],
            article: [
                /(Bài viết|Post|News)\s*[:\s]*(.+)/i,
                /Published\s*(?:by|on)\s*(.+)/i,
            ],
            album: [
                /Album[:\s]*(.+)/i,
                /(.+?)\s*(?:album|LP|EP)/i,
            ],
            artist: [
                /Artist[:\s]*(.+)/i,
                /by\s*(.+)/i,
            ]
        };
        for (const [type, typePatterns] of Object.entries(patterns)) {
            for (const pattern of typePatterns) {
                const match = textContext.match(pattern);
                if (match) {
                    const itemName = (match[2] || match[1] || '').trim();
                    if (!itemName)
                        continue;
                    const idValue = (type === 'product' && itemName.length < 50) ? itemName : this.generateHashId(itemName);
                    return {
                        id: idValue,
                        name: itemName,
                        type: type,
                        confidence: 0.5,
                        source: 'text_pattern_limited',
                        context: textContext
                    };
                }
            }
        }
        const keywords = {
            song: ['play', 'listen', 'track', 'song', 'music', 'audio'],
            video: ['watch', 'view', 'video', 'movie', 'film', 'trailer'],
            product: ['buy', 'purchase', 'shop', 'product', 'item', 'add to cart', 'giá', 'mua hàng', 'price'],
            article: ['read more', 'continue reading', 'bài viết', 'tin tức', 'blog post', 'tác giả'],
            user: ['follow', 'profile', 'người dùng', 'tài khoản', 'friend'],
            comment: ['like', 'share', 'comment', 'bình luận'],
        };
        const lowerText = textContext.toLowerCase();
        for (const [type, words] of Object.entries(keywords)) {
            if (words.some(word => lowerText.includes(word))) {
                const words = textContext.split(/\s+/).slice(0, 5).join(' ');
                if (words.length > 3) {
                    return {
                        id: this.generateHashId(words),
                        name: words,
                        type: type,
                        confidence: 0.3,
                        source: 'keyword_match_limited',
                        context: textContext
                    };
                }
            }
        }
        return null;
    }
    detectItemFromMedia(element) {
        const mediaElement = this.findNearbyMedia(element);
        if (!mediaElement)
            return null;
        const castedMedia = mediaElement;
        let mediaData = {
            type: mediaElement.tagName.toLowerCase(),
            src: castedMedia.src || castedMedia.currentSrc || '',
            alt: castedMedia.alt || castedMedia.getAttribute('alt') || '',
            title: castedMedia.title || castedMedia.getAttribute('title') || ''
        };
        if (mediaElement.tagName === 'IMG') {
            const imageInfo = this.analyzeImage(mediaElement);
            if (imageInfo) {
                return {
                    id: this.generateHashId(mediaData.src + mediaData.alt),
                    name: imageInfo.name || mediaData.alt || this.extractNameFromSrc(mediaData.src),
                    type: 'media',
                    confidence: 0.6,
                    source: 'image_analysis',
                    metadata: { ...mediaData, ...imageInfo }
                };
            }
        }
        if (mediaElement.tagName === 'VIDEO') {
            const videoInfo = this.analyzeVideo(mediaElement);
            if (videoInfo) {
                return {
                    id: this.generateHashId(mediaData.src + Date.now()),
                    name: videoInfo.title || 'Video Content',
                    type: 'video',
                    confidence: 0.6,
                    source: 'video_analysis',
                    metadata: { ...mediaData, ...videoInfo }
                };
            }
        }
        return null;
    }
    detectItemFromStructuredData(element) {
        const microdata = this.extractMicrodata(element);
        if (microdata)
            return microdata;
        const jsonLdData = this.extractJsonLdData();
        if (jsonLdData) {
            const matchingItem = this.findMatchingItemInJsonLd(jsonLdData, element);
            if (matchingItem)
                return matchingItem;
        }
        const ogData = this.extractOpenGraphData();
        if (ogData) {
            return {
                id: this.generateHashId(ogData.title),
                name: ogData.title,
                type: ogData.type || 'content',
                confidence: 0.8,
                source: 'open_graph',
                metadata: ogData
            };
        }
        return null;
    }
    detectItemFromPosition(element) {
        var _a;
        const rect = element.getBoundingClientRect();
        const position = {
            x: Math.round(rect.left + window.scrollX),
            y: Math.round(rect.top + window.scrollY),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        };
        const positionId = `${position.x}_${position.y}_${position.width}_${position.height}`;
        const contentHash = this.hashString(element.textContent || '');
        return {
            id: `pos_${positionId}_${contentHash}`,
            name: this.extractNameFromPosition(element),
            type: 'ui_element',
            confidence: 0.3,
            source: 'position_based',
            metadata: {
                position: position,
                elementType: element.tagName.toLowerCase(),
                textPreview: ((_a = element.textContent) === null || _a === void 0 ? void 0 : _a.substring(0, 50)) || ''
            }
        };
    }
    extractItemDataFromElement(element) {
        var _a;
        const dataAttrs = ['data-item-id', 'data-id',
            'data-song-id', 'data-track-id', 'data-video-id',
            'data-product-id', 'data-sku', 'data-listing-id',
            'data-article-id', 'data-post-id', 'data-thread-id',
            'data-user-id', 'data-author-id',
            'data-content-id'
        ];
        const htmlElement = element;
        for (const attr of dataAttrs) {
            const value = element.getAttribute(attr);
            if (value) {
                const itemTitle = htmlElement.title || htmlElement.getAttribute('title');
                const itemAlt = htmlElement.getAttribute('alt');
                return {
                    id: value,
                    name: element.getAttribute('data-item-name') ||
                        element.getAttribute('data-name') ||
                        itemTitle ||
                        itemAlt ||
                        'Unnamed Item',
                    type: this.inferTypeFromAttribute(attr),
                    confidence: 0.9,
                    source: 'data_attribute',
                    metadata: { attribute: attr }
                };
            }
        }
        if (element.tagName === 'ARTICLE' || element.getAttribute('role') === 'article') {
            const title = element.querySelector('h1, h2, h3, [role="heading"]');
            if (title) {
                return {
                    id: this.generateHashId(title.textContent + element.innerHTML.length),
                    name: (_a = title.textContent) === null || _a === void 0 ? void 0 : _a.trim(),
                    type: 'article',
                    confidence: 0.7,
                    source: 'semantic_html'
                };
            }
        }
        return null;
    }
    getTextContext(element, depth = 2) {
        var _a, _b, _c;
        let context = '';
        let current = element;
        for (let i = 0; i <= depth; i++) {
            if (!current)
                break;
            const text = (_a = current.textContent) === null || _a === void 0 ? void 0 : _a.trim();
            if (text && text.length > 0 && text.length < 500) {
                context += text + ' ';
            }
            if (current.previousElementSibling) {
                const prevText = (_b = current.previousElementSibling.textContent) === null || _b === void 0 ? void 0 : _b.trim();
                if (prevText && prevText.length < 200) {
                    context = prevText + ' ' + context;
                }
            }
            if (current.nextElementSibling) {
                const nextText = (_c = current.nextElementSibling.textContent) === null || _c === void 0 ? void 0 : _c.trim();
                if (nextText && nextText.length < 200) {
                    context += ' ' + nextText;
                }
            }
            current = current.parentElement;
        }
        return context.trim() || null;
    }
    findNearbyMedia(element, maxDistance = 3) {
        if (element.tagName === 'IMG' || element.tagName === 'VIDEO' ||
            element.tagName === 'AUDIO' || element.tagName === 'FIGURE') {
            return element;
        }
        const mediaChild = element.querySelector('img, video, audio, figure, [data-media]');
        if (mediaChild)
            return mediaChild;
        let current = element;
        for (let i = 0; i < maxDistance; i++) {
            if (!current)
                break;
            if (current.parentElement) {
                const parentMedia = current.parentElement.querySelector('img, video, audio');
                if (parentMedia)
                    return parentMedia;
            }
            const siblings = [];
            if (current.previousElementSibling)
                siblings.push(current.previousElementSibling);
            if (current.nextElementSibling)
                siblings.push(current.nextElementSibling);
            for (const sibling of siblings) {
                const siblingMedia = sibling.querySelector('img, video, audio');
                if (siblingMedia)
                    return siblingMedia;
            }
            current = current.parentElement;
        }
        return null;
    }
    analyzeImage(imgElement) {
        const src = imgElement.src || '';
        const alt = imgElement.alt || '';
        let name = alt;
        if (!name && src) {
            name = this.extractNameFromSrc(src);
        }
        let type = 'image';
        const patterns = [
            /(album|cover|artwork).*\.(jpg|jpeg|png|gif)/i,
            /(song|track|music).*\.(jpg|jpeg|png|gif)/i,
            /(artist|band).*\.(jpg|jpeg|png|gif)/i,
            /(thumbnail|thumb).*\.(jpg|jpeg|png|gif)/i,
        ];
        for (const pattern of patterns) {
            if (pattern.test(src) || pattern.test(alt)) {
                if (pattern.toString().includes('album'))
                    type = 'album_art';
                if (pattern.toString().includes('song'))
                    type = 'song_image';
                if (pattern.toString().includes('artist'))
                    type = 'artist_image';
                break;
            }
        }
        return {
            name: name,
            type: type,
            dimensions: {
                naturalWidth: imgElement.naturalWidth,
                naturalHeight: imgElement.naturalHeight,
                clientWidth: imgElement.clientWidth,
                clientHeight: imgElement.clientHeight
            }
        };
    }
    analyzeVideo(videoElement) {
        const src = videoElement.src || videoElement.currentSrc || '';
        const duration = videoElement.duration || 0;
        return {
            title: videoElement.getAttribute('data-title') ||
                videoElement.title ||
                this.extractNameFromSrc(src),
            duration: duration,
            isPlaying: !videoElement.paused,
            currentTime: videoElement.currentTime || 0
        };
    }
    extractNameFromSrc(src) {
        var _a;
        if (!src)
            return '';
        const filename = ((_a = src.split('/').pop()) === null || _a === void 0 ? void 0 : _a.split('?')[0]) || '';
        const name = filename.replace(/\.[^/.]+$/, '');
        let cleanName = name.replace(/[-_]/g, ' ');
        try {
            cleanName = decodeURIComponent(cleanName);
        }
        catch (e) {
            // Ignore
        }
        return cleanName;
    }
    extractMicrodata(element) {
        const itemprops = element.querySelectorAll('[itemprop]');
        if (itemprops.length === 0)
            return null;
        const data = {};
        Array.from(itemprops).forEach(el => {
            var _a;
            const prop = el.getAttribute('itemprop');
            const value = el.getAttribute('content') ||
                el.getAttribute('src') ||
                ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim());
            if (prop && value) {
                data[prop] = value;
            }
        });
        if (Object.keys(data).length > 0) {
            return {
                id: data.url || data.identifier || this.generateHashId(JSON.stringify(data)),
                name: data.name || data.title || 'Microdata Item',
                type: data['@type'] || 'Thing',
                confidence: 0.85,
                source: 'microdata',
                metadata: data
            };
        }
        return null;
    }
    extractJsonLdData() {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        const allData = [];
        Array.from(scripts).forEach(script => {
            try {
                const data = JSON.parse(script.textContent || '{}');
                if (Array.isArray(data)) {
                    allData.push(...data);
                }
                else {
                    allData.push(data);
                }
            }
            catch (e) {
                console.error('[Recsys AI] Failed to parse JSON-LD:', e);
            }
        });
        return allData.length > 0 ? allData : null;
    }
    findMatchingItemInJsonLd(jsonLdData, element) {
        var _a;
        const elementText = (_a = element.textContent) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase();
        if (!elementText)
            return null;
        for (const item of jsonLdData) {
            if (item.name && item.name.toLowerCase().includes(elementText.substring(0, 20))) {
                return {
                    id: item['@id'] || item.identifier || this.generateHashId(item.name),
                    name: item.name,
                    type: item['@type'] || 'CreativeWork',
                    confidence: 0.9,
                    source: 'json_ld',
                    metadata: item
                };
            }
        }
        return null;
    }
    extractOpenGraphData() {
        const metaTags = document.querySelectorAll('meta[property^="og:"]');
        const data = {};
        Array.from(metaTags).forEach(tag => {
            var _a;
            const property = (_a = tag.getAttribute('property')) === null || _a === void 0 ? void 0 : _a.replace('og:', '');
            const content = tag.getAttribute('content');
            if (property && content) {
                data[property] = content;
            }
        });
        return Object.keys(data).length > 0 ? data : null;
    }
    extractNameFromPosition(element) {
        var _a, _b;
        const text = (_a = element.textContent) === null || _a === void 0 ? void 0 : _a.trim();
        if (text && text.length > 0 && text.length < 100) {
            return text;
        }
        const htmlElement = element;
        const heading = htmlElement.closest('h1, h2, h3, h4, h5, h6, [role="heading"]');
        if (heading)
            return ((_b = heading.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || 'UI Element';
        const label = element.getAttribute('aria-label') ||
            element.getAttribute('title') ||
            element.getAttribute('alt');
        if (label)
            return label;
        return `Element at (${htmlElement.offsetLeft}, ${htmlElement.offsetTop})`;
    }
    inferTypeFromAttribute(attr) {
        if (attr.includes('song') || attr.includes('track'))
            return 'song';
        if (attr.includes('video'))
            return 'video';
        if (attr.includes('product') || attr.includes('sku') || attr.includes('listing'))
            return 'product';
        if (attr.includes('article') || attr.includes('post') || attr.includes('thread'))
            return 'article';
        if (attr.includes('user') || attr.includes('author'))
            return 'user';
        if (attr.includes('content'))
            return 'content';
        return 'item';
    }
    generateHashId(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }
    setupDOMMutationObserver() {
        this.domObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    this.scanNewContent(Array.from(mutation.addedNodes));
                }
            });
        });
        this.domObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    scanNewContent(nodes) {
        nodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node;
                const items = element.querySelectorAll('[data-item-id], [data-song-id], [data-track-id]');
                items.forEach(item => {
                    const itemData = this.extractItemDataFromElement(item);
                    if (itemData) {
                        this.itemCache.set(itemData.id, itemData);
                    }
                });
            }
        });
    }
    detectItem(eventOrElement) {
        if (!eventOrElement)
            return null;
        if (eventOrElement instanceof Event) {
            return this.detectItemFromClick(eventOrElement);
        }
        else if (eventOrElement instanceof Element) {
            let itemData = this.extractItemDataFromElement(eventOrElement);
            if (itemData)
                return itemData;
            itemData = this.detectItemFromChildren(eventOrElement);
            if (itemData)
                return itemData;
            console.log('[Recsys AI] ⚠️ Failed to find Item ID in DOM/Children. Falling back.');
            let fallbackItemData = this.detectItemFromLimitedText(eventOrElement) ||
                this.detectItemFromPosition(eventOrElement);
            if (fallbackItemData) {
                fallbackItemData.source = 'fallback_' + fallbackItemData.source;
            }
            return fallbackItemData;
        }
        return null;
    }
}
export function getAIItemDetector() {
    if (!aiItemDetectorInstance) {
        aiItemDetectorInstance = new AIItemDetector();
    }
    return aiItemDetectorInstance;
}
//# sourceMappingURL=ai-item-detector.js.map