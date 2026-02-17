
class DamageEngine {
    constructor(characterData) {
        this.characters = {};
        if (characterData) {
            this.loadFromObject(characterData);
        } else if (typeof require !== 'undefined') {
            // Node.js environment
            this.loadFromDisk();
        }
    }

    loadFromObject(dataList) {
        dataList.forEach(char => {
            // Preprocess overrides to generate variants for HA/HS
            this._preprocessCharacter(char);

            this.characters[char.name] = char;
            if (char.id && char.id !== char.name) {
                this.characters[char.id] = char;
            }
            // Also map altNames
            if (char.altNames) {
                char.altNames.forEach(alt => this.characters[alt] = char);
            }
        });
    }

    _preprocessCharacter(char) {
        if (!char.variants) char.variants = {};

        // REMOVED: Automatic generation of 'HS' from 'overrides'
        // REMOVED: Automatic generation of 'HA' from 'hero_action'
        
        // This ensures that 'overrides' and 'hero_action' fields in JSON
        // remain as pure data/metadata and do not pollute the variants list.
        // Users must manually define 'HS' or 'HA' in 'variants' if they want them to be selectable states.
    }

    loadFromDisk() {
        if (typeof require !== 'undefined') {
            const fs = require('fs');
            const path = require('path');
            try {
                // Adjust path since this file is now in js/ folder
                const dataPath = path.join(__dirname, '..', 'data', 'grouped_characters.json');
                const rawData = fs.readFileSync(dataPath, 'utf8');
                const json = JSON.parse(rawData);
                this.loadFromObject(json.characters);
            } catch (err) {
                console.error("Error loading character data from disk:", err);
            }
        }
    }

    /**
     * Calculate damage with advanced mechanics support.
     */
    calculate(charName, state = 'normal', targetDef = 200, options = {}) {
        let char = this.characters[charName];
        if (!char) {
            // Try partial match if exact match fails
            const foundKey = Object.keys(this.characters).find(k => k.includes(charName));
            if (foundKey) {
                char = this.characters[foundKey];
            } else {
                return { error: `Character '${charName}' not found.` };
            }
        }

        // Handle Variants (State consolidation)
        if (char.variants) {
            // Determine variant from state or options.variant
            const variantKey = options.variant || (state !== 'normal' ? state : null);
            if (variantKey && char.variants[variantKey]) {
                // Merge variant data into a new character object
                const variant = char.variants[variantKey];
                char = {
                    ...char,
                    ...variant,
                    stats: { ...char.stats, ...variant.stats },
                    attributes: { ...char.attributes, ...variant.attributes },
                    base_action: { ...char.base_action, ...variant.base_action },
                    hero_action: { ...char.hero_action, ...variant.hero_action },
                    mechanics: { ...char.mechanics, ...variant.mechanics } // Merge mechanics if variant has them
                };
            }
        }

        // Initialize Context
        const context = {
            char: char,
            state: state,
            options: options,
            mechanics: char.mechanics || {}, // Now loaded from data
            stats: {
                baseAtk: options.baseAtk || 1000,
                atkMult: char.stats.attack_multiplier * (char.stats.attack_scaling_factor !== undefined ? char.stats.attack_scaling_factor : 1.0),
                defMult: char.stats.defense_multiplier !== undefined ? char.stats.defense_multiplier : 1.0,
                motionMult: char.base_action.motion_multiplier !== undefined ? char.base_action.motion_multiplier : 1.0,
                def: targetDef,
                effectiveDef: targetDef
            },
            runtime: {
                hitCount: 0,
                stacks: 0,
                startTime: 0,
                elapsedTime: 0
            }
        };

        // Apply Defense Multiplier if exists
        if (context.mechanics && context.mechanics.target_def_multiplier !== undefined) {
            context.stats.effectiveDef *= context.mechanics.target_def_multiplier;
        }

        // Determine Simulation Duration
        // Default to 1 full combo cycle if duration is not specified
        const pitch = this._getPitch(context);
        const cycleTimeMs = pitch[0];
        const limitTimeMs = options.durationMs || (options.duration ? options.duration * 1000 : cycleTimeMs);

        // --- Event Generation ---
        let events = [];

        // 1. Generate Main Attack Events
        // Logic adapted from Original_Project/anim.js:
        // - pitch[0] is the cycle duration (reset time).
        // - pitch[1..n] are the hit timestamps within the cycle.
        // - When elapsed time in cycle reaches pitch[0], the cycle resets.
        let t = 0;
        let cycleCount = 0;

        // Phase Tracking
        let phaseIndex = 0;
        let phaseCycleCount = 0;
        const hasPhases = context.char.base_action.phases && context.char.base_action.phases.length > 0;

        while (t < limitTimeMs) {
            // Check for speed modifiers (though current implementation primarily uses static pitch)
            let currentPitch;
            let currentPhase = null;

            if (hasPhases) {
                // Get Current Phase
                if (phaseIndex >= context.char.base_action.phases.length) {
                    break; // All phases completed
                }
                currentPhase = context.char.base_action.phases[phaseIndex];
                
                // Use phase pitch
                currentPitch = [...currentPhase.pitch];
                
                // Apply speed modifiers manually since _getPitch assumes context.char.base_action.pitch
                if (context.mechanics && context.mechanics.speed_modifier) {
                     const mod = context.mechanics.speed_modifier.multiplier;
                     currentPitch = currentPitch.map(v => v * mod);
                }
            } else {
                currentPitch = this._getPitch(context);
            }

            const cycleDuration = currentPitch[0];

            // Validate cycle duration to prevent infinite loops
            if (cycleDuration <= 0) {
                console.warn(`Cycle duration is 0 or negative for ${charName}. Aborting loop.`);
                break;
            }

            // Generate hits for this cycle
            for (let i = 1; i < currentPitch.length; i++) {
                // Ignore hits that occur after the cycle reset time (pitch[0])
                if (currentPitch[i] > cycleDuration) continue;

                const hitTime = t + currentPitch[i];
                if (hitTime <= limitTimeMs) {
                    events.push({
                        time: hitTime,
                        type: 'hit',
                        hitIndex: i, // 1-based index
                        cycleTime: t,
                        cycleCount: cycleCount,
                        phase: currentPhase // Attach phase info
                    });
                }
            }
            
            // Advance time by cycle duration (Reset logic)
            t += cycleDuration;
            cycleCount++;
            
            // Update Phase Progress
            if (hasPhases) {
                phaseCycleCount++;
                // If repeat is not -1 (infinite) and we reached the limit
                if (currentPhase.repeat !== -1 && phaseCycleCount >= currentPhase.repeat) {
                    phaseIndex++;
                    phaseCycleCount = 0;
                }
            }

            // If user only wanted one cycle (default behavior without duration), break
            // Note: For phases, "one cycle" might be ambiguous. 
            // We'll assume if phases are used, duration SHOULD be provided, otherwise it runs 1 cycle of phase 1.
            if (!options.durationMs && !options.duration) break;
        }

        // 2. Generate Periodic Events
        // The 'periodic' data should be in context.mechanics.periodic after variant merging
        if (context.mechanics && context.mechanics.periodic) {
            const periodic = context.mechanics.periodic;
            if (periodic.interval > 0) {
                let pt = periodic.interval;
                while (pt <= limitTimeMs) {
                    events.push({
                        time: pt,
                        type: 'periodic',
                        data: periodic
                    });
                    pt += periodic.interval;
                }
            }
        }

        // 3. Sort Events by Time
        events.sort((a, b) => a.time - b.time);

        // --- Event Processing ---
        const results = {
            character: char.name,
            totalDamage: 0,
            totalTime: limitTimeMs / 1000.0,
            hits: [],
            log: []
        };

        for (const event of events) {
            this._processEvent(event, context, results);
        }

        results.dps = results.totalTime > 0 ? results.totalDamage / results.totalTime : 0;
        return results;
    }

    _getMechanics(charName) {
        // Deprecated: Mechanics now loaded directly from character data
        return null;
    }

    _getPitch(context) {
        // If phases exist, use the pitch of the first phase as a fallback/default
        if (context.char.base_action.phases && context.char.base_action.phases.length > 0) {
            let pitch = [...context.char.base_action.phases[0].pitch];
            // Apply speed modifier if exists (copied logic from below)
            if (context.mechanics && context.mechanics.speed_modifier) {
                const mod = context.mechanics.speed_modifier.multiplier;
                pitch = pitch.map(v => v * mod);
            }
            return pitch;
        }

        if (!context.char.base_action.pitch) {
            // Fallback for missing pitch
            return [1000]; 
        }

        let pitch = [...context.char.base_action.pitch]; // Copy to avoid modifying original
        
        // Note: motion_multiplier in character data refers to Damage Motion Value, not speed.
        // So we do NOT apply it to pitch here.
        // Speed modifiers (buffs/debuffs) should be applied separately if they exist.

        // Apply Noho Speed Modifier (Mechanics)
        if (context.mechanics && context.mechanics.speed_modifier) {
            const mod = context.mechanics.speed_modifier.multiplier;
            // Return a new array with scaled values
            // mod < 1 means faster? Or > 1?
            // Usually mechanics modifiers are multipliers on the time (0.8 = 80% duration = faster)
            // OR multipliers on speed (1.2 = 120% speed = shorter duration)
            // In anim.js: "TempATKPitch = [3495...]" hardcoded replacement for Noho HS
            // Let's assume the mechanic stores the *multiplier on time* (e.g. 0.8) or handled elsewhere.
            // For now, let's just multiply as before since that was existing logic.
            pitch = pitch.map(v => v * mod);
        }
        
        return pitch;
    }

    _processEvent(event, context, results) {
        let damage = 0;
        let note = "";

        if (event.type === 'hit') {
            // Update Levi Stacks BEFORE damage? Or After? 
            // Usually stacks apply to current hit if condition met, or next.
            // Levi: "Attack count increases... buff applies"
            // Let's assume current hit counts towards the stack, and buff applies if threshold met.
            context.runtime.hitCount++;
            
            // 1. Calculate Multiplier
            let multiplier = 1.0;
            
            // Check for Phase override or standard
            let baseMotionMult = context.stats.motionMult;
            if (event.phase && event.phase.motion_multiplier !== undefined) {
                baseMotionMult = event.phase.motion_multiplier;
            }

            // Ainz: Hit Overrides (Legacy/Special Mechanics way)
            if (context.mechanics && context.mechanics.hit_overrides && context.mechanics.hit_overrides[event.hitIndex]) {
                multiplier = context.mechanics.hit_overrides[event.hitIndex];
                note += `(Hit ${event.hitIndex} Override)`;
            } else {
                // Check if motionMult is array (Native data way)
                if (Array.isArray(baseMotionMult)) {
                     // hitIndex is 1-based, array is 0-based
                    const idx = (event.hitIndex - 1) % baseMotionMult.length;
                    multiplier = baseMotionMult[idx];
                } else {
                    multiplier = baseMotionMult;
                }
            }

            // Levi: Stack Multiplier
            if (context.mechanics && context.mechanics.state_evolution) {
                const evo = context.mechanics.state_evolution;
                if (evo.type === 'hit_count_buff') {
                    let stackMult = 1.0;
                    
                    if (evo.thresholds) {
                        // Find highest threshold met (Legacy)
                        for (const th of evo.thresholds) {
                            if (context.runtime.hitCount >= th.count) {
                                stackMult = th.multiplier;
                            }
                        }
                    } else if (evo.increment_per_stack) {
                        // Linear Growth
                        // Count stacks up to max
                        // Stacks = hitCount. But should it be hitCount - 1? 
                        // Usually "start with 0 stacks". 
                        // Hit 1 -> 0 stacks -> damage normal -> becomes 1 stack.
                        // Hit 2 -> 1 stack -> damage +7% -> becomes 2 stacks.
                        // context.runtime.hitCount was incremented at start of this block (line 239)
                        // So hitCount is 1 for the first hit.
                        // If we want 0 stacks for first hit, use hitCount - 1.
                        const stacks = Math.min(context.runtime.hitCount - 1, evo.max_stacks);
                        // Ensure no negative stacks
                        const effectiveStacks = Math.max(0, stacks);
                        
                        stackMult = 1.0 + (effectiveStacks * evo.increment_per_stack);
                        
                        if (effectiveStacks > 0) note += ` (Stack x${stackMult.toFixed(2)})`;
                    }
                    
                    multiplier *= stackMult;
                }
            }

            // Adam: Conditional
            if (context.mechanics && context.mechanics.conditional_multiplier) {
                // Check condition (mocked)
                if (context.mechanics.conditional_multiplier.condition === 'element_water') {
                    // Logic to swap base damage would go here
                    // For now, just a multiplier demo
                    // multiplier *= 1.2; 
                }
            }

            // 2. Calculate Base Damage
            // Formula: (BaseATK * CharMult * Motion/HitMult - Def)
            const effectiveAtk = context.stats.baseAtk * context.stats.atkMult * multiplier;
            // Use effectiveDef instead of def
            damage = Math.max(1, Math.floor(effectiveAtk - context.stats.effectiveDef));

            // 3. Noctis/Extra Hits
            if (context.mechanics && context.mechanics.extra_hits) {
                for (const extra of context.mechanics.extra_hits) {
                    // Trigger if:
                    // 1. trigger_hit_index is undefined or null (triggers on ALL hits)
                    // 2. trigger_hit_index is 'all'
                    // 3. trigger_hit_index matches current hitIndex
                    const shouldTrigger = 
                        extra.trigger_hit_index === undefined || 
                        extra.trigger_hit_index === null || 
                        extra.trigger_hit_index === 'all' ||
                        extra.trigger_hit_index === event.hitIndex;

                    if (shouldTrigger) {
                        // Support multiple hits per trigger (default 1)
                        const hitCount = extra.hit_count || 1;
                        
                        // Calculate single hit damage
                        // Use effectiveDef instead of def
                        const extraDmg = Math.max(1, Math.floor((context.stats.baseAtk * context.stats.atkMult * extra.multiplier) - context.stats.effectiveDef));
                        
                        for (let k = 0; k < hitCount; k++) {
                            // Push separate hit entry for clarity
                            results.hits.push({
                                time: event.time / 1000.0,
                                damage: extraDmg,
                                type: 'extra',
                                note: extra.name + (hitCount > 1 ? ` (${k+1}/${hitCount})` : '')
                            });
                            results.totalDamage += extraDmg;
                        }
                        note += ` + ${extra.name}${hitCount > 1 ? `(x${hitCount})` : ''}`;
                    }
                }
            }
        }
        else if (event.type === 'periodic') {
            // 2B Summons
            const data = event.data;
            // Periodic damage often ignores defense or has low multiplier
            const effectiveAtk = context.stats.baseAtk * context.stats.atkMult * data.multiplier;
            damage = Math.max(1, Math.floor(effectiveAtk - context.stats.effectiveDef)); // Assuming def applies
            note = data.name;
        }

        if (damage > 0) {
            results.hits.push({
                time: event.time / 1000.0,
                damage: damage,
                type: event.type,
                hitIndex: event.hitIndex, // Add hitIndex for debugging
                note: note
            });
            results.totalDamage += damage;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DamageEngine;
} else {
    window.DamageEngine = DamageEngine;
}

// Test
if (typeof require !== 'undefined' && require.main === module) {
    const engine = new DamageEngine();
    
    // 1. Levi Test (3s)
    console.log("--- Levi Test (Stacking) ---");
    const levi = engine.calculate('リヴァイ', 'normal', 200, { durationMs: 3000 });
    console.log(`Levi Total: ${levi.totalDamage}, Hits: ${levi.hits.length}`);
    console.log(levi.hits.map(h => `[${h.time}s] ${h.damage} ${h.note || ''}`).join('\n'));

    // 2. Noho Test (Speed)
    console.log("\n--- Noho Test (Speed) ---");
    const noho = engine.calculate('双挽乃保', 'normal', 200, { durationMs: 3000 });
    console.log(`Noho Total: ${noho.totalDamage}, Hits: ${noho.hits.length}`);
    
    // 3. 2B Test (Gatling)
    console.log("\n--- 2B Test (Gatling) ---");
    const b2 = engine.calculate('2B', 'normal', 200, { durationMs: 2000, variant: 'gatling' });
    console.log(`2B Total: ${b2.totalDamage}`);
    console.log(b2.hits.map(h => `[${h.time}s] ${h.damage} ${h.note || ''}`).join('\n'));

    // 4. Marcos Test (Variant/State)
    console.log("\n--- Marcos Test (State Change) ---");
    const marcosNormal = engine.calculate("マルコス'55", 'normal', 200, { durationMs: 1000 });
    const marcosPower = engine.calculate("マルコス'55", '1凸', 200, { durationMs: 1000 });
    console.log(`Normal Dmg (First Hit): ${marcosNormal.hits[0].damage}`);
    console.log(`Power (1凸) Dmg (First Hit): ${marcosPower.hits[0].damage}`);

    // 5. Ainz Test (Hit Override)
    console.log("\n--- Ainz Test (Hit Override) ---");
    // Use ID 'ainz' or full name "アインズ・ウール・ゴウン"
    const ainz = engine.calculate('ainz', 'normal', 200, { durationMs: 2000 });
    if (ainz.error) {
        console.error(ainz.error);
    } else {
        console.log(ainz.hits.map(h => `[Hit ${h.hitIndex}] Dmg: ${h.damage} ${h.note || ''}`).join('\n'));
    }
}
