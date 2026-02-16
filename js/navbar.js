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
            <ul class="navbar-menu">
                <li><a href="random.html">随机角色</a></li>
                <li><a href="random_card.html">随机卡组</a></li>
                <li><a href="oc_maker.html">角色生成</a></li>
                <li><a href="calculator.html">伤害比较</a></li>
            </ul>
            <div class="navbar-lang">
                <select id="global-lang-select" class="lang-select">
                    <option value="cn_name">中文</option>
                    <option value="name">日本語</option>
                    <option value="id">English</option>
                </select>
            </div>
        </div>
    </nav>
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

    // 6. Expose global helper to get current language
    window.getGlobalLang = function() {
        return localStorage.getItem('compass_lang') || 'cn_name';
    };
});
