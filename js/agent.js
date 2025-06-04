// js/agent.js

// This is the base Agent class for rule-based agents (e.g., Victims)
// and serves as a superclass for RLAgentBase.
export default class Agent {
    constructor(type, row, col) {
        console.log(`Agent constructor called with type: "${type}", row: ${row}, col: ${col}`);
        if (typeof type !== 'string' || type === "") {
            console.error("AGENT CONSTRUCTOR: RECEIVED INVALID TYPE!", type);
            // Fallback to prevent further errors, though this indicates a deeper issue
            this.type = 'unknown_agent_error'; 
        } else {
            this.type = type;
        }
        this.row = row;
        this.col = col;

        // Ensure type is a string before using in template literal for id
        const idTypePrefix = typeof this.type === 'string' ? this.type : 'error_type';
        this.id = `${idTypePrefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        
        console.log(`Agent this.type set to: "${this.type}", this.id set to: "${this.id}"`);
        this.initStats(this.type); // Pass the potentially corrected this.type
        
        this.panic = 0; // 0-100
        this.inventory = null;
        this.unconscious = false;
        this.dead = false;
        this.leadingVictim = null; // For rescuers, or the agent leading this victim
        this.rescued = false; // For victims
        this.actionCost = 1; // SP cost for generic action, can be overridden
        this.tookDamageThisTurn = false; // For RL reward calculation

        this.isRLControlled = false; // Differentiates from RL agents
    }

    initStats(type) {
        // Ensure type is valid before accessing stats object
        const typeForStats = (typeof type === 'string' && type !== 'unknown_agent_error' && type !== 'error_type') ? type : 'victim'; // Fallback to victim if type is bad
        if (typeForStats !== type) {
            console.warn(`Agent initStats: Original type "${type}" was invalid, falling back to "${typeForStats}" for stats.`);
        }


        const stats = {
            'firefighter': { hp: 120, maxHP: 120, sp: 120, maxSP: 120, speed: 1.5, water: 100, maxWater: 100, scba: 60, maxSCBA: 60, panicK: 60 },
            'rescuer': { hp: 110, maxHP: 110, sp: 120, maxSP: 120, speed: 2.0, water: 40, maxWater: 40, scba: 60, maxSCBA: 60, panicK: 60 },
            'victim': { hp: 100, maxHP: 100, sp: 80, maxSP: 80, speed: 1.0, water: 0, maxWater: 0, scba: 0, maxSCBA: 0, panicK: 40 }
        };
        
        const stat = stats[typeForStats] || stats['victim']; // Default to victim stats if type unknown or error
        this.hp = stat.hp;
        this.maxHP = stat.maxHP;
        this.sp = stat.sp;
        this.maxSP = stat.maxSP;
        this.baseSpeed = stat.speed;
        this.water = stat.water;
        this.maxWater = stat.maxWater;
        this.scba = stat.scba;
        this.maxSCBA = stat.maxSCBA; // Store max SCBA for RL state representation
        this.panicK = stat.panicK;

        // Reset other relevant state for new episode/initialization
        this.unconscious = false;
        this.dead = false;
        this.leadingVictim = null;
        this.rescued = false;
        this.panic = 0;
    }

    getEffectiveSpeed() {
        if (this.unconscious || this.dead) return 0;
        
        let healthMult = this.hp >= (this.maxHP * 0.5) ? 1.0 : (this.hp >= (this.maxHP * 0.25) ? 0.8 : 0.6);
        let staminaMult = this.sp >= (this.maxSP * 0.3) ? 1.0 : 0.8;
        let waterCarryMult = (this.type === 'firefighter' && this.water > this.maxWater * 0.7) ? 0.9 : 1.0;
        let itemMult = this.inventory ? 0.9 : 1.0; 
        
        return Math.max(0.5, this.baseSpeed * healthMult * staminaMult * waterCarryMult * itemMult);
    }

    takeDamage(amount) {
        this.hp = Math.max(0, this.hp - amount);
        if (this.hp === 0 && !this.dead) { 
            this.dead = true;
            this.unconscious = true;
        }
    }

    recoverStamina(amount = 3) {
        if (this.dead) return;
        this.sp = Math.min(this.maxSP, this.sp + amount);
        if (this.sp >= (this.maxSP * 0.1) && this.unconscious && !this.dead) { 
            this.unconscious = false;
        }
    }

    getPanicProbability() {
        return 1 / (1 + Math.exp(-0.15 * (this.panic - this.panicK)));
    }

    updatePanic(environment) { 
        if (this.dead) {
            this.panic = 0;
            return;
        }
        let panicIncrease = 0;
        if (environment.hasAdjacentFire(this.row, this.col)) {
            panicIncrease += 3;
        }
        const currentTile = environment.getTile(this.row, this.col);
        if (currentTile) {
            if (currentTile.isOnFire) panicIncrease += 7; 
            if (currentTile.smokeLevel === 'Heavy') {
                panicIncrease += 5;
            } else if (currentTile.smokeLevel === 'Light') {
                panicIncrease += 2;
            }
        }
        if (this.hp < (this.maxHP * 0.25)) {
            panicIncrease += 7;
        }
        this.panic = Math.min(100, this.panic + panicIncrease);
        
        if (this.type === 'victim' && this.leadingVictim) { 
            this.panic = Math.max(0, this.panic - 10); 
        } else { 
            if (panicIncrease === 0 && this.panic > 0) {
                this.panic = Math.max(0, this.panic - 2);
            }
        }
    }
}