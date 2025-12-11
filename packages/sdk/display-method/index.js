import { initPopup } from './modes/popup';
import { initInline } from './modes/inline';
import { fetchRecommendations } from './api';
import { isPageAllowed } from './utils';

(function () {
    console.log("[MyRecSDK] Booting up...");

    // ---------------------------------------------------------
    // 1. TỔNG HỢP CẤU HÌNH (CONFIG PARSER)
    // ---------------------------------------------------------
    const globalConfig = window.RecSysConfig || {};
    const script = document.currentScript;

    // Lấy Site ID (Ưu tiên config global -> attribute thẻ script)
    const siteId = globalConfig.storeId || script?.getAttribute("data-site-id");

    if (!siteId) {
        console.error("[MyRecSDK] Error: Missing 'storeId'. SDK stopped.");
        return;
    }

    // Lấy danh sách vị trí hiển thị (Placements)
    // Nếu khách dùng cách đơn giản (data-attributes), ta tự tạo ra 1 placement giả
    let placements = globalConfig.placements || [];

    if (placements.length === 0 && script) {
        // Fallback: Hỗ trợ khách hàng cũ dùng thẻ script đơn giản
        // <script data-mode="popup" ...>
        const simpleMode = script.getAttribute("data-mode") || "popup";
        const simpleSelector = script.getAttribute("data-target-selector");
        
        placements.push({
            mode: simpleMode,
            slotName: "default-slot",
            selector: simpleSelector,
            pages: ["*"] // Mặc định hiện tất cả trang
        });
    }

    console.log(`[MyRecSDK] Running for Store: ${siteId} with ${placements.length} placements.`);

    // ---------------------------------------------------------
    // 2. BỘ ĐIỀU HƯỚNG (ROUTER)
    // ---------------------------------------------------------
    placements.forEach(placement => {
        // A. Kiểm tra trang cho phép (Page Targeting)
        // Nếu trang hiện tại không nằm trong danh sách 'pages' -> Bỏ qua
        if (!isPageAllowed(window.location.pathname, placement.pages)) {
            return;
        }

        // B. Kích hoạt Mode tương ứng
        switch (placement.mode) {
            case 'popup':
                // Xử lý Popup
                initPopup(placement, siteId);
                break;

            case 'custom_widget':
                // Xử lý Custom Widget (Khách tự đặt div)
                // Nếu khách không cấu hình selector, dùng mặc định
                placement.selector = placement.selector || '.myrec-widget'; 
                initInline(placement, siteId);
                break;

            case 'inline':
                // Xử lý Inline Injection (Tự chèn vào ID có sẵn)
                if (placement.selector) {
                    initInline(placement, siteId);
                } else {
                    console.warn("[MyRecSDK] Inline mode requires a 'selector'.", placement);
                }
                break;
            
            case 'callback':
                // Chế độ Callback thì không làm gì cả, 
                // chờ khách hàng tự gọi hàm window.MyRecSDK.recommend()
                break;

            default:
                console.warn("[MyRecSDK] Unknown mode:", placement.mode);
        }
    });

    // ---------------------------------------------------------
    // 3. PUBLIC API (SDK Callback Mode)
    // ---------------------------------------------------------
    // Hỗ trợ khách hàng gọi thủ công như mô tả trong
    window.MyRecSDK = {
        /**
         * Hàm lấy dữ liệu thủ công
         * @param {Object} options { slot: "HOME", onResult: function(items){} }
         */
        recommend: async function(options) {
            if (!options || !options.slot) {
                console.error("[MyRecSDK] .recommend() requires 'slot' param.");
                return;
            }

            try {
                const items = await fetchRecommendations(options.slot, siteId);
                
                // Trả về qua callback
                if (options.onResult && typeof options.onResult === 'function') {
                    options.onResult(items);
                }
            } catch (err) {
                console.error("[MyRecSDK] recommend error:", err);
            }
        },

        // Expose thêm hàm này nếu khách hàng dùng React/SPA 
        // và muốn scan lại Widget sau khi chuyển trang
        scanWidgets: function() {
            // Logic này có thể gọi lại initInline cho các placement kiểu widget
            console.log("Re-scanning widgets...");
            placements.forEach(p => {
                if (p.mode === 'custom_widget' || p.mode === 'inline') {
                     // Lưu ý: initInline cần được thiết kế để gọi nhiều lần an toàn
                     // (File inline.js mình đưa trước đó đã an toàn nhờ check data-loaded)
                     import('./modes/inline').then(m => m.initInline(p, siteId));
                }
            });
        }
    };

})();