import { fetchRecommendations } from '../api';

/**
 * HÀM KHỞI TẠO (Export cho index.js)
 * placement: { selector: "...", slotName: "...", ... }
 */
export function initInline(placement, siteId) {
    const selector = placement.selector;
    console.log(`[MyRec INLINE] Initializing watcher for: "${selector}" (Slot: ${placement.slotName})`);

    // --- 1. HÀM XỬ LÝ RENDER CHO 1 CONTAINER ---
    const processContainer = async (container) => {
        // Kiểm tra an toàn:
        // 1. Nếu container null -> Bỏ qua
        // 2. Nếu đã render rồi (có attribute data-myrec-loaded) -> Bỏ qua
        if (!container || container.getAttribute('data-myrec-loaded') === 'true') {
            return;
        }

        // Đánh dấu là đã xử lý để không bị render lặp lại
        container.setAttribute('data-myrec-loaded', 'true');

        // Gọi API lấy dữ liệu
        const items = await fetchRecommendations(placement.slotName, siteId);
        
        if (items && items.length > 0) {
            renderShadowWidget(container, items);
        } else {
            console.log(`[MyRec INLINE] No items for ${selector}`);
        }
    };

    // --- 2. QUÉT LẦN ĐẦU (Initial Scan) ---
    // Dành cho các div đã có sẵn trong HTML tĩnh
    const existingContainers = document.querySelectorAll(selector);
    existingContainers.forEach(el => processContainer(el));

    // --- 3. QUÉT LIÊN TỤC (MutationObserver) ---
    // Dành cho các div xuất hiện muộn (React/Vue/Lazy Load)
    
    let debounceTimer = null;

    const observer = new MutationObserver((mutations) => {
        // Kỹ thuật Debounce: Chờ 100ms sau khi DOM ngừng thay đổi mới chạy lệnh tìm kiếm
        // Giúp tiết kiệm tài nguyên CPU
        if (debounceTimer) clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
            const containers = document.querySelectorAll(selector);
            containers.forEach(el => processContainer(el));
        }, 100);
    });

    // Bắt đầu theo dõi toàn bộ body
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

/**
 * HÀM VẼ GIAO DIỆN (Shadow DOM)
 */
function renderShadowWidget(container, items) {
    try {
        // 1. Setup Shadow DOM (An toàn)
        let shadow = container.shadowRoot;
        if (!shadow) {
            shadow = container.attachShadow({ mode: "open" });
        }

        // Reset nội dung cũ nếu có (để render lại sạch sẽ)
        shadow.innerHTML = "";

        // 2. Inject CSS (Responsive Grid)
        const style = document.createElement("style");
        style.textContent = getWidgetCSS();
        shadow.appendChild(style);

        // 3. Create Wrapper
        const wrapper = document.createElement("div");
        wrapper.className = "rec-wrapper";

        // 4. Create Items
        items.forEach(item => {
            // Fallback tên trường dữ liệu
            const name = item.name || item.title;
            const img = item.img || item.image;

            const itemEl = document.createElement("div");
            itemEl.className = "rec-item";
            itemEl.setAttribute("data-id", item.id); // Để tracking
            
            itemEl.innerHTML = `
                <div class="rec-img-box">
                    <img src="${img}" alt="${name}">
                </div>
                <div class="rec-info">
                    <div class="rec-title">${name}</div>
                    <div class="rec-price">${item.price}</div>
                </div>
            `;
            wrapper.appendChild(itemEl);
        });

        shadow.appendChild(wrapper);

        // 5. Tracking Event (Event Delegation)
        wrapper.addEventListener('click', (e) => {
            const clickedItem = e.target.closest('.rec-item');
            if (clickedItem) {
                const id = clickedItem.getAttribute('data-id');
                console.log("[MyRec INLINE] TRACKING CLICK:", id);
                // TODO: Call API tracking
            }
        });

    } catch (err) {
        console.error("[MyRec INLINE] Error rendering shadow DOM:", err);
    }
}

/**
 * CSS CHO WIDGET
 * Sử dụng Grid để tự động co giãn theo chiều rộng của container cha
 */
function getWidgetCSS() {
    return `
        :host { 
            display: block; 
            all: initial; 
            font-family: Arial, sans-serif; 
            width: 100%;
        }
        * { box-sizing: border-box; }

        .rec-wrapper {
            display: grid;
            /* Tự động chia cột: nhỏ nhất 140px, còn lại tự giãn đều */
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 16px;
            padding: 10px 0;
        }

        .rec-item {
            border: 1px solid #eee;
            border-radius: 8px;
            overflow: hidden;
            background: #fff;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            display: flex;
            flex-direction: column;
        }
        .rec-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        .rec-img-box {
            width: 100%;
            padding-top: 100%; /* Tạo khung vuông tỷ lệ 1:1 */
            position: relative;
            background: #f9f9f9;
        }
        .rec-img-box img {
            position: absolute; top: 0; left: 0;
            width: 100%; height: 100%; object-fit: cover;
        }

        .rec-info { padding: 10px; flex-grow: 1; display: flex; flex-direction: column; }
        
        .rec-title {
            font-size: 14px; font-weight: 600; color: #333; margin-bottom: 4px;
            /* Cắt chữ nếu dài quá 2 dòng */
            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        
        .rec-price {
            font-size: 14px; color: #d0021b; font-weight: bold; margin-top: auto;
        }
    `;
}