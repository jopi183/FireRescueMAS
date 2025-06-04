// Filename: /multiAgen/js/environment.js
import Tile from './tile.js';
import Agent from './agent.js';
import { RLAgentBase, FirefighterRLAgent, RL_ACTIONS } from './RLAgent.js';

export default class Environment {
    constructor(width = 20, height = 15, logger, rlParams = null, useRLAgents = false) {
        this.width = width;
        this.height = height;
        this.grid = [];
        this.agents = [];
        this.logger = logger;
        this.rlParams = rlParams || {}; 
        this.useRLAgents = useRLAgents; 
        // console.log(`Environment constructor: useRLAgents = ${this.useRLAgents}`); // Kept for debugging
    }

    reset(isTrainingEpisode = false) {
        // console.log("Environment reset called. isTrainingEpisode:", isTrainingEpisode); // Kept for debugging
        this.initializeGrid();
        this.spawnAgents(); 
        this.startFires();
        
        this.agents.forEach(agent => {
            agent.initStats(agent.type); 
            agent.panic = 0;
            agent.unconscious = false;
            agent.dead = false;
            agent.leadingVictim = null;
            agent.rescued = false;
            if (agent.isRLControlled && typeof agent.resetForEpisode === 'function') {
                agent.resetForEpisode(); 
            }
        });
        if (isTrainingEpisode && this.logger) this.logger("Env reset for training episode.", "info");
        // console.log("Environment reset complete. Agents count:", this.agents.length); // Kept for debugging
    }


    initializeGrid() {
        this.grid = []; 
        for (let row = 0; row < this.height; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.width; col++) {
                let tileType = 'floor';
                if (row === 0 || row === this.height - 1 || col === 0 || col === this.width - 1) tileType = 'wall';
                if (row === 7 && col > 2 && col < this.width - 3) tileType = 'wall';
                if (col === 10 && row > 2 && row < this.height - 3 && row !== 7) tileType = 'wall';
                if ((row === 7 && (col === 5 || col === 15)) || (col === 10 && (row === 4 || row === 10))) tileType = 'door';
                
                if (row === this.height - 1 && col === 1) tileType = 'entrance'; 
                if (row === this.height - 1 && col === Math.floor(this.width / 2)) tileType = 'entrance';

                if (row === 0 && (col === 5 || col === 15)) tileType = 'window';
                if (row === 2 && col === 2) tileType = 'toilet';
                if (row === 2 && col === this.width - 3) tileType = 'chemcab'; 
                if ((row === 3 && col === 6) || (row === 9 && col === 14)) tileType = 'furniture';
                this.grid[row][col] = new Tile(tileType);
            }
        }
        const centralEntranceCol = Math.floor(this.width / 2);
        this.grid[this.height-1][centralEntranceCol] = new Tile('entrance');
        if(this.height > 1) this.grid[this.height-2][centralEntranceCol] = new Tile('floor');
        
        this.grid[this.height-1][1] = new Tile('entrance');
        if(this.height > 1) this.grid[this.height-2][1] = new Tile('floor');
    }

    spawnAgents() {
        this.agents = [];
        // console.log(`spawnAgents: this.useRLAgents is ${this.useRLAgents}. FirefighterRLAgent defined: ${!!FirefighterRLAgent}`); // Kept

        const firefighterSpawns = [ { r: this.height - 2, c: 1 } ];
        const rescuerSpawns = [ { r: this.height - 2, c: 2 } ];
        const victimSpawns = [
            { r: 3, c: 8 }, { r: 5, c: 15 },
            { r: 9, c: 6 }, { r: 11, c: this.width - 4 },
        ];

        firefighterSpawns.forEach((pos, index) => {
            // console.log(`Spawning firefighter ${index} at r:${pos.r}, c:${pos.c}`); // Kept
            if (this.useRLAgents && FirefighterRLAgent) { 
                // console.log("  Creating FirefighterRLAgent"); // Kept
                const agentRLParams = { ...this.rlParams };
                this.agents.push(new FirefighterRLAgent(pos.r, pos.c, agentRLParams));
            } else {
                // console.log("  Creating standard Firefighter Agent"); // Kept
                this.agents.push(new Agent('firefighter', pos.r, pos.c));
            }
        });

        rescuerSpawns.forEach((pos, index) => {
            // console.log(`Spawning rescuer ${index} at r:${pos.r}, c:${pos.c}`); // Kept
            // console.log("  Creating standard Rescuer Agent"); // Kept
            this.agents.push(new Agent('rescuer', pos.r, pos.c));
        });

        victimSpawns.forEach((pos, index) => {
            // console.log(`Spawning victim ${index} at r:${pos.r}, c:${pos.c}`); // Kept
            // console.log("  Creating standard Victim Agent"); // Kept
            this.agents.push(new Agent('victim', pos.r, pos.c));
        });
        // console.log("spawnAgents complete. Total agents:", this.agents.length); // Kept
        // this.agents.forEach((agent, i) => { // Kept
        //     if (agent && agent.type && agent.id) {
        //         console.log(`  Agent ${i}: type="${agent.type}", id="${agent.id}", isRLControlled="${agent.isRLControlled}"`);
        //     } else {
        //         console.error(`  spawnAgents check: Agent ${i} has missing properties immediately after creation! Agent object:`, agent);
        //     }
        // });
    }


    startFires() {
        const fireLocations = [
            {r: 4, c: 7}, {r:10, c:14}, {r:6, c: this.width - 5}
        ];
        fireLocations.forEach(loc => {
            const tile = this.getTile(loc.r, loc.c);
            if (tile && tile.type !== 'wall') tile.ignite();
        });
    }

    getTile(row, col) {
        if (row >= 0 && row < this.height && col >= 0 && col < this.width) {
            return this.grid[row][col];
        }
        return null;
    }

    hasAdjacentFire(row, col) {
        const directions = [[-1,0], [1,0], [0,-1], [0,1]]; 
        for (let [dr, dc] of directions) {
            const tile = this.getTile(row + dr, col + dc);
            if (tile && tile.isOnFire) return true; // Uses getter
        }
        return false;
    }

    updateFire() {
        const newFires = [];
        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {
                const tile = this.grid[r][c];
                if (tile.isOnFire) { // Uses getter
                    tile.fireFuel = Math.max(0, tile.fireFuel - 1); 
                    if (tile.fireFuel === 0) { // Check fuel to determine if fire is out
                        tile.smokeLevel = 'Light'; 
                        // REMOVED: tile.isOnFire = false; (getter handles this)
                    } else {
                         tile.smokeLevel = 'Heavy';
                    }

                    const directions = [[-1,0], [1,0], [0,-1], [0,1]];
                    for (let [dr, dc] of directions) {
                        const targetTile = this.getTile(r + dr, c + dc);
                        if (targetTile && !targetTile.isOnFire && targetTile.flammability > 0 && targetTile.type !== 'wall') { // Uses getter
                            const igniteChance = 0.05 * targetTile.flammability * (1 - targetTile.dampness / 10);
                            if (Math.random() < igniteChance) newFires.push({r: r + dr, c: c + dc});
                        }
                    }
                }
                tile.dampness = Math.max(0, tile.dampness - 0.5); 
            }
        }
        for (let fireLoc of newFires) this.getTile(fireLoc.r, fireLoc.c)?.ignite();
    }

    updateSmoke() {
        const nextSmokeGrid = this.grid.map(row => row.map(tile => tile.smokeLevel));
        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {
                const currentTile = this.grid[r][c];
                if (currentTile.isOnFire) { // Uses getter
                    nextSmokeGrid[r][c] = 'Heavy';
                    continue;
                }
                if (currentTile.smokeLevel === 'Heavy' && Math.random() < 0.1) nextSmokeGrid[r][c] = 'Light';
                else if (currentTile.smokeLevel === 'Light' && Math.random() < 0.15) nextSmokeGrid[r][c] = 'None';

                const directions = [[-1,0], [1,0], [0,-1], [0,1]];
                for (let [dr, dc] of directions) {
                    const neighborTile = this.getTile(r + dr, c + dc);
                    if (neighborTile && neighborTile.passability < Infinity && neighborTile.type !== 'wall') {
                        if (neighborTile.smokeLevel === 'Heavy' && Math.random() < 0.25) { 
                            if (nextSmokeGrid[r][c] !== 'Heavy') nextSmokeGrid[r][c] = 'Heavy';
                        } else if (neighborTile.smokeLevel === 'Light' && Math.random() < 0.15) { 
                            if (nextSmokeGrid[r][c] === 'None') nextSmokeGrid[r][c] = 'Light';
                        }
                    }
                }
            }
        }
        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {
                this.grid[r][c].smokeLevel = nextSmokeGrid[r][c];
            }
        }
    }

    applyHazardDamage() {
        for (let agent of this.agents) {
            if (agent.dead || agent.unconscious) continue;
            const tile = this.getTile(agent.row, agent.col);
            if (!tile) continue;

            let damage = 0;
            agent.tookDamageThisTurn = false; 
            if (tile.isOnFire) { damage = Math.max(damage, 10); agent.tookDamageThisTurn = true; } // Uses getter
            else if (this.hasAdjacentFire(agent.row, agent.col)) { damage = Math.max(damage, 2); agent.tookDamageThisTurn = true;} 

            let consumeSCBA = false;
            if (tile.smokeLevel === 'Heavy') {
                if (agent.scba <= 0 || agent.type === 'victim') { damage = Math.max(damage, 3); agent.tookDamageThisTurn = true; }
                consumeSCBA = true;
            } else if (tile.smokeLevel === 'Light') {
                if (agent.scba <= 0 || agent.type === 'victim') { damage = Math.max(damage, 1); agent.tookDamageThisTurn = true; }
                consumeSCBA = true;
            }
            if (tile.isToxicFumes) { 
                if (agent.scba <= 0 || agent.type === 'victim') { damage = Math.max(damage, 5); agent.tookDamageThisTurn = true; }
                consumeSCBA = true;
            }

            if (damage > 0) agent.takeDamage(damage);
            
            if (agent.scba > 0 && agent.type !== 'victim' && consumeSCBA) {
                agent.scba--;
            }
            agent.updatePanic(this); 
        }
    }
    
    performRuleBasedAgentActions() {
        const shuffledAgents = [...this.agents].filter(a => !a.isRLControlled || !this.useRLAgents)
                                            .sort(() => Math.random() - 0.5);
        for (let agent of shuffledAgents) {
            if (agent.dead || agent.unconscious) continue;
            if (agent.type === 'firefighter') this.firefighterAI(agent);
            else if (agent.type === 'rescuer') this.rescuerAI(agent);
            else if (agent.type === 'victim') this.victimAI(agent);
        }
    }

    performRLAgentActionsExploit(currentEpsilonForExploit) {
        const rlAgents = this.agents.filter(a => a.isRLControlled && this.useRLAgents);
        for (const agent of rlAgents) {
            if (agent.dead || agent.unconscious) continue;
            const state = agent.getAbstractState(this);
            const action = agent.chooseAction(state, this, currentEpsilonForExploit, true); 
            this.executeAgentActionAndGetReward(agent, action, false); 
        }
    }
    
    updateAgents(currentEpsilonForExploit = 0.01) {
        if (this.useRLAgents) {
            this.performRLAgentActionsExploit(currentEpsilonForExploit);
        }
        this.performRuleBasedAgentActions(); 
    }

    executeAgentActionAndGetReward(agent, actionId, isTraining = true) {
        let reward = isTraining ? -0.1 : 0; 
        const oldPos = { r: agent.row, c: agent.col };

        let actionTaken = false;
        agent.actionCost = 1; 

        switch (actionId) {
            case RL_ACTIONS.MOVE_UP:
                if (this.isValidPosition(agent.row - 1, agent.col) && !this.getAgentAt(agent.row - 1, agent.col)) { agent.row--; actionTaken = true; } 
                else if(isTraining) reward -= 1.0; 
                break;
            case RL_ACTIONS.MOVE_DOWN:
                if (this.isValidPosition(agent.row + 1, agent.col) && !this.getAgentAt(agent.row + 1, agent.col)) { agent.row++; actionTaken = true; } 
                else if(isTraining) reward -= 1.0;
                break;
            case RL_ACTIONS.MOVE_LEFT:
                if (this.isValidPosition(agent.row, agent.col - 1) && !this.getAgentAt(agent.row, agent.col - 1)) { agent.col--; actionTaken = true; } 
                else if(isTraining) reward -= 1.0;
                break;
            case RL_ACTIONS.MOVE_RIGHT:
                if (this.isValidPosition(agent.row, agent.col + 1) && !this.getAgentAt(agent.row, agent.col + 1)) { agent.col++; actionTaken = true; } 
                else if(isTraining) reward -= 1.0;
                break;
            case RL_ACTIONS.EXTINGUISH:
                agent.actionCost = 5; 
                if (agent.type === 'firefighter' && agent.water > 0) {
                    let extinguishedSomethingThisAction = false;
                    const directions = [[0,0],[-1,0], [1,0], [0,-1], [0,1]]; 
                    for (let [dr, dc] of directions) {
                        const fireTile = this.getTile(oldPos.r + dr, oldPos.c + dc);
                        if (fireTile && fireTile.isOnFire) { // Uses getter
                            fireTile.fireFuel = Math.max(0, fireTile.fireFuel - 20); 
                            fireTile.dampness = 15;
                            extinguishedSomethingThisAction = true;
                            if (fireTile.fireFuel === 0) { // Check fuel
                                // REMOVED: fireTile.isOnFire = false;
                                if (isTraining) reward += 15.0; 
                            } else if (isTraining) {
                                reward += 5.0; 
                            }
                        }
                    }
                    if (extinguishedSomethingThisAction) { agent.water = Math.max(0, agent.water - 5); actionTaken = true; }
                    else if(isTraining) reward -= 2.0; 
                } else if(isTraining) reward -= 1.0; 
                break;
            case RL_ACTIONS.REFILL_WATER:
                agent.actionCost = 2; 
                if (agent.type === 'firefighter' && this.getTile(oldPos.r, oldPos.c)?.type === 'toilet' && agent.water < agent.maxWater) {
                    agent.water = agent.maxWater;
                    actionTaken = true;
                    if (isTraining) reward += 8.0; 
                } else if(isTraining) reward -= 1.0; 
                break;
            case RL_ACTIONS.WAIT:
                actionTaken = true; 
                agent.actionCost = 0; 
                if (isTraining) reward += 0; 
                break;
            default:
                if(isTraining) reward -= 0.5; 
        }
        
        if (actionTaken) {
            const tileMovedTo = (actionId >= RL_ACTIONS.MOVE_UP && actionId <= RL_ACTIONS.MOVE_RIGHT) ? this.getTile(agent.row, agent.col) : null;
            const passabilityCost = tileMovedTo ? (tileMovedTo.passability || 1) : 0; 
            agent.sp = Math.max(0, agent.sp - (agent.actionCost + passabilityCost));
        }
        return reward; 
    }

    updateWorldStateStep() {
        this.updateFire();
        this.updateSmoke();
        this.applyHazardDamage(); 
    }

    firefighterAI(agent) { 
        agent.sp = Math.max(0, agent.sp - 1);
        if (agent.water <= 20 && agent.maxWater > 0) {
            const toilet = this.findNearestTileByType(agent, 'toilet');
            if (toilet) {
                if (this.isAdjacent(agent.row, agent.col, toilet.row, toilet.col) || (agent.row === toilet.row && agent.col === toilet.col)) {
                    agent.water = Math.min(agent.maxWater, agent.water + 30);
                    agent.sp = Math.max(0, agent.sp - 2);
                } else this.moveAgentTowardRuleBased(agent, toilet.row, toilet.col);
                return;
            }
        }
        const fire = this.findNearestFire(agent);
        if (fire) {
            if (this.isAdjacent(agent.row, agent.col, fire.row, fire.col)) {
                if (agent.water >= 5) {
                    agent.water -= 5;
                    agent.sp = Math.max(0, agent.sp - 5);
                    const fireTile = this.getTile(fire.row, fire.col);
                    if (fireTile) {
                        fireTile.fireFuel = Math.max(0, fireTile.fireFuel - 15);
                        fireTile.dampness = 10;
                        // REMOVED: if (fireTile.fireFuel === 0) fireTile.isOnFire = false;
                    }
                }
            } else this.moveAgentTowardRuleBased(agent, fire.row, fire.col);
        } else {
            const entrance = this.findNearestTileByType(agent, 'entrance');
            if(entrance) this.moveAgentTowardRuleBased(agent, entrance.row > 0 ? entrance.row -1 : entrance.row, entrance.col); 
            else this.moveAgentRandomlyRuleBased(agent);
        }
    }

    rescuerAI(agent) {
        agent.sp = Math.max(0, agent.sp - 1);
        const entrance = this.findNearestTileByType(agent, 'entrance'); 
        let targetEntrancePos = entrance ? {row: entrance.row > 0 ? entrance.row -1 : entrance.row, col: entrance.col} : {row: this.height -2, col: 1}; 

        if (agent.leadingVictim) {
            const tileBelow = this.getTile(agent.row + 1, agent.col); 
            let isAtCorrectEntranceSpot = false;
            if (tileBelow && tileBelow.type === 'entrance') { 
                 if (agent.row === tileBelow.row -1 && agent.col === tileBelow.col) {
                    isAtCorrectEntranceSpot = true;
                 }
            }
            if (!isAtCorrectEntranceSpot && agent.row === targetEntrancePos.row && agent.col === targetEntrancePos.col) {
                 const primaryEntranceTileBelow = this.getTile(targetEntrancePos.row + 1, targetEntrancePos.col);
                 if (primaryEntranceTileBelow && primaryEntranceTileBelow.type === 'entrance') {
                    isAtCorrectEntranceSpot = true;
                 }
            }

            if (isAtCorrectEntranceSpot) {
                agent.leadingVictim.rescued = true;
                if(this.logger && agent.leadingVictim && agent.leadingVictim.id && agent.id) {
                     this.logger(`Victim (ID ${agent.leadingVictim.id.slice(-4)}) rescued by Rescuer (ID ${agent.id.slice(-4)})!`, 'success');
                } else if (this.logger) {
                    this.logger('Victim rescued (ID info missing for log).', 'success');
                }


                agent.leadingVictim.leadingVictim = null; 
                agent.leadingVictim = null; 
                agent.sp = Math.max(0, agent.sp - 2);
            } else {
                this.moveAgentTowardRuleBased(agent, targetEntrancePos.row, targetEntrancePos.col);
                if (agent.leadingVictim && !agent.leadingVictim.dead && !agent.leadingVictim.rescued) {
                    const victim = agent.leadingVictim;
                    const directions = [[-1,0],[1,0],[0,-1],[0,1]]; 
                    let placed = false;
                    for(let [dr,dc] of directions.sort(()=> Math.random()-0.5)) { 
                        const vr = agent.row + dr; 
                        const vc = agent.col + dc;
                        const occupant = this.getAgentAt(vr, vc);
                        if (this.isValidPosition(vr, vc) && 
                            (!occupant || occupant === victim) && 
                            (vr !== agent.row || vc !== agent.col) ) { 
                            
                            if(vr !== victim.row || vc !== victim.col) { 
                                victim.row = vr;
                                victim.col = vc;
                            }
                            placed = true;
                            break;
                        }
                    }
                }
            }
        } else {
            const victimToRescue = this.findNearestVictimRuleBased(agent); 
            if (victimToRescue) {
                if (this.isAdjacent(agent.row, agent.col, victimToRescue.row, victimToRescue.col) || (agent.row === victimToRescue.row && agent.col === victimToRescue.col)) {
                    if (!victimToRescue.dead && !victimToRescue.rescued) {
                        agent.leadingVictim = victimToRescue;
                        victimToRescue.leadingVictim = agent; 
                        agent.sp = Math.max(0, agent.sp - 3);
                    }
                } else {
                    this.moveAgentTowardRuleBased(agent, victimToRescue.row, victimToRescue.col);
                }
            } else { 
                 this.moveAgentTowardRuleBased(agent, targetEntrancePos.row, targetEntrancePos.col);
            }
        }
    }

    victimAI(agent) {
        agent.sp = Math.max(0, agent.sp - 1);
        if (agent.rescued || agent.leadingVictim) return; 

        const currentTile = this.getTile(agent.row, agent.col);
        if (currentTile && (currentTile.isOnFire || currentTile.smokeLevel === 'Heavy' || this.hasAdjacentFire(agent.row, agent.col))) {
            this.moveAgentToSafetyRuleBased(agent);
        } else {
            const rescuer = this.findNearestRescuerRuleBased(agent);
            if (rescuer && Math.hypot(agent.row - rescuer.row, agent.col - rescuer.col) < 7) { 
                this.moveAgentTowardRuleBased(agent, rescuer.row, rescuer.col);
            } else {
                const entrance = this.findNearestTileByType(agent, 'entrance');
                if (entrance) this.moveAgentTowardRuleBased(agent, entrance.row > 0 ? entrance.row -1: entrance.row, entrance.col); 
                else this.moveAgentRandomlyRuleBased(agent);
            }
        }
    }

    moveAgentRandomlyRuleBased(agent) {
        const directions = [[-1,0], [1,0], [0,-1], [0,1]];
        const validMoves = [];
        for(const [dr,dc] of directions) {
            const newRow = agent.row + dr, newCol = agent.col + dc;
            if (this.isValidPosition(newRow, newCol) && !this.getAgentAt(newRow, newCol)) {
                validMoves.push({r: newRow, c: newCol});
            }
        }
        if (validMoves.length > 0) {
            const move = validMoves[Math.floor(Math.random() * validMoves.length)];
            const moveCost = (this.getTile(move.r, move.c)?.passability || 1);
            if (agent.sp >= moveCost) {
                agent.row = move.r; agent.col = move.c;
                agent.sp -= moveCost;
            }
        }
    }
    
    moveAgentTowardRuleBased(agent, targetRow, targetCol) {
        if (agent.row === targetRow && agent.col === targetCol) return;
        const directions = [[-1,0], [1,0], [0,-1], [0,1]];
        let bestMove = null;
        let minDistance = Infinity;

        for (let [dr, dc] of directions) {
            const newRow = agent.row + dr;
            const newCol = agent.col + dc;
            if (this.isValidPosition(newRow, newCol) && !this.getAgentAt(newRow, newCol)) {
                const dist = Math.hypot(newRow - targetRow, newCol - targetCol);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestMove = { row: newRow, col: newCol };
                } else if (dist === minDistance && Math.random() < 0.3) {
                    bestMove = { row: newRow, col: newCol };
                }
            }
        }
        if (bestMove && agent.getEffectiveSpeed() >= 0.5) {
            const moveCost = (this.getTile(bestMove.row, bestMove.col)?.passability || 1) * 1.5;
             if (agent.sp >= moveCost) {
                agent.row = bestMove.row; agent.col = bestMove.col;
                agent.sp -= moveCost;
            }
        }
    }

    moveAgentToSafetyRuleBased(agent) {
        const directions = [[-1,0], [1,0], [0,-1], [0,1]];
        let bestMove = null;
        let maxSafetyScore = -Infinity;

        for (let [dr, dc] of directions) {
            const newRow = agent.row + dr;
            const newCol = agent.col + dc;
            if (this.isValidPosition(newRow, newCol) && !this.getAgentAt(newRow, newCol)) {
                const tile = this.getTile(newRow, newCol);
                let safetyScore = 0;
                if (!tile.isOnFire) safetyScore += 5; else safetyScore -= 10; // Uses getter
                if (tile.smokeLevel === 'None') safetyScore += 3;
                else if (tile.smokeLevel === 'Light') safetyScore += 1; else safetyScore -= 2;
                if (!this.hasAdjacentFire(newRow, newCol)) safetyScore += 2; else safetyScore -=3;
                
                if (safetyScore > maxSafetyScore) {
                    maxSafetyScore = safetyScore;
                    bestMove = { row: newRow, col: newCol };
                } else if (safetyScore === maxSafetyScore && Math.random() < 0.5) { 
                     bestMove = { row: newRow, col: newCol };
                }
            }
        }
        if (bestMove) {
            const moveCost = (this.getTile(bestMove.row, bestMove.col)?.passability || 1) * 2;
             if (agent.sp >= moveCost) {
                agent.row = bestMove.row; agent.col = bestMove.col;
                agent.sp -= moveCost;
            }
        } else {
            this.moveAgentRandomlyRuleBased(agent); 
        }
    }
    
    findNearestTileByType(agent, tileType) {
        let nearest = null, minDist = Infinity;
        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {
                if (this.grid[r][c].type === tileType) {
                    const dist = Math.hypot(r - agent.row, c - agent.col);
                    if (dist < minDist) { minDist = dist; nearest = { row: r, col: c, tile: this.grid[r][c] }; }
                }
            }
        }
        return nearest;
    }

    findNearestFire(agent) { 
        let nearest = null, minDist = Infinity;
        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {
                if (this.grid[r][c].isOnFire) { // Uses getter
                    const dist = Math.hypot(r - agent.row, c - agent.col);
                    if (dist < minDist) { minDist = dist; nearest = { row: r, col: c }; }
                }
            }
        }
        return nearest;
    }
    findNearestVictimRuleBased(rescuerAgent) {
        let nearest = null, minDist = Infinity;
        for (let agent of this.agents) {
            if (agent.type === 'victim' && !agent.dead && !agent.rescued && !agent.leadingVictim) {
                const dist = Math.hypot(agent.row - rescuerAgent.row, agent.col - rescuerAgent.col);
                if (dist < minDist) { minDist = dist; nearest = agent; }
            }
        }
        return nearest;
    }
    
    findNearestRescuerRuleBased(victimAgent) {
        let nearest = null, minDist = Infinity;
        for (let agent of this.agents) {
            if (agent.type === 'rescuer' && !agent.dead && !agent.leadingVictim) {
                const dist = Math.hypot(agent.row - victimAgent.row, agent.col - victimAgent.col);
                if (dist < minDist) { minDist = dist; nearest = agent; }
            }
        }
        return nearest;
    }

    isValidPosition(row, col) {
        const tile = this.getTile(row, col);
        return tile && tile.passability < Infinity && tile.type !== 'wall';
    }

    isAdjacent(r1, c1, r2, c2) {
        return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
    }

    getAgentAt(row, col) {
        return this.agents.find(agent => agent.row === row && agent.col === col && !agent.dead);
    }
    
    update(currentEpsilonForExploit = 0.01) {
        this.updateAgents(currentEpsilonForExploit);
        this.updateFire();
        this.updateSmoke();
        this.applyHazardDamage();
        this.agents.forEach(agent => {
            if (!agent.dead && !agent.unconscious) agent.recoverStamina(1);
        });
    }

    getStats() {
        const stats = {
            victimsRescued: this.agents.filter(a => a.type === 'victim' && a.rescued).length,
            victimsRemaining: this.agents.filter(a => a.type === 'victim' && !a.rescued && !a.dead).length,
            victimsDead: this.agents.filter(a => a.type === 'victim' && a.dead).length,
            firesActive: 0,
            totalScore: 0
        };
        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {
                if (this.grid[r][c].isOnFire) stats.firesActive++; // Uses getter
            }
        }
        const totalVictims = this.agents.filter(a => a.type === 'victim').length;
        if (totalVictims > 0) {
            stats.totalScore = Math.round(
                (100 * (stats.victimsRescued / totalVictims)) - 
                (75 * (stats.victimsDead / totalVictims)) 
            );
        } else { 
            stats.totalScore = stats.firesActive === 0 ? 100 : Math.max(0, 100 - stats.firesActive * 10);
        }
        stats.totalScore = Math.max(0, stats.totalScore); 
        return stats;
    }

    isComplete(currentTurn, maxTurns = 300) {
        const victims = this.agents.filter(a => a.type === 'victim');
        const allVictimsHandled = victims.every(v => v.rescued || v.dead);
        const allFiresOut = this.getStats().firesActive === 0;
        const liveVictimsRemaining = victims.some(v => !v.rescued && !v.dead);

        if (currentTurn >= maxTurns) return true;

        if (victims.length === 0) { 
             return allFiresOut;
        }
        if (allFiresOut && !liveVictimsRemaining) return true;
        return allVictimsHandled;
    }

    isEpisodeCompleteForRL(currentStepInEpisode, maxStepsPerEpisode, specificAgent = null) {
        if (currentStepInEpisode >= maxStepsPerEpisode -1) return true; 

        const stats = this.getStats();

        if (specificAgent) { 
            if (specificAgent.dead) return true;
            if (specificAgent.type === 'firefighter' && stats.firesActive === 0) return true;
        } else { 
            const totalVictims = this.agents.filter(a => a.type === 'victim').length;
            const liveVictimsExist = this.agents.some(a => a.type === 'victim' && !a.dead && !a.rescued);

            if (stats.firesActive === 0) {
                if (totalVictims === 0 || !liveVictimsExist) { 
                    return true;
                }
            }
            
            const rlAgentsInSim = this.agents.filter(a => a.isRLControlled);
            if (rlAgentsInSim.length > 0 && rlAgentsInSim.every(a => a.dead)) return true;
        }
        return false;
    }
}