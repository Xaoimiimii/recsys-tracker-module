import { fetchRecommendations } from '../api';
import { isPageAllowed } from '../utils'; // Giả sử bạn để hàm check URL ở file utils

// --- STATE MANAGEMENT ---
// Các biến này cần nằm ngoài hàm để giữ trạng thái giữa các lần đóng/mở
let popupTimeout = null;
let currentPlacement = null;
let currentSiteId = null;

const INTERVAL_MIN = 10000; // 10s
const INTERVAL_MAX = 20000; // 20s

/**
 * HÀM KHỞI TẠO (Export ra cho index.js gọi)
 */
export function initPopup(placement, siteId) {
    console.log("[MyRec POPUP] Init logic with Shadow DOM & Scheduler");
    
    // Lưu lại cấu hình để dùng cho việc schedule sau này
    currentPlacement = placement;
    currentSiteId = siteId;

    // Bắt đầu chu trình lập lịch
    scheduleNextPopup();
}

/**
 * 1. Logic Lập lịch (Scheduler)
 * Tự động tính toán thời gian ngẫu nhiên để hiện popup
 */
function scheduleNextPopup() {
    if (popupTimeout) clearTimeout(popupTimeout);

    const delay = getRandomDelay();
    console.log(`[MyRec POPUP] Next popup in ${delay / 1000}s`);

    popupTimeout = setTimeout(() => {
        // Check lại URL trước khi hiện (vì user có thể đã chuyển sang trang không cho phép)
        // placement.pages lấy từ config json của placement
        if (isPageAllowed(window.location.pathname, currentPlacement.pages)) {
            showPopup();
        } else {
            console.log("[MyRec POPUP] Skipped (Page not allowed now)");
            // Vẫn tiếp tục schedule để check lần sau
            scheduleNextPopup(); 
        }
    }, delay);
}

function getRandomDelay() {
    return Math.floor(Math.random() * (INTERVAL_MAX - INTERVAL_MIN) + INTERVAL_MIN);
}

/**
 * 2. Logic Hiển thị (Fetch & Render)
 */
async function showPopup() {
    // Gọi API (Tái sử dụng từ api.js)
    const items = await fetchRecommendations(currentPlacement.slotName, currentSiteId);
    
    if (items && items.length > 0) {
        renderShadowPopup(items);
    }
}

/**
 * 3. Logic CSS (Copy từ file popup-SDK-2.js)
 */
function getPopupCSS() {
    return `
        :host { all: initial; font-family: Arial, sans-serif; }
        * { box-sizing: border-box; }

        .myrec-popup {
            position: fixed; bottom: 24px; right: 24px; width: 340px;
            background: #fff; border-radius: 12px;
            box-shadow: 0 4px 28px rgba(0,0,0,0.25);
            z-index: 2147483647; overflow: hidden;
            animation: myrec-fadein 0.3s ease;
            display: flex; flex-direction: column;
            border: 1px solid #e0e0e0;
        }
        @keyframes myrec-fadein { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: translateY(0);} }

        .myrec-header {
            background: #111; color: #fff; padding: 12px 14px;
            font-size: 15px; font-weight: bold;
            display: flex; justify-content: space-between; align-items: center;
        }
        .myrec-close { 
            cursor: pointer; font-size: 18px; line-height: 1; 
            opacity: 0.8; background: none; border: none; color: white; 
        }
        .myrec-close:hover { opacity: 1; }

        .myrec-body { position: relative; height: 220px; background: #fff; }
        
        .myrec-nav {
            position: absolute; top: 50%; transform: translateY(-50%);
            font-size: 20px; background: rgba(255,255,255,0.8); border: 1px solid #ddd;
            cursor: pointer; width: 30px; height: 30px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            z-index: 2; transition: all 0.2s; color: #333;
        }
        .myrec-nav:hover { background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .myrec-prev { left: 10px; }
        .myrec-next { right: 10px; }

        .myrec-slide { text-align: center; padding: 15px; height: 100%; display: flex; align-items: center; justify-content: center; }
        
        .myrec-item {
            display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; text-decoration: none; color: inherit;
        }
        .myrec-item img { width: 180px; height: 130px; border-radius: 8px; object-fit: cover; }
        .myrec-name { font-size: 16px; font-weight: 600; margin: 5px 0 0; color: #333; }
        .myrec-price { font-size: 14px; color: #d10000; font-weight: bold; }
    `;
}

/**
 * 4. Logic Render với SHADOW DOM & SLIDER
 */
function renderShadowPopup(items) {
    // Xóa popup cũ nếu còn tồn tại
    const oldHost = document.getElementById("myrec-popup-host");
    if (oldHost) oldHost.remove();

    // Tạo Host
    const host = document.createElement("div");
    host.id = "myrec-popup-host";
    document.body.appendChild(host);

    // Attach Shadow
    const shadow = host.attachShadow({ mode: 'open' });

    // Inject CSS
    const style = document.createElement("style");
    style.textContent = getPopupCSS();
    shadow.appendChild(style);

    // Create Wrapper HTML
    const wrapper = document.createElement("div");
    wrapper.className = "myrec-popup";
    wrapper.innerHTML = `
        <div class="myrec-header">
            Gợi ý dành cho bạn
            <button class="myrec-close">&#10005;</button>
        </div>
        <div class="myrec-body">
            <button class="myrec-nav myrec-prev">◀</button>
            <div class="myrec-slide"></div>
            <button class="myrec-nav myrec-next">▶</button>
        </div>
    `;
    shadow.appendChild(wrapper);

    // --- SLIDER LOGIC ---
    let currentIndex = 0;
    let autoSlideTimer = null;
    const AUTO_SLIDE_DELAY = 5000;

    const slideBox = wrapper.querySelector(".myrec-slide");

    function renderSlide() {
        const item = items[currentIndex];
        // Xử lý fallback nếu API trả về các tên trường khác nhau
        const name = item.name || item.title;
        const img = item.img || item.image;
        
        slideBox.innerHTML = `
            <div class="myrec-item" data-id="${item.id}">
                <img src="${img}" alt="${name}" />
                <div class="myrec-name">${name}</div>
                <div class="myrec-price">${item.price}</div>
            </div>
        `;
    }

    function nextSlide() {
        currentIndex = (currentIndex + 1) % items.length;
        renderSlide();
        resetAutoSlide();
    }

    function prevSlide() {
        currentIndex = (currentIndex - 1 + items.length) % items.length;
        renderSlide();
        resetAutoSlide();
    }

    function resetAutoSlide() {
        if (autoSlideTimer) clearTimeout(autoSlideTimer);
        autoSlideTimer = setTimeout(nextSlide, AUTO_SLIDE_DELAY);
    }

    // --- EVENT LISTENERS ---
    
    // 1. Navigation
    wrapper.querySelector(".myrec-prev").onclick = prevSlide;
    wrapper.querySelector(".myrec-next").onclick = nextSlide;

    // 2. Close Button -> Trigger Scheduler
    wrapper.querySelector(".myrec-close").onclick = () => {
        host.remove(); // Xóa khỏi DOM
        if (autoSlideTimer) clearTimeout(autoSlideTimer);
        
        // QUAN TRỌNG: Gọi lại lập lịch để hiện lại sau 10-20s
        scheduleNextPopup();
    };

    // 3. Tracking Click
    slideBox.onclick = (e) => {
        const productEl = e.target.closest('.myrec-item');
        if (productEl) {
            const id = productEl.getAttribute('data-id');
            console.log("[MyRec POPUP] TRACKING CLICK:", id);
            // TODO: Call API tracking
        }
    };

    // Start
    renderSlide();
    resetAutoSlide();
}