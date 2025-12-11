(function () {
    //------------------------------------------------------
    // 1. Cấu hình & Helper
    //------------------------------------------------------
    const currentScript = document.currentScript;
    const siteId = currentScript?.getAttribute("data-site-id");
    const enablePopup = currentScript?.getAttribute("data-popup") === "true";
    const allowedPagesAttr = currentScript?.getAttribute("data-allowed-pages");
    
    let allowedPages = [];
    let popupTimeout = null;
    let popupIntervalMin = 10000;
    let popupIntervalMax = 20000;

    try {
        allowedPages = allowedPagesAttr ? JSON.parse(allowedPagesAttr) : [];
    } catch (e) {
        console.error("[MyRecSDK] allowed-pages must be JSON array");
    }

    function isAllowedPage() {
        if (!allowedPages || allowedPages.length === 0) return true;
        const currentPath = window.location.pathname;
        return allowedPages.some(page => {
            if (!page || page.trim() === "") return false;
            if (page.trim() === "/") return currentPath === "/";
            return currentPath.startsWith(page);
        });
    }

    function getRandomDelay() {
        return Math.floor(Math.random() * (popupIntervalMax - popupIntervalMin) + popupIntervalMin);
    }

    function scheduleNextPopup() {
        if (popupTimeout) clearTimeout(popupTimeout);
        popupTimeout = setTimeout(() => {
            if (isAllowedPage()) {
                window.MyRecommendSDK.showPopup();
            } else {
                console.log("[MyRecSDK] Popup skipped (not in allowedPages)");
            }
        }, getRandomDelay());
    }

    if (!siteId) {
        console.error("[MyRecSDK] Missing data-site-id in script tag.");
        return;
    }

    //------------------------------------------------------
    // 2. MOCK API
    //------------------------------------------------------
    async function fetchRecommendations() {
        // Giả lập delay mạng
        await new Promise(r => setTimeout(r, 500));
        return [
            { id: 1, name: "Áo Thun Nam Đơn Giản", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQflPrgv4PvP55D0Qhg8nfVjey8Azwm-cDGbw&s", price: "199.000đ" },
            { id: 2, name: "Giày Sneaker Thể Thao", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQflPrgv4PvP55D0Qhg8nfVjey8Azwm-cDGbw&s", price: "799.000đ" },
            { id: 3, name: "Túi Đeo Chéo Unisex", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQflPrgv4PvP55D0Qhg8nfVjey8Azwm-cDGbw&s", price: "249.000đ" }
        ];
    }

    //------------------------------------------------------
    // 3. Get CSS String (Không inject vào head nữa)
    //------------------------------------------------------
    function getPopupCSS() {
        return `
            /* Reset CSS cơ bản để không bị ảnh hưởng bởi bên ngoài */
            :host {
                all: initial; 
                font-family: Arial, sans-serif;
            }
            * { box-sizing: border-box; }

            .myrec-popup {
                position: fixed;
                bottom: 24px;
                right: 24px;
                width: 340px;
                background: #fff;
                border-radius: 12px;
                box-shadow: 0 4px 28px rgba(0,0,0,0.25);
                z-index: 2147483647; /* Max z-index */
                overflow: hidden;
                animation: myrec-fadein 0.3s ease;
                display: flex;
                flex-direction: column;
                border: 1px solid #e0e0e0;
            }
            @keyframes myrec-fadein { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: translateY(0);} }

            .myrec-header {
                background: #111;
                color: #fff;
                padding: 12px 14px;
                font-size: 15px;
                font-weight: bold;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .myrec-close { cursor: pointer; font-size: 18px; line-height: 1; opacity: 0.8; background: none; border: none; color: white; }
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

    //------------------------------------------------------
    // 4. Render Popup với SHADOW DOM
    //------------------------------------------------------
    function renderPopup(items) {
        // 1. Kiểm tra và xóa popup cũ (nếu có)
        // Lưu ý: Giờ ta tìm theo ID của HOST chứ không phải popup
        const oldHost = document.getElementById("myrec-host");
        if (oldHost) oldHost.remove();

        // 2. Tạo Host Element (nơi chứa Shadow DOM)
        const host = document.createElement("div");
        host.id = "myrec-host";
        document.body.appendChild(host);

        // 3. Tạo Shadow Root (Chế độ open để ta có thể debug dễ dàng)
        const shadow = host.attachShadow({ mode: 'open' });

        // 4. Inject CSS vào Shadow Root
        const style = document.createElement("style");
        style.textContent = getPopupCSS();
        shadow.appendChild(style);

        // 5. Tạo HTML Structure
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
        
        // Append Wrapper vào Shadow
        shadow.appendChild(wrapper);

        // 6. Logic Slide (Giữ nguyên logic cũ, chỉ đổi cách query selector)
        let currentIndex = 0;
        let autoSlideTimer = null;
        const AUTO_SLIDE_DELAY = 5000;

        const slideBox = wrapper.querySelector(".myrec-slide"); // Query trong wrapper (đã nằm trong shadow)

        function renderSlide() {
            const item = items[currentIndex];
            slideBox.innerHTML = `
                <div class="myrec-item" data-id="${item.id}">
                    <img src="${item.img}" alt="${item.name}" />
                    <div class="myrec-name">${item.name}</div>
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
            clearTimeout(autoSlideTimer);
            autoSlideTimer = setTimeout(nextSlide, AUTO_SLIDE_DELAY);
        }

        // Gắn sự kiện (Lưu ý: querySelector từ wrapper hoặc shadow)
        wrapper.querySelector(".myrec-prev").addEventListener("click", prevSlide);
        wrapper.querySelector(".myrec-next").addEventListener("click", nextSlide);

        wrapper.querySelector(".myrec-close").addEventListener("click", () => {
            host.remove(); // Xóa toàn bộ Host
            scheduleNextPopup();
        });

        // Click vào sản phẩm (Event Delegation)
        slideBox.addEventListener("click", (e) => {
            // Do click vào trong shadow DOM, e.target vẫn hoạt động bình thường
            // Tìm phần tử cha gần nhất có class myrec-item
            const productEl = e.target.closest('.myrec-item');
            if (productEl) {
                const id = productEl.getAttribute('data-id');
                console.log("[MyRecSDK] TRACKING CLICK: Product ID =", id);
                // TODO: Gọi API tracking tại đây
            }
        });

        // Init
        renderSlide();
        resetAutoSlide();
    }

    //------------------------------------------------------
    // 5. SDK Public Methods
    //------------------------------------------------------
    window.MyRecommendSDK = {
        showPopup: async () => {
            const items = await fetchRecommendations();
            if (items && items.length > 0) {
                renderPopup(items);
            }
        }
    };

    //------------------------------------------------------
    // 6. URL Change Detection
    //------------------------------------------------------
    function onUrlChange() {
        const host = document.getElementById("myrec-host");
        if (host) host.remove(); // Đóng popup khi chuyển trang

        if (isAllowedPage()) {
             // Logic: Chờ người dùng ổn định ở trang mới rồi mới hiện
             if (popupTimeout) clearTimeout(popupTimeout);
             scheduleNextPopup();
        }
    }

    const originalPushState = history.pushState;
    history.pushState = function (...args) {
        originalPushState.apply(this, args);
        onUrlChange();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
        originalReplaceState.apply(this, args);
        onUrlChange();
    };

    window.addEventListener("popstate", onUrlChange);

    //------------------------------------------------------
    // 7. Auto Run (Safe DOM Check)
    //------------------------------------------------------
    if (enablePopup) {
        const initSDK = () => {
            if (!isAllowedPage()) return;
            window.MyRecommendSDK.showPopup();
            scheduleNextPopup();
        };

        // Kiểm tra xem trang đã load xong chưa
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initSDK);
        } else {
            initSDK(); // Nếu script được load async hoặc ở cuối body
        }    
    }

})();