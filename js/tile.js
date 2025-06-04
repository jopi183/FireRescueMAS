// Filename: /multiAgen/js/tile.js
export default class Tile {
    constructor(type = 'floor') {
        this.type = type;
        this.passability = this.getPassability(type);
        this.breakHP = this.getBreakHP(type);
        this.movable = false;
        this.visibility = 1.0;
        this.flammability = this.getFlammability(type);
        this.fireFuel = 0; // Sole source of truth for fire
        this.smokeLevel = 'None'; // 'None', 'Light', 'Heavy'
        this.isToxicFumes = false;
        this.dampness = 0; 
        this.structuralIntegrity = 100;
        this.hasDebris = false;
        this.isHole = false;
        this.heatExhausted = false; 
        this.ventilated = false;  
        // REMOVE any direct this.isOnFire = ... from here
    }

    getPassability(type) {
        const passabilityMap = {
            'floor': 1.0, 'corridor': 1.0, 'entrance': 1.0, 'toilet': 1.0,
            'furniture': 1.2, 'debris': 1.8, 'wall': Infinity, 'door': 1.0,
            'window': 1.0, 'chemcab': 1.0
        };
        return passabilityMap[type] || 1.0;
    }

    getBreakHP(type) {
        const breakHPMap = {
            'window': 10, 'door': 20, 'chemcab': 25, 'wall': 80
        };
        return breakHPMap[type] || 0;
    }

    getFlammability(type) {
        const flammabilityMap = {
            'floor': 1, 'furniture': 3, 'door': 2, 'wall': 0, 'chemcab': 4
        };
        return flammabilityMap[type] || 1;
    }

    // This getter is the correct way to check if a tile is on fire
    get isOnFire() {
        return this.fireFuel > 0;
    }

    ignite() {
        // Use the getter 'this.isOnFire' for checking current state
        if (this.flammability > 0 && !this.isOnFire && this.dampness < 5) {
            this.fireFuel = 30; // Set fuel. The getter will now report true.
            // DO NOT set this.isOnFire = true here if you have the getter.
            return true;
        }
        return false;
    }
}