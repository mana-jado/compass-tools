document.addEventListener('DOMContentLoaded', () => {
    let characters = [];
    const generateBtn = document.getElementById('generate-btn');
    const resultSection = document.getElementById('result-section');
    
    // Inputs
    const nameInput = document.getElementById('oc-name');
    const roleSelect = document.getElementById('oc-role');
    const modeSelect = document.getElementById('oc-mode');

    // Outputs
    const resName = document.getElementById('res-name');
    const resRole = document.getElementById('res-role');
    const resAtk = document.getElementById('res-atk');
    const resDef = document.getElementById('res-def');
    const resHp = document.getElementById('res-hp');
    const resSpd = document.getElementById('res-spd');
    const jsonOutput = document.getElementById('json-output');
    const copyBtn = document.getElementById('copy-btn');
    const avatarPlaceholder = document.getElementById('oc-avatar');

    // Load Data
    fetch('data/grouped_characters.json')
        .then(response => response.json())
        .then(data => {
            characters = data.characters;
            console.log(`Loaded ${characters.length} characters for OC Maker.`);
            updateRoleOptions(window.getGlobalLang ? window.getGlobalLang() : 'cn_name');
        })
        .catch(err => {
            console.error('Failed to load data:', err);
            alert('数据加载失败。');
        });

    function getLocalizedRoleName(role, lang) {
        if (lang === 'cn_name') {
            const map = {
                'spr': '跑',
                'atk': '拳',
                'gun': '枪',
                'tnk': '盾'
            };
            return map[role] || role;
        } else {
            const map = {
                'spr': 'SPR',
                'atk': 'ATK',
                'gun': 'GUN',
                'tnk': 'TNK'
            };
            return map[role] || role.toUpperCase();
        }
    }

    function updateRoleOptions(lang) {
        const options = roleSelect.options;
        for (let i = 0; i < options.length; i++) {
            options[i].text = getLocalizedRoleName(options[i].value, lang);
        }
    }

    // Listen for language changes
    window.addEventListener('langChanged', (e) => {
        updateRoleOptions(e.detail.lang);
    });

    // Initial update
    if (window.getGlobalLang) {
        updateRoleOptions(window.getGlobalLang());
    }

    generateBtn.addEventListener('click', () => {
        if (characters.length === 0) {
            alert("数据尚未加载，请稍候...");
            return;
        }

        const role = roleSelect.value;
        const mode = modeSelect.value;
        const name = nameInput.value.trim() || "New Character";

        const stats = generateStats(role, mode);
        
        // Update UI
        resName.textContent = name;
        resRole.textContent = role.toUpperCase();
        
        // Colors mapping
        const colors = {
            'atk': '#e74c3c', 
            'gun': '#f1c40f', 
            'tnk': '#2ecc71', 
            'spr': '#3498db'
        };
        
        resRole.style.backgroundColor = colors[role] || '#333';
        avatarPlaceholder.style.backgroundColor = colors[role] || '#333';
        avatarPlaceholder.textContent = name.charAt(0).toUpperCase();

        resAtk.textContent = stats.attack_multiplier.toFixed(2);
        resDef.textContent = stats.defense_multiplier.toFixed(2);
        resHp.textContent = stats.health_multiplier.toFixed(2);
        resSpd.textContent = stats.move_speed.toFixed(2);

        // Generate JSON structure compatible with the app
        const characterData = {
            id: "custom_" + Date.now(),
            name: name,
            role: role,
            stats: stats,
            attributes: { 
                range: role === 'gun' ? 7 : (role === 'atk' ? 2 : 3), // Approximate defaults
                color: 'white' 
            },
            base_action: { 
                motion_multiplier: 1, 
                pitch: [1000] // Placeholder pitch
            }
        };
        
        jsonOutput.value = JSON.stringify(characterData, null, 2);
        resultSection.style.display = 'block';
        
        // Scroll to result
        resultSection.scrollIntoView({ behavior: 'smooth' });
    });

    copyBtn.addEventListener('click', () => {
        jsonOutput.select();
        document.execCommand('copy'); // Legacy but widely supported
        // Navigator clipboard API is better but requires HTTPS/localhost
        // navigator.clipboard.writeText(jsonOutput.value).then(...)
        alert('JSON 已复制到剪贴板');
    });

    function generateStats(role, mode) {
        const roleChars = characters.filter(c => c.role === role);
        
        if (roleChars.length === 0) {
            // Fallback if no characters of that role found
            return { attack_multiplier: 1, defense_multiplier: 1, health_multiplier: 1, move_speed: 1 };
        }

        if (mode === 'template') {
            const template = roleChars[Math.floor(Math.random() * roleChars.length)];
            return {
                attack_multiplier: vary(template.stats.attack_multiplier, 0.1),
                defense_multiplier: vary(template.stats.defense_multiplier, 0.1),
                health_multiplier: vary(template.stats.health_multiplier, 0.1),
                move_speed: vary(template.stats.move_speed, 0.05)
            };
        }
        
        // Calculate averages for balanced mode
        let avgAtk = 0, avgDef = 0, avgHp = 0, avgSpd = 0;
        roleChars.forEach(c => {
            avgAtk += c.stats.attack_multiplier;
            avgDef += c.stats.defense_multiplier;
            avgHp += c.stats.health_multiplier;
            avgSpd += c.stats.move_speed;
        });
        avgAtk /= roleChars.length;
        avgDef /= roleChars.length;
        avgHp /= roleChars.length;
        avgSpd /= roleChars.length;

        // Balanced: small variance from average
        // Wild: larger variance from average
        const variance = mode === 'wild' ? 0.4 : 0.15;

        return {
            attack_multiplier: vary(avgAtk, variance),
            defense_multiplier: vary(avgDef, variance),
            health_multiplier: vary(avgHp, variance),
            move_speed: vary(avgSpd, variance * 0.3) // Speed is sensitive
        };
    }

    function vary(value, percent) {
        // Random variance between -percent and +percent
        const factor = 1 + (Math.random() * 2 - 1) * percent;
        return parseFloat((value * factor).toFixed(2));
    }
});
