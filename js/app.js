// Global State
const state = {
    globalSettings: {
        attack: 1000,
        defense: 200,
        duration: 3.0,
        language: 'cn_name' // 'cn_name', 'name' (JP), 'id' (EN)
    },
    chartSettings: {
        yAxis: 'dps', // 'dps', 'total'
        startTime: 0,
        endTime: 3.0,
        displayMode: 'top', // 'top', 'all', 'custom'
        topN: 5,
        customSelection: [] // List of IDs to show
    },
    comparisonObjects: [], // Array of objects { id, charId, variant, atkMod, defMod, color, results }
    characterData: null,
    engine: null,
    chartInstance: null,
    lastSelectedCharId: null // Memory for last selected character
};

// --- Initialization ---

async function init() {
    try {
        // Load Data
        console.log("Fetching data from data/grouped_characters.json...");
        const response = await fetch('data/grouped_characters.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Data loaded:", data);
        
        state.characterData = data.characters;
        
        // Init Engine
        state.engine = new DamageEngine(state.characterData);
        
        // Initialize UI
        setupEventListeners();
        
        // Sync initial language with global state if available
        if (window.getGlobalLang) {
            state.globalSettings.language = window.getGlobalLang();
        }
        
        // Initialize with all characters as default comparison objects
        initializeDefaultComparisonObjects();
        
        // Initial Render
        updateSimulation();

        // Listen for global language changes
        window.addEventListener('langChanged', (e) => {
            state.globalSettings.language = e.detail.lang;
            renderLeaderboard();
            renderChart();
        });
        
    } catch (error) {
        console.error("Failed to initialize:", error);
        alert("Failed to load character data.");
    }
}

function initializeDefaultComparisonObjects() {
    state.comparisonObjects = state.characterData.map(char => {
        let variant = 'default';
        if (char.default_variant_id && char.variants && char.variants[char.default_variant_id]) {
            variant = char.default_variant_id;
        }
        return createComparisonObject(char.id, variant, 1.0, 1.0, char.theme_color || '#808080');
    });
}

function createComparisonObject(charId, variant, atkMod, defMod, color) {
    return {
        id: generateUUID(),
        charId: charId,
        variant: variant,
        atkMod: parseFloat(atkMod),
        defMod: parseFloat(defMod),
        color: color,
        results: null // To be calculated
    };
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    }); 
}

function ensureVisibleColor(colorStr) {
    // Normalize to Hex
    let ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = colorStr;
    let hexColor = ctx.fillStyle; // Returns #rrggbb

    // Basic Hex to RGB
    let r = parseInt(hexColor.slice(1, 3), 16);
    let g = parseInt(hexColor.slice(3, 5), 16);
    let b = parseInt(hexColor.slice(5, 7), 16);
    
    // RGB to HSL
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    // Check Luminance/Lightness
    // If Lightness is too high, darken it
    if (l > 0.7) {
        l = 0.45; // Darken significantly
    } else {
        return hexColor; // No change needed
    }

    // HSL back to RGB
    const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);

    const toHex = x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// --- Logic & Calculation ---

function updateSimulation() {
    const { attack, defense, duration } = state.globalSettings;
    
    // Calculate for all objects
    state.comparisonObjects.forEach(obj => {
        // Prepare engine parameters
        // Engine signature: calculate(charName, state, targetDef, options)
        
        const effectiveState = obj.variant === 'default' ? 'normal' : obj.variant;
        const effectiveDef = defense * obj.defMod;
        const effectiveAtk = attack * obj.atkMod;

        const result = state.engine.calculate(
            obj.charId,
            effectiveState,
            effectiveDef,
            {
                baseAtk: effectiveAtk,
                durationMs: duration * 1000,
                variant: obj.variant === 'default' ? null : obj.variant
            }
        );
        obj.results = result;
    });
    
    // Sort for leaderboard (default by Total Damage)
    // Actually Requirement 1 says: "Leaderboard sorted by final damage value from high to low"
    state.comparisonObjects.sort((a, b) => b.results.totalDamage - a.results.totalDamage);
    
    renderLeaderboard();
    renderChart();
}

// --- UI Rendering ---

function getDisplayName(charId) {
    const char = state.characterData.find(c => c.id === charId);
    if (!char) return charId;
    
    const lang = state.globalSettings.language;
    if (lang === 'cn_name') return char.cn_name || char.name;
    if (lang === 'name') return char.name;
    return char.id; // id as English/Code
}

function getVariantName(charId, variantKey) {
    const char = state.characterData.find(c => c.id === charId);
    if (variantKey === 'default' || !variantKey) {
        return (char && char.default_label) ? char.default_label : '通常';
    }
    // Ideally we would have localized variant names, for now use key
    return variantKey;
}

function renderLeaderboard() {
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';
    
    state.comparisonObjects.forEach((obj, index) => {
        const char = state.characterData.find(c => c.id === obj.charId);
        const tr = document.createElement('tr');
        
        const dps = (obj.results.totalDamage / state.globalSettings.duration).toFixed(1);
        const total = Math.floor(obj.results.totalDamage);
        
        tr.innerHTML = `
            <td><span class="color-indicator" style="background-color: ${obj.color}"></span></td>
            <td>${index + 1}</td>
            <td><img src="assets/images/${obj.charId}.png" onerror="this.src='';this.style.backgroundColor='${obj.color}'" alt="${obj.charId}"></td>
            <td>${getDisplayName(obj.charId)}</td>
            <td>${getVariantName(obj.charId, obj.variant)}</td>
            <td>${dps}</td>
            <td>${total}</td>
            <td>x${obj.atkMod}</td>
            <td>x${obj.defMod}</td>
            <td>
                <button class="action-btn" onclick="deleteComparisonObject('${obj.id}')">×</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderChart() {
    const ctx = document.getElementById('damage-chart').getContext('2d');
    
    // Determine objects to display
    let displayObjects = [];
    if (state.chartSettings.displayMode === 'all') {
        displayObjects = state.comparisonObjects;
    } else if (state.chartSettings.displayMode === 'top') {
        displayObjects = state.comparisonObjects.slice(0, state.chartSettings.topN);
    } else if (state.chartSettings.displayMode === 'custom') {
        displayObjects = state.comparisonObjects.filter(obj => state.chartSettings.customSelection.includes(obj.id));
    }
    
    // Prepare Datasets
    const datasets = displayObjects.map(obj => {
        // Generate data points
        // Timeline is stored in obj.results.timeline (events)
        // We need to sample it or create step line.
        // Requirement 5: "Draw points when value changes" -> Stepped Line
        
        const dataPoints = [];
        let currentDamage = 0;
        
        // Add start point
        dataPoints.push({x: 0, y: 0});
        
        // Process hits to build cumulative damage
        // obj.results.hits contains { time, damage } (time is in seconds)
        // We need to filter by chart start/end time
        const startTime = state.chartSettings.startTime;
        const endTime = state.chartSettings.endTime;
        
        // Sort hits by time just in case
        const hits = obj.results.hits.sort((a, b) => a.time - b.time);
        
        hits.forEach(hit => {
            if (hit.time > endTime) return;
            
            // For stepped line, we hold previous value until new time
            currentDamage += hit.damage;
            
            if (hit.time >= startTime) {
                // Y Axis Mode
                let yVal = currentDamage;
                if (state.chartSettings.yAxis === 'dps') {
                    // Avoid division by zero
                    yVal = hit.time > 0 ? currentDamage / hit.time : 0;
                }
                
                dataPoints.push({ x: hit.time, y: yVal });
            }
        });
        
        // Add final point at end time if needed to extend line
        if (dataPoints.length > 0 && dataPoints[dataPoints.length-1].x < state.chartSettings.endTime) {
             const lastY = dataPoints[dataPoints.length-1].y;
             // If DPS, it changes as time increases even if damage doesn't
             if (state.chartSettings.yAxis === 'dps') {
                 // Recalculate DPS at end time
                 const finalDps = currentDamage / state.chartSettings.endTime;
                 dataPoints.push({ x: state.chartSettings.endTime, y: finalDps });
             } else {
                 dataPoints.push({ x: state.chartSettings.endTime, y: lastY });
             }
        }

        return {
            label: `${getDisplayName(obj.charId)} (${getVariantName(obj.charId, obj.variant)})`,
            data: dataPoints,
            borderColor: obj.color,
            backgroundColor: obj.color,
            fill: false,
            tension: 0.1,
            stepped: state.chartSettings.yAxis === 'total' ? true : false, // Total damage is stepped, DPS is smooth? No, DPS changes discreetly at hit? Or continuously?
                                                                         // "Average damage per second" usually means Total / Time. This is a continuous curve 1/x style between hits.
                                                                         // Chart.js scatter/line might interpolate. Let's stick to simple points.
            pointRadius: 2,
            borderWidth: 2
        };
    });

    if (state.chartInstance) {
        state.chartInstance.destroy();
    }

    state.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: { display: true, text: 'Time (s)' },
                    min: state.chartSettings.startTime,
                    max: state.chartSettings.endTime
                },
                y: {
                    title: { display: true, text: state.chartSettings.yAxis === 'dps' ? 'DPS' : 'Total Damage' },
                    beginAtZero: true
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false
                },
                legend: {
                    position: 'bottom'
                }
            },
            animation: false
        }
    });
}

// --- Event Listeners ---

function setupEventListeners() {
    // Global Settings
    document.getElementById('global-attack').addEventListener('change', (e) => {
        state.globalSettings.attack = parseFloat(e.target.value);
        updateSimulation();
    });
    document.getElementById('global-defense').addEventListener('change', (e) => {
        state.globalSettings.defense = parseFloat(e.target.value);
        updateSimulation();
    });
    document.getElementById('global-duration').addEventListener('change', (e) => {
        state.globalSettings.duration = parseFloat(e.target.value);
        updateSimulation();
    });
    // Removed legacy language selector listener

    // Chart Controls
    document.getElementById('chart-yaxis-mode').addEventListener('change', (e) => {
        state.chartSettings.yAxis = e.target.value;
        renderChart();
    });
    document.getElementById('chart-start-time').addEventListener('change', (e) => {
        state.chartSettings.startTime = parseFloat(e.target.value);
        renderChart();
    });
    document.getElementById('chart-end-time').addEventListener('change', (e) => {
        state.chartSettings.endTime = parseFloat(e.target.value);
        renderChart();
    });
    document.getElementById('chart-display-mode').addEventListener('change', (e) => {
        state.chartSettings.displayMode = e.target.value;
        const customBtn = document.getElementById('chart-custom-select-btn');
        customBtn.style.display = e.target.value === 'custom' ? 'inline-block' : 'none';
        renderChart();
    });
    document.getElementById('chart-top-n').addEventListener('change', (e) => {
        state.chartSettings.topN = parseInt(e.target.value);
        if (state.chartSettings.displayMode === 'top') renderChart();
    });

    // Add Object Modal
    const modal = document.getElementById('modal-overlay');
    const addBtn = document.getElementById('add-object-btn');
    const saveBtn = document.getElementById('modal-save-btn');

    addBtn.addEventListener('click', () => {
        populateCharSelect();
        modal.classList.remove('hidden');

        // Task 3: Memory for last selected character
        if (state.lastSelectedCharId) {
            const select = document.getElementById('modal-char-select');
            select.value = state.lastSelectedCharId;
            updateCustomSelectTrigger(state.lastSelectedCharId);
            // Trigger change to update variants
            select.dispatchEvent(new Event('change'));
        }
    });

    // Close add object modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    saveBtn.addEventListener('click', () => {
        const charId = document.getElementById('modal-char-select').value;
        state.lastSelectedCharId = charId; // Task 3: Save selection

        const variant = document.getElementById('modal-variant-select').value;
        const atkMod = document.getElementById('modal-attack-mod').value;
        const defMod = document.getElementById('modal-defense-mod').value;
        let color = document.getElementById('modal-color-picker').value;
        const autoDarken = document.getElementById('modal-auto-darken').checked;

        if (autoDarken) {
            color = ensureVisibleColor(color);
        }

        const newObj = createComparisonObject(charId, variant, atkMod, defMod, color);
        state.comparisonObjects.push(newObj);
        
        modal.classList.add('hidden');
        updateSimulation();
    });

    // Character Select Change -> Update Variant Options & Color
    document.getElementById('modal-char-select').addEventListener('change', (e) => {
        const charId = e.target.value;
        const char = state.characterData.find(c => c.id === charId);
        
        // Update Variants
        const variantSelect = document.getElementById('modal-variant-select');
        
        // Task 1: Custom Default Label
        const defaultLabel = (char.default_label) ? char.default_label : '通常';
        variantSelect.innerHTML = `<option value="default">${defaultLabel}</option>`;
        
        if (char.variants) {
            Object.keys(char.variants).forEach(vKey => {
                const opt = document.createElement('option');
                opt.value = vKey;
                opt.textContent = vKey; // Localize if possible
                variantSelect.appendChild(opt);
            });
        }

        // Task 2: Default Preferred Variant
        if (char.default_variant_id && char.variants && char.variants[char.default_variant_id]) {
            variantSelect.value = char.default_variant_id;
        } else {
            variantSelect.value = 'default';
        }

        // Update Default Color
        const colorPicker = document.getElementById('modal-color-picker');
        if (char.theme_color) {
            colorPicker.value = char.theme_color;
        }
    });

    // Custom Select Modal
    const customModal = document.getElementById('custom-select-modal');
    const customBtn = document.getElementById('chart-custom-select-btn');
    const closeCustom = document.querySelectorAll('.close-custom-select, #custom-select-confirm');

    customBtn.addEventListener('click', () => {
        renderCustomSelect();
        customModal.classList.remove('hidden');
    });

    closeCustom.forEach(btn => btn.addEventListener('click', () => {
        customModal.classList.add('hidden');
        // Update selection
        const checkboxes = document.querySelectorAll('.custom-select-cb');
        state.chartSettings.customSelection = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        renderChart();
    }));

    // Bulk Actions
    document.getElementById('clear-all-btn').addEventListener('click', () => {
        state.comparisonObjects = [];
        updateSimulation();
    });

    // Bulk Modal Logic
    const bulkBtn = document.getElementById('bulk-menu-btn');
    const bulkModal = document.getElementById('bulk-modal-overlay');
    
    bulkBtn.addEventListener('click', () => {
        bulkModal.classList.remove('hidden');
    });

    // Close bulk modal when clicking outside
    bulkModal.addEventListener('click', (e) => {
        if (e.target === bulkModal) {
            bulkModal.classList.add('hidden');
        }
    });

    // Bulk Add Functions
    const addCharsByFilter = (roleFilter) => {
        const includeVariants = document.getElementById('bulk-include-variants-modal').checked;
        const autoDarken = document.getElementById('bulk-auto-darken-modal').checked;
        const newObjs = [];
        
        state.characterData.forEach(char => {
            // Filter by Role if specified
            if (roleFilter && char.role !== roleFilter) return;

            // Default
            let defaultColor = char.theme_color || '#808080';
            if (autoDarken) defaultColor = ensureVisibleColor(defaultColor);

            // Task 2: Determine primary variant for Bulk Add (unchecked 'include all')
            let primaryVariant = 'default';
            if (!includeVariants && char.default_variant_id && char.variants && char.variants[char.default_variant_id]) {
                primaryVariant = char.default_variant_id;
            }

            newObjs.push(createComparisonObject(char.id, primaryVariant, 1.0, 1.0, defaultColor));
            
            // Variants
            if (includeVariants && char.variants) {
                Object.keys(char.variants).forEach(vKey => {
                    // Avoid duplicating if primary was this variant (though usually primary is default, and default is not in variants)
                    // But if we ever support default_variant_id pointing to a key in variants, we might duplicate it?
                    // The loop adds ALL variants.
                    // If primaryVariant is 'default', we added 'default'. Loop adds all special variants. OK.
                    // If primaryVariant is 'special', we added 'special'. Loop adds all special variants. 'special' is added again.
                    // So we should check for duplication if primaryVariant is not 'default'.
                    
                    if (primaryVariant !== 'default' && vKey === primaryVariant) return;

                    // Variants share base color usually, but could be different if defined?
                    // Assuming share base color for now
                    newObjs.push(createComparisonObject(char.id, vKey, 1.0, 1.0, defaultColor));
                });
            }
        });
        
        state.comparisonObjects = state.comparisonObjects.concat(newObjs);
        updateSimulation();
        bulkModal.classList.add('hidden');
    };

    document.getElementById('bulk-add-all-btn').addEventListener('click', () => addCharsByFilter(null));
    document.getElementById('bulk-add-atk-btn').addEventListener('click', () => addCharsByFilter('atk'));
    document.getElementById('bulk-add-gun-btn').addEventListener('click', () => addCharsByFilter('gun'));
    document.getElementById('bulk-add-spr-btn').addEventListener('click', () => addCharsByFilter('spr'));
    document.getElementById('bulk-add-tnk-btn').addEventListener('click', () => addCharsByFilter('tnk'));

    // Help Modal Logic
    const helpIcon = document.getElementById('help-icon');
    const helpModal = document.getElementById('help-modal-overlay');

    helpIcon.addEventListener('click', () => {
        helpModal.classList.remove('hidden');
    });

    // Close help modal when clicking outside (on overlay)
    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) {
            helpModal.classList.add('hidden');
        }
    });

    // Global close modal handler (for top-right X buttons)
    document.addEventListener('click', (e) => {
        if (e.target.matches('.close-modal')) {
            const modal = e.target.closest('.modal-overlay');
            if (modal) modal.classList.add('hidden');
        }
        
        // Close custom char dropdown when clicking outside
        const dropdownWrapper = document.getElementById('modal-char-custom-wrapper');
        if (dropdownWrapper && !dropdownWrapper.contains(e.target)) {
            const options = document.getElementById('modal-char-options');
            if (options) options.classList.add('hidden');
        }
    });
    
    // Custom Char Dropdown Trigger
    const charTrigger = document.getElementById('modal-char-trigger');
    if (charTrigger) {
        charTrigger.addEventListener('click', () => {
            const options = document.getElementById('modal-char-options');
            options.classList.toggle('hidden');
        });
    }
}

function updateCustomSelectTrigger(charId) {
    const char = state.characterData.find(c => c.id === charId);
    if (!char) return;

    const triggerContent = document.getElementById('modal-char-selected-content');
    const color = char.theme_color || '#808080';
    triggerContent.innerHTML = `
        <span class="color-dot" style="background-color: ${color}"></span>
        <img src="assets/images/${char.id}.png" class="char-icon-small" onerror="this.style.display='none'">
        <span>${getDisplayName(char.id)}</span>
    `;
}

function populateCharSelect() {
    const select = document.getElementById('modal-char-select');
    const customOptions = document.getElementById('modal-char-options');
    
    select.innerHTML = '';
    customOptions.innerHTML = '';

    state.characterData.forEach(char => {
        // 1. Native Select Option
        const opt = document.createElement('option');
        opt.value = char.id;
        opt.textContent = getDisplayName(char.id);
        select.appendChild(opt);

        // 2. Custom Option
        const div = document.createElement('div');
        div.className = 'custom-option';
        // div.dataset.value = char.id; // Not strictly needed if we close over 'char'
        
        const color = char.theme_color || '#808080';
        div.innerHTML = `
            <span class="color-dot" style="background-color: ${color}"></span>
            <img src="assets/images/${char.id}.png" class="char-icon-small" onerror="this.style.display='none'">
            <span>${getDisplayName(char.id)}</span>
        `;
        
        div.addEventListener('click', () => {
            select.value = char.id;
            updateCustomSelectTrigger(char.id);
            customOptions.classList.add('hidden');
            select.dispatchEvent(new Event('change')); // Trigger existing logic
        });
        
        customOptions.appendChild(div);
    });

    // Initialize Trigger with first option or current value
    if (state.characterData.length > 0) {
        const initialId = select.value || state.characterData[0].id;
        select.value = initialId; // Ensure sync
        updateCustomSelectTrigger(initialId);
        select.dispatchEvent(new Event('change'));
    }
}

function renderCustomSelect() {
    const container = document.getElementById('custom-select-list');
    container.innerHTML = '';
    state.comparisonObjects.forEach(obj => {
        const div = document.createElement('div');
        div.className = 'custom-select-item';
        const isChecked = state.chartSettings.customSelection.includes(obj.id);
        div.innerHTML = `
            <input type="checkbox" class="custom-select-cb" value="${obj.id}" ${isChecked ? 'checked' : ''}>
            <span>${getDisplayName(obj.charId)} (${getVariantName(obj.charId, obj.variant)})</span>
        `;
        container.appendChild(div);
    });
}

// Global scope function for HTML onclick
window.deleteComparisonObject = function(id) {
    state.comparisonObjects = state.comparisonObjects.filter(obj => obj.id !== id);
    updateSimulation(); // Re-calc not needed but re-render yes
};

// Start
init();
