document.addEventListener('DOMContentLoaded', () => {
    let characters = [];
    let currentChar = null; // Store currently displayed character

    const rollBtn = document.getElementById('roll-btn');
    const resultCard = document.getElementById('result-card');
    
    // Elements to update
    const charImg = document.getElementById('char-img');
    const charName = document.getElementById('char-name');
    const charRole = document.getElementById('char-role');
    const statAtk = document.getElementById('stat-atk');
    const statDef = document.getElementById('stat-def');
    const statHp = document.getElementById('stat-hp');
    const statSpd = document.getElementById('stat-spd');

    // Load Data
    fetch('data/grouped_characters.json')
        .then(response => response.json())
        .then(data => {
            characters = data.characters;
            console.log(`Loaded ${characters.length} characters.`);
        })
        .catch(err => {
            console.error('Failed to load character data:', err);
            alert('数据加载失败，请检查网络或文件路径。');
        });

    // Helper to get localized role name
    function getLocalizedRole(role, lang) {
        if (lang === 'cn_name') {
            const map = {
                'atk': '拳',
                'gun': '枪',
                'tnk': '盾',
                'spr': '跑'
            };
            return map[role] || role;
        } else {
            // JP and EN use English abbreviations
            const map = {
                'atk': 'ATK',
                'gun': 'GUN',
                'tnk': 'TNK',
                'spr': 'SPR'
            };
            return map[role] || role.toUpperCase();
        }
    }

    // Helper to get localized character name
    function getLocalizedCharName(char, lang) {
        if (!char) return '';
        if (lang === 'cn_name') return char.cn_name || char.name;
        if (lang === 'name') return char.name;
        return char.id;
    }

    // Helper to get localized role name for display (checkboxes etc)
    function getLocalizedRoleName(role, lang) {
        if (lang === 'cn_name') {
            const map = {
                'atk': '拳',
                'gun': '枪',
                'tnk': '盾',
                'spr': '跑'
            };
            return map[role] || role;
        } else {
            const map = {
                'atk': 'ATK',
                'gun': 'GUN',
                'tnk': 'TNK',
                'spr': 'SPR'
            };
            return map[role] || role.toUpperCase();
        }
    }

    // Helper to update checkboxes text
    function updateCheckboxes(lang) {
        const ids = ['filter-atk', 'filter-gun', 'filter-tnk', 'filter-spr'];
        ids.forEach(id => {
            const input = document.getElementById(id);
            if (input && input.parentElement) {
                const label = input.parentElement;
                // Update the text node (assuming it's the last child or follows input)
                const role = id.replace('filter-', '');
                const newText = " " + getLocalizedRoleName(role, lang);
                
                // Robustly find text node or append
                let textNode = null;
                for (let i = 0; i < label.childNodes.length; i++) {
                    const node = label.childNodes[i];
                    if (node.nodeType === 3 && node.textContent.trim().length > 0) {
                        textNode = node;
                        break;
                    }
                }
                
                if (textNode) {
                    textNode.textContent = newText;
                } else {
                    label.appendChild(document.createTextNode(newText));
                }
            }
        });
    }

    // Update UI based on current character and language
    function updateDisplay() {
        const lang = window.getGlobalLang ? window.getGlobalLang() : 'cn_name';
        
        // Update Checkboxes
        updateCheckboxes(lang);

        if (!currentChar) return;

        // Update Name
        charName.textContent = getLocalizedCharName(currentChar, lang);
        
        // Update Role
        charRole.textContent = getLocalizedRole(currentChar.role, lang);
        
        // Update Stats (independent of language)
        statAtk.textContent = currentChar.stats.attack_multiplier.toFixed(2);
        statDef.textContent = currentChar.stats.defense_multiplier.toFixed(2);
        statHp.textContent = currentChar.stats.health_multiplier.toFixed(2);
        statSpd.textContent = currentChar.stats.move_speed.toFixed(2);

        // Update Image
        charImg.src = `assets/images/${currentChar.id}.png`;
        charImg.onerror = () => { charImg.src = 'assets/images/void.png'; };

        // Styling
        charRole.classList.remove('role-atk', 'role-gun', 'role-tnk', 'role-spr');
        if (currentChar.role) charRole.classList.add(`role-${currentChar.role}`);

        resultCard.style.display = 'block';
    }

    // Listen for language changes
    window.addEventListener('langChanged', () => {
        updateDisplay();
    });
    
    // Initial display update for checkboxes
    if (window.getGlobalLang) {
        updateDisplay();
    }

    rollBtn.addEventListener('click', () => {
        if (characters.length === 0) return;

        // Animation effect
        rollBtn.disabled = true;
        rollBtn.textContent = "抽取中...";
        resultCard.style.display = 'none';

        // Filter characters based on checkboxes
        const allowedRoles = [];
        if (document.getElementById('filter-atk').checked) allowedRoles.push('atk');
        if (document.getElementById('filter-gun').checked) allowedRoles.push('gun');
        if (document.getElementById('filter-tnk').checked) allowedRoles.push('tnk');
        if (document.getElementById('filter-spr').checked) allowedRoles.push('spr');

        const pool = characters.filter(c => allowedRoles.includes(c.role));

        if (pool.length === 0) {
            alert("请至少选择一个职业！");
            rollBtn.disabled = false;
            rollBtn.textContent = "开始抽取";
            return;
        }

        setTimeout(() => {
            const randomIndex = Math.floor(Math.random() * pool.length);
            currentChar = pool[randomIndex];

            updateDisplay();

            rollBtn.disabled = false;
            rollBtn.textContent = "再次抽取";
        }, 500); // 0.5s delay for effect
    });
});
