(function () {
    const script = document.currentScript;
    // Fallback an toàn nếu script không tìm thấy attribute
    const targetSelector = script?.getAttribute("data-target-selector") || ".myrec-recommend-box";
    const siteId = script?.getAttribute("data-site-id");

    console.log("[MyRec INLINE] SDK Init - Target:", targetSelector);

    let isRendering = false; // Cờ để tránh render chồng chéo

    // Hàm Render chính
    async function render(container) {
        if (!container || isRendering) return;
        
        // KIỂM TRA QUAN TRỌNG: Nếu container đã được SDK xử lý rồi thì bỏ qua
        // Tránh render lại nội dung cũ, gây nháy hình
        if (container.getAttribute('data-myrec-loaded') === 'true') {
            return;
        }

        isRendering = true;

        try {
            console.log("[MyRec INLINE] Found target, start rendering...");

            // 1. Tận dụng Shadow Root cũ nếu có, nếu chưa thì tạo mới (Fix lỗi Crash)
            let shadow = container.shadowRoot;
            if (!shadow) {
                shadow = container.attachShadow({ mode: "open" });
            }

            // 2. Xóa nội dung cũ (Safe Clean)
            shadow.innerHTML = "";

            // 3. Mark là đã render để Observer lần sau bỏ qua
            container.setAttribute('data-myrec-loaded', 'true');

            // --- FAKE API CALL ---
            // await fetch(...) 
            const products = [
                { id: 1, title: "Đã lỡ yêu em nhiều", price: "Justatee", img: "https://i.scdn.co/image/ab67616d00001e0233a31cc1175e787bfea17a65" },
                { id: 2, title: "Mùa hè của em", price: "Vũ.", img: "https://i.scdn.co/image/ab67616d00001e0233a31cc1175e787bfea17a65" },
            ];

            // 4. Inject CSS & HTML
            const style = document.createElement("style");
            style.textContent = `
                :host { display: block; font-family: sans-serif; margin-top: 10px; }
                .wrapper { 
                    display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); 
                    gap: 10px; border: 1px solid #eee; padding: 10px; border-radius: 8px;
                }
                .item { text-align: center; }
                .item img { width: 100%; border-radius: 4px; }
                .title { font-size: 14px; font-weight: bold; margin-top: 5px; }
                .price { color: #d0021b; font-size: 13px; }
            `;
            shadow.appendChild(style);

            const wrapper = document.createElement("div");
            wrapper.className = "wrapper";

            products.forEach(p => {
                const item = document.createElement("div");
                item.className = "item";
                item.innerHTML = `
                    <img src="${p.img}">
                    <div class="title">${p.title}</div>
                    <div class="price">${p.price}</div>
                `;
                wrapper.appendChild(item);
            });

            shadow.appendChild(wrapper);
            console.log("[MyRec INLINE] Render done.");

        } catch (err) {
            console.error("[MyRec INLINE] Error:", err);
        } finally {
            isRendering = false;
        }
    }

    // --- MUTATION OBSERVER TỐI ƯU ---
    
    let debounceTimer = null;

    const observer = new MutationObserver((mutations) => {
        // Kỹ thuật Debounce: Chỉ chạy logic sau khi DOM ngừng thay đổi 100ms
        // Giúp tránh việc chạy 1000 lần khi trang đang load nặng
        if (debounceTimer) clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
            const container = document.querySelector(targetSelector);
            
            // Chỉ render nếu tìm thấy container VÀ container đó chưa được render
            if (container && container.getAttribute('data-myrec-loaded') !== 'true') {
                render(container);
            }
            
            // (Nâng cao) Nếu container bị xóa khỏi DOM (React unmount), 
            // ta có thể reset biến lastContainer tại đây nếu cần logic phức tạp hơn.
        }, 100); 
    });

    // Bắt đầu quan sát
    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
    
    // Check ngay lập tức khi script chạy (phòng trường hợp div đã có sẵn)
    const initialCheck = document.querySelector(targetSelector);
    if(initialCheck) render(initialCheck);

})();