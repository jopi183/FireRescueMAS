// js/RLAgent.js
import Agent from './agent.js';

export const RL_ACTIONS = {
    MOVE_UP: 0,
    MOVE_DOWN: 1,
    MOVE_LEFT: 2,
    MOVE_RIGHT: 3,
    EXTINGUISH: 4,
    REFILL_WATER: 5,
    WAIT: 6,
    // PICKUP_VICTIM: 7, // TODO for RescuerRLAgent
};
const NUM_ACTIONS = Object.keys(RL_ACTIONS).length;

// Base class for all RL-controlled agents
export class RLAgentBase extends Agent {
    constructor(type, row, col, rlParams) {
        console.log(`RLAgentBase constructor calling super with type: "${type}", row: ${row}, col: ${col}`);
        super(type, row, col);
        this.isRLControlled = true;
        this.rlParams = rlParams; // Reference to global/shared RL parameters from SimulationApp
        this.qTable = this.rlParams.qTable || {}; // Agent uses the Q-table passed in rlParams
        // ID is set by super constructor. Log it here to confirm.
        console.log(`RLAgentBase instance created. Type from super: "${this.type}", ID from super: "${this.id}"`);
    }

    getAbstractState(environment) {
        const tile = environment.getTile(this.row, this.col);
        let fireDirection = 0; 
        let nearestFireDist = Infinity;

        for(let r=0; r<environment.height; r++) {
            for(let c=0; c<environment.width; c++) {
                if(environment.grid[r][c].isOnFire) {
                    const dist = Math.hypot(this.row-r, this.col-c);
                    if(dist < nearestFireDist) {
                        nearestFireDist = dist;
                        if (r < this.row && Math.abs(this.row-r) >= Math.abs(this.col-c)) fireDirection = 0; // North dominant
                        else if (c > this.col && Math.abs(this.col-c) > Math.abs(this.row-r)) fireDirection = 1; // East dominant
                        else if (r > this.row && Math.abs(this.row-r) >= Math.abs(this.col-c)) fireDirection = 2; // South dominant
                        else if (c < this.col && Math.abs(this.col-c) > Math.abs(this.row-r)) fireDirection = 3; // West dominant
                        else if (r === this.row && c === this.col) fireDirection = 4; // Here
                        else { // Diagonal cases, pick one based on primary axis or default
                            if (r < this.row) fireDirection = 0; // Prefer N/S for diagonals
                            else if (r > this.row) fireDirection = 2;
                            else if (c > this.col) fireDirection = 1;
                            else if (c < this.col) fireDirection = 3;
                        }
                    }
                }
            }
        }
        if (nearestFireDist === Infinity) fireDirection = 5; 

        const waterLvl = this.maxWater > 0 ? Math.floor((this.water / this.maxWater) * 3) : 0; 
        const hpLvl = Math.floor((this.hp / this.maxHP) * 3);
        const scbaLvl = this.maxSCBA > 0 ? Math.floor((this.scba / this.maxSCBA) * 2) : 0; 

        const tileSmokeLevel = tile ? (tile.smokeLevel ? tile.smokeLevel[0] : 'N') : 'U'; // U for unknown/off-grid

        return `r${this.row}c${this.col}_w${waterLvl}_h${hpLvl}_s${scbaLvl}_fd${fireDirection}_smk${tileSmokeLevel}`;
    }

    chooseAction(state, environment, epsilon, forceExploit = false) {
        const possibleActions = this.getPossibleActions(environment);
        if (possibleActions.length === 0) return RL_ACTIONS.WAIT; 

        if (!forceExploit && Math.random() < epsilon) {
            return possibleActions[Math.floor(Math.random() * possibleActions.length)];
        } else {
            const stateQValues = this.qTable[state] || {};
            let bestAction = possibleActions[0]; 
            let maxQValue = -Infinity;
            let firstActionFound = false;

            for (const actionId of possibleActions) {
                const qValue = stateQValues[actionId] || 0; 
                if (!firstActionFound || qValue > maxQValue) {
                    maxQValue = qValue;
                    bestAction = actionId;
                    firstActionFound = true;
                } else if (qValue === maxQValue && Math.random() < 0.5) { 
                    bestAction = actionId;
                }
            }
            return bestAction;
        }
    }

    getPossibleActions(environment) {
        const actions = [RL_ACTIONS.WAIT]; 
        if (environment.isValidPosition(this.row - 1, this.col) && !environment.getAgentAt(this.row - 1, this.col)) actions.push(RL_ACTIONS.MOVE_UP);
        if (environment.isValidPosition(this.row + 1, this.col) && !environment.getAgentAt(this.row + 1, this.col)) actions.push(RL_ACTIONS.MOVE_DOWN);
        if (environment.isValidPosition(this.row, this.col - 1) && !environment.getAgentAt(this.row, this.col - 1)) actions.push(RL_ACTIONS.MOVE_LEFT);
        if (environment.isValidPosition(this.row, this.col + 1) && !environment.getAgentAt(this.row, this.col + 1)) actions.push(RL_ACTIONS.MOVE_RIGHT);

        if (this.type === 'firefighter') {
            if (this.water > 0) {
                const directions = [[0,0],[-1,0], [1,0], [0,-1], [0,1]];
                for (let [dr, dc] of directions) {
                    const fireTile = environment.getTile(this.row + dr, this.col + dc);
                    if (fireTile && fireTile.isOnFire) {
                        actions.push(RL_ACTIONS.EXTINGUISH);
                        break;
                    }
                }
            }
            if (environment.getTile(this.row, this.col)?.type === 'toilet' && this.water < this.maxWater) {
                actions.push(RL_ACTIONS.REFILL_WATER);
            }
        }
        return [...new Set(actions)]; 
    }

    learn(state, action, reward, nextState, environmentForNextStateActions, alpha, gamma, currentEpsilonForNextAction, nextActionForSARSA = null) {
        const oldQValue = (this.qTable[state] && this.qTable[state][action] !== undefined) ? this.qTable[state][action] : 0;
        let targetQValueProduct; 

        if (this.rlParams.algorithm === 'sarsa' && nextActionForSARSA !== null) {
            const nextQValueForSARSA = (this.qTable[nextState] && this.qTable[nextState][nextActionForSARSA] !== undefined) ? this.qTable[nextState][nextActionForSARSA] : 0;
            targetQValueProduct = reward + gamma * nextQValueForSARSA;
        } else { 
            let maxNextQValue = 0;
            const nextStateQValues = this.qTable[nextState];
            const possibleActionsFromNextState = this.getPossibleActions(environmentForNextStateActions); // Pass current env state for next actions
            
            if (possibleActionsFromNextState.length > 0) {
                 let firstPossibleQFound = false;
                 maxNextQValue = -Infinity; // Initialize to -Infinity to correctly find max if all Qs are negative
                 for (const nextAct of possibleActionsFromNextState) {
                    const qVal = (nextStateQValues && nextStateQValues[nextAct] !== undefined) ? nextStateQValues[nextAct] : 0;
                    if (!firstPossibleQFound) {
                        maxNextQValue = qVal;
                        firstPossibleQFound = true;
                    } else {
                        maxNextQValue = Math.max(maxNextQValue, qVal);
                    }
                 }
                 if (!firstPossibleQFound) maxNextQValue = 0; // If no actions or no Q-values, default to 0
            }
            targetQValueProduct = reward + gamma * maxNextQValue;
        }

        if (!this.qTable[state]) {
            this.qTable[state] = {};
        }
        this.qTable[state][action] = oldQValue + alpha * (targetQValueProduct - oldQValue);
    }

    resetForEpisode() {
        // Placeholder for any agent-specific reset logic
    }
}

// Specific RL Agent type
export class FirefighterRLAgent extends RLAgentBase {
    constructor(row, col, rlParams) {
        console.log(`FirefighterRLAgent constructor called with row: ${row}, col: ${col}`);
        super('firefighter', row, col, rlParams);
        this.maxSCBA = 60;
        console.log(`FirefighterRLAgent instance created. Actual Type from super: "${this.type}", ID from super: "${this.id}"`);
    }
}