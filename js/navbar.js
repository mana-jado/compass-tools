document.addEventListener("DOMContentLoaded", function() {
    // 1. Define Language State
    const validLangs = ['cn_name', 'name', 'id'];
    let currentLang = localStorage.getItem('compass_lang') || 'cn_name';
    if (!validLangs.includes(currentLang)) currentLang = 'cn_name';

    // 2. Build Navbar HTML
    const navbarHTML = `
    <nav class="navbar">
        <div class="navbar-container">
            <a href="random.html" class="navbar-brand">Compass Tools</a>
            <button class="navbar-toggle" aria-label="Toggle navigation">
                <span></span>
                <span></span>
                <span></span>
            </button>
            <div class="navbar-collapse">
                <ul class="navbar-menu">
                    <li><a href="random.html">随机角色</a></li>
                    <li><a href="random_card.html">随机卡组</a></li>
                    <li><a href="character_maker.html">角色生成</a></li>
                    <li><a href="calculator.html">伤害比较</a></li>
                </ul>
                <div class="navbar-lang" style="display: flex; align-items: center;">
                    <select id="global-lang-select" class="lang-select">
                        <option value="cn_name">中文</option>
                        <option value="name">日本語</option>
                        <option value="id">English</option>
                    </select>
                    <div id="navbar-help-icon" class="navbar-help-icon" title="使用说明">?</div>
                </div>
            </div>
        </div>
    </nav>

    <!-- Global Help Modal -->
    <div id="navbar-help-modal" class="navbar-modal-overlay hidden">
        <div class="navbar-modal">
            <div class="navbar-modal-header">
                <h3>数据来源</h3>
                <button id="navbar-help-close" class="navbar-modal-close">&times;</button>
            </div>
            <div class="navbar-modal-body">
                <p><strong>角色图片文件</strong><br>
                微信小程序：康帕斯大百科</p>
                
                <p><strong>卡牌图片文件&角色数据</strong><br>
                https://yagitools.cloudfree.jp/compas-deck/</p>
            </div>
        </div>
    </div>
    `;

    // 3. Insert Navbar
    document.body.insertAdjacentHTML("afterbegin", navbarHTML);

    // 4. Highlight Active Link
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    const links = document.querySelectorAll(".navbar-menu a");
    links.forEach(link => {
        if (link.getAttribute("href") === currentPath) {
            link.classList.add("active");
        }
    });

    // 5. Initialize Language Selector
    const langSelect = document.getElementById('global-lang-select');
    if (langSelect) {
        langSelect.value = currentLang;
        
        // Listen for changes
        langSelect.addEventListener('change', (e) => {
            const newLang = e.target.value;
            localStorage.setItem('compass_lang', newLang);
            // Dispatch a custom event that other scripts can listen to
            window.dispatchEvent(new CustomEvent('langChanged', { detail: { lang: newLang } }));
        });
    }

    // 6. Initialize Help Modal Logic
    const helpIcon = document.getElementById('navbar-help-icon');
    const helpModal = document.getElementById('navbar-help-modal');
    const helpClose = document.getElementById('navbar-help-close');
    
    // Initialize Navbar Toggle
    const navbarToggle = document.querySelector('.navbar-toggle');
    const navbarCollapse = document.querySelector('.navbar-collapse');
    
    if (navbarToggle && navbarCollapse) {
        navbarToggle.addEventListener('click', () => {
            navbarCollapse.classList.toggle('show');
            navbarToggle.classList.toggle('active');
        });
    }

    if (helpIcon && helpModal && helpClose) {
        helpIcon.addEventListener('click', () => {
            helpModal.classList.remove('hidden');
        });

        helpClose.addEventListener('click', () => {
            helpModal.classList.add('hidden');
        });

        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                helpModal.classList.add('hidden');
            }
        });
    }

    // 7. Expose global helper to get current language
    window.getGlobalLang = function() {
        return localStorage.getItem('compass_lang') || 'cn_name';
    };
});
