// Constants
const characteristicArray = [
  "攻", "强", "全", "普", "愈", "键", "周", "远", "止", "置", 
  "毒", "贯", "默", "弱", "冻", "押", "突", "破", "秒", "指", 
  "缩", "连", "引", "移", "除", "敌", "吸", "前", "防", "爆", 
  "扩", "反", "射", "投", "柱", "跳", "充", "闪", "飞", "自", 
  "友", "切", "御", "倒", "免", "隐", "标", "速", "卡", "程"
];

const icons = [
    'assets/images/icon/ui_icon_Attacker.png',
    'assets/images/icon/ui_icon_Shooter.png',
    'assets/images/icon/ui_icon_Sprinter.png',
    'assets/images/icon/ui_icon_Tank.png'
];

const speedCards = [
    'assets/images/card_speed/fast.png',
    'assets/images/card_speed/normal.png',
    'assets/images/card_speed/slow.png'
];

// Helper Functions
function generateRandomValue() {
    const random = Math.random();
    if (random < 0.01) {
        return 10;
    } else if (random < 0.9) {
        return Math.round(Math.random() * 20) * 0.05 + 0.50;
    } else {
        return Math.round(Math.random() * 9) * 0.05;
    }
}

function getRandomCharacteristics() {
    const shuffled = [...characteristicArray];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    const random = Math.random();
    let count;
    if (random < 0.7) {
        count = 1;
    } else if (random < 0.95) {
        count = 2;
    } else {
        count = 3;
    }
    
    return shuffled.slice(0, count).join('、');
}

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Main Logic
document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const downloadBtn = document.getElementById('download-btn');
    const nameInput = document.getElementById('character-name');
    const avatarInput = document.getElementById('character-avatar');
    const compassContainer = document.getElementById('compass-container');
    const previewWrapper = document.getElementById('preview-wrapper');

    // Default avatar placeholder
    let currentAvatar = '';

    // Calculate Avatar Dimensions based on rules
    function calculateDimensions(src, callback) {
        const img = new Image();
        img.onload = () => {
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            let finalW, finalH;

            // Logic: 
            // 1. Scale proportionally so shorter side is 480px.
            // 2. Handle extreme constraints.

            if (w < h) {
                // Shorter side is width.
                // Try scaling width to 480.
                let scale = 480 / w;
                finalW = 480;
                finalH = h * scale;

                // If height > 670, constrain height to 670.
                if (finalH > 670) {
                    finalH = 670;
                    finalW = w * (670 / h);
                }
            } else {
                // Shorter side is height (or square).
                // Try scaling height to 480.
                let scale = 480 / h;
                finalH = 480;
                finalW = w * scale;

                // If width > 891, constrain width to 891.
                if (finalW > 891) {
                    finalW = 891;
                    finalH = h * (891 / w);
                }
            }
            callback(finalW, finalH);
        };
        img.src = src; // Set src after onload to ensure it fires
    }

    // Handle File Upload
    avatarInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                currentAvatar = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    generateBtn.addEventListener('click', () => {
        const name = nameInput.value.trim() || 'UNKNOWN';
        
        // Show container
        previewWrapper.style.display = 'block';
        compassContainer.style.display = 'block';
        downloadBtn.style.display = 'block';

        // Update Name
        document.getElementById('compass-username').textContent = name;

        // Update Avatar
        const avatarImg = document.getElementById('user-avatar-img');
        if (currentAvatar) {
            avatarImg.src = currentAvatar;
            // Update dimensions based on new rules
            calculateDimensions(currentAvatar, (w, h) => {
                avatarImg.style.width = `${w}px`;
                avatarImg.style.height = `${h}px`;
            });
        } else {
            // No image uploaded: Show pure white square (480x480)
            // Using a 1x1 white pixel base64
            avatarImg.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; 
            avatarImg.style.width = '480px';
            avatarImg.style.height = '480px';
        }

        // Generate Stats
        const stats = {
            attack: generateRandomValue(),
            defense: generateRandomValue(),
            health: generateRandomValue()
        };

        // Update Stats UI
        updateStatBar('atk', stats.attack);
        updateStatBar('def', stats.defense);
        updateStatBar('hp', stats.health);

        // Update Role Icon
        document.getElementById('role-icon').src = getRandomElement(icons);

        // Update Speed Cards
        for (let i = 1; i <= 4; i++) {
            document.getElementById(`card-${i}`).src = getRandomElement(speedCards);
        }

        // Update Characteristics
        for (let i = 1; i <= 3; i++) {
            document.getElementById(`char-${i}`).textContent = getRandomCharacteristics();
        }
    });

    function updateStatBar(type, value) {
        const bar = document.getElementById(`bar-${type}`);
        const valText = document.getElementById(`val-${type}`);
        
        let widthPercentage;
        if (value === 10) {
            widthPercentage = 200;
            bar.classList.add('stat-bar-max');
            valText.textContent = '× ∞';
        } else {
            widthPercentage = (value * 100) / 1.5;
            bar.classList.remove('stat-bar-max');
            valText.textContent = `× ${value.toFixed(2)}`;
        }
        
        bar.style.width = `${widthPercentage}%`;
    }

    // Download Functionality
    downloadBtn.addEventListener('click', () => {
        // Clone the container to render it without scaling
        const clone = compassContainer.cloneNode(true);
        clone.style.transform = 'scale(1)';
        clone.style.position = 'fixed'; // Use fixed to avoid layout issues
        clone.style.left = '-9999px'; // Move off-screen
        clone.style.top = '0';
        clone.style.margin = '0'; // Remove margins
        document.body.appendChild(clone);
        
        html2canvas(clone, {
            useCORS: true,
            width: 945,
            height: 1100,
            scale: 1, // Capture at 1:1 scale of the 945x1100 element
            backgroundColor: null // Transparent background if any
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `compass_character_${nameInput.value || 'character'}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            document.body.removeChild(clone);
        }).catch(err => {
            console.error('Download failed:', err);
            alert('图片生成失败，请重试');
            document.body.removeChild(clone);
        });
    });
});
