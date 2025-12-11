(function () {
    // ... (Giữ lại các phần Config, API cũ) ...

    //------------------------------------------------------
    // CSS cho Widget (Responsive Grid)
    //------------------------------------------------------
    function getWidgetCSS() {
        return `
            :host {
                all: initial;
                display: block;
                font-family: Arial, sans-serif;
                width: 100%; /* Chiếm hết chiều rộng cha */
            }
            * { box-sizing: border-box; }

            .rec-container {
                display: grid;
                /* Tự động chia cột: Tối thiểu 150px/cột, còn lại tự giãn */
                grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                gap: 16px;
                padding: 10px 0;
            }

            .rec-item {
                border: 1px solid #eee;
                border-radius: 8px;
                overflow: hidden;
                transition: transform 0.2s;
                background: #fff;
                cursor: pointer;
                text-decoration: none;
                color: inherit;
                display: flex;
                flex-direction: column;
            }
            .rec-item:hover { transform: translateY(-3px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }

            .rec-img-box {
                width: 100%;
                padding-top: 100%; /* Trick để tạo khung vuông tỷ lệ 1:1 */
                position: relative;
            }
            .rec-img-box img {
                position: absolute; top: 0; left: 0;
                width: 100%; height: 100%; object-fit: cover;
            }

            .rec-info { padding: 10px; }
            .rec-name {
                font-size: 14px; font-weight: 600; color: #333; margin: 0 0 5px;
                display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 36px;
            }
            .rec-price { color: #d10000; font-weight: bold; font-size: 14px; }
        `;
    }

    //------------------------------------------------------
    // HÀM RENDER WIDGET (QUAN TRỌNG)
    //------------------------------------------------------
    async function renderWidgets() {
        // 1. Tìm tất cả các thẻ div mà khách hàng đã đặt
        const widgets = document.querySelectorAll('.myrec-widget');
        
        if (widgets.length === 0) return;

        // 2. Duyệt qua từng widget để xử lý
        widgets.forEach(async (widgetDiv) => {
            // Kiểm tra xem widget này đã được render chưa (tránh render 2 lần)
            if (widgetDiv.shadowRoot) return;

            const slotId = widgetDiv.getAttribute('data-slot');
            console.log(`[MyRecSDK] Found widget slot: ${slotId}`);

            // 3. Gọi API (Có thể truyền slotId để lấy data khác nhau cho từng chỗ)
            // Ví dụ: slot="sidebar" lấy 3 món, slot="main" lấy 10 món
            const items = await fetchRecommendations(slotId); 

            if (!items || items.length === 0) return;

            // 4. Tạo Shadow DOM ngay trên thẻ div của khách hàng
            const shadow = widgetDiv.attachShadow({ mode: 'open' });

            // 5. Inject CSS
            const style = document.createElement('style');
            style.textContent = getWidgetCSS();
            shadow.appendChild(style);

            // 6. Inject HTML (Grid Layout)
            const container = document.createElement('div');
            container.className = 'rec-container';
            
            items.forEach(item => {
                const html = `
                    <a href="#" class="rec-item" data-id="${item.id}">
                        <div class="rec-img-box">
                            <img src="${item.img}" alt="${item.name}">
                        </div>
                        <div class="rec-info">
                            <div class="rec-name">${item.name}</div>
                            <div class="rec-price">${item.price}</div>
                        </div>
                    </a>
                `;
                // Lưu ý: innerHTML += trong loop không tối ưu performance, 
                // nhưng với list nhỏ thì chấp nhận được. Tốt hơn nên dùng DocumentFragment.
                container.innerHTML += html;
            });

            shadow.appendChild(container);

            // 7. Tracking Click (Bên trong Shadow DOM)
            container.addEventListener('click', (e) => {
                const item = e.target.closest('.rec-item');
                if(item) {
                   console.log("Tracking click Widget:", item.getAttribute('data-id'));
                }
            });
        });
    }

    //------------------------------------------------------
    // PUBLIC SDK & INIT
    //------------------------------------------------------
    window.MyRecommendSDK = {
        // Giữ hàm showPopup cũ...
        // Thêm hàm này để khách hàng gọi thủ công nếu muốn (ví dụ sau khi load ajax)
        scanAndRenderWidgets: renderWidgets
    };

    // Tự động chạy khi tải trang
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderWidgets);
    } else {
        renderWidgets();
    }

})();