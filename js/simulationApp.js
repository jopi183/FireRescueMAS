import Environment from './environment.js';
import { RLAgentBase } from './RLAgent.js'; 

export default class SimulationApp {
    constructor() {
        this.environment = null;
        this.isRunning = false;
        this.isTraining = false;
        this.currentTurn = 0;
        this.animationId = null;
        this.gameSpeed = 100; 

        this.rlConfig = {
            algorithm: 'qlearning',
            numEpisodes: 1000,
            learningRate: 0.1,
            discountFactor: 0.9,
            epsilonStart: 1.0,
            epsilonDecay: 0.995,
            epsilonMin: 0.01,
            maxStepsPerEpisode: 200,
            qTable: {}, 
        };
        this.currentEpisode = 0;
        this.currentEpsilon = this.rlConfig.epsilonStart;
        this.trainingRewards = []; 

        this.bindDOM();
    }
    
    bindDOM() {
        this.simulationGridElement = document.getElementById('simulationGrid');
        this.turnCounterElement = document.getElementById('turnCounter');
        this.simStatusElement = document.getElementById('simStatus');
        this.victimsRescuedElement = document.getElementById('victimsRescued');
        this.victimsRemainingElement = document.getElementById('victimsRemaining');
        this.firesActiveElement = document.getElementById('firesActive');
        this.totalScoreElement = document.getElementById('totalScore');
        this.agentStatsContainerElement = document.getElementById('agentStats');
        this.activityLogElement = document.getElementById('activityLog');

        this.startButton = document.getElementById('startButton');
        this.pauseButton = document.getElementById('pauseButton');
        this.resetButton = document.getElementById('resetButton');
        this.stepButton = document.getElementById('stepButton');

        this.rlAlgorithmSelect = document.getElementById('rlAlgorithm');
        this.numEpisodesInput = document.getElementById('numEpisodes');
        this.learningRateInput = document.getElementById('learningRate');
        this.discountFactorInput = document.getElementById('discountFactor');
        this.epsilonStartInput = document.getElementById('epsilonStart');
        this.epsilonDecayInput = document.getElementById('epsilonDecay');
        this.epsilonMinInput = document.getElementById('epsilonMin');
        this.maxStepsPerEpisodeInput = document.getElementById('maxStepsPerEpisode');
        this.useLearnedPolicyCheckbox = document.getElementById('useLearnedPolicy');
        
        this.startTrainingButton = document.getElementById('startTrainingButton');
        this.stopTrainingButton = document.getElementById('stopTrainingButton');
        this.saveQTableButton = document.getElementById('saveQTableButton');
        this.loadQTableButton = document.getElementById('loadQTableButton');
        
        this.trainingStatusElement = document.getElementById('trainingStatus');
        this.episodeInfoElement = document.getElementById('episodeInfo');
    }

    init() {
        this.bindEventListeners();
        this.loadRLConfigFromUI(); 
        this.initializeSimulation();
        console.log("SimulationApp initialized.");
    }

    bindEventListeners() {
        this.startButton.addEventListener('click', () => this.startSimulation());
        this.pauseButton.addEventListener('click', () => this.pauseSimulation());
        this.resetButton.addEventListener('click', () => this.resetSimulation());
        this.stepButton.addEventListener('click', () => this.stepSimulationOnce());

        this.startTrainingButton.addEventListener('click', () => this.startRLTraining());
        this.stopTrainingButton.addEventListener('click', () => this.stopRLTraining());
        this.saveQTableButton.addEventListener('click', () => this.saveQTable());
        this.loadQTableButton.addEventListener('click', () => this.loadQTable());

        const rlInputs = [
            this.rlAlgorithmSelect, this.numEpisodesInput, this.learningRateInput,
            this.discountFactorInput, this.epsilonStartInput, this.epsilonDecayInput,
            this.epsilonMinInput, this.maxStepsPerEpisodeInput, this.useLearnedPolicyCheckbox
        ];
        rlInputs.forEach(input => input.addEventListener('change', () => {
            this.loadRLConfigFromUI();
            if (input === this.useLearnedPolicyCheckbox) {
                 this.logEvent(`"Use Learned Policy" set to ${this.rlConfig.useRLAgents}. Reset simulation to apply.`, 'info');
            }
        }));
    }
    
    loadRLConfigFromUI() {
        this.rlConfig.algorithm = this.rlAlgorithmSelect.value;
        this.rlConfig.numEpisodes = parseInt(this.numEpisodesInput.value) || 1000;
        this.rlConfig.learningRate = parseFloat(this.learningRateInput.value) || 0.1;
        this.rlConfig.discountFactor = parseFloat(this.discountFactorInput.value) || 0.9;
        this.rlConfig.epsilonStart = parseFloat(this.epsilonStartInput.value) || 1.0;
        this.rlConfig.epsilonDecay = parseFloat(this.epsilonDecayInput.value) || 0.995;
        this.rlConfig.epsilonMin = parseFloat(this.epsilonMinInput.value) || 0.01;
        this.rlConfig.maxStepsPerEpisode = parseInt(this.maxStepsPerEpisodeInput.value) || 200;
        this.rlConfig.useRLAgents = this.useLearnedPolicyCheckbox.checked; 
    }

    logEvent(message, type = 'info') {
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        const turnTextContent = this.isTraining ? `[Ep ${this.currentEpisode}, Step ${this.currentTurn}] ` : `[Turn ${this.currentTurn}] `;
        const turnText = document.createTextNode(turnTextContent);
        const messageText = document.createTextNode(message);
        entry.appendChild(turnText);
        entry.appendChild(messageText);
        
        this.activityLogElement.appendChild(entry);
        this.activityLogElement.scrollTop = this.activityLogElement.scrollHeight;
        if (this.activityLogElement.children.length > 200) { 
            this.activityLogElement.removeChild(this.activityLogElement.firstChild);
        }
    }

    initializeSimulation(isTrainingReset = false) {
        console.log("initializeSimulation called, isTrainingReset:", isTrainingReset);
        this.pauseSimulation(); 
        this.currentTurn = 0;
        
        // Determine if RL agents should be used for spawning in the environment
        // For training, always use RL agents. For normal sim, use checkbox.
        const spawnRLAgentsInEnvironment = isTrainingReset ? true : this.rlConfig.useRLAgents;
        console.log(`  initializeSimulation: spawnRLAgentsInEnvironment will be: ${spawnRLAgentsInEnvironment} (isTrainingReset: ${isTrainingReset}, checkbox checked: ${this.useLearnedPolicyCheckbox.checked})`);

        this.environment = new Environment(
            20, 15, 
            (msg, type) => this.logEvent(msg, type),
            this.rlConfig, 
            spawnRLAgentsInEnvironment // Pass the correctly determined flag
        );
        this.environment.reset(isTrainingReset); 

        this.updateDisplay(); 
        this.updateStats();   
        this.simStatusElement.textContent = 'Ready';
        this.turnCounterElement.textContent = this.currentTurn;
        if (!isTrainingReset) {
            this.activityLogElement.innerHTML = ''; 
            this.logEvent('Simulation initialized.', 'info');
        }
        console.log("initializeSimulation complete.");
    }

    startSimulation() {
        if (this.isRunning || this.isTraining) {
            this.logEvent("Cannot start simulation: Already running or training.", "warning");
            return;
        }
        if (!this.environment) this.initializeSimulation();
        
        this.isRunning = true;
        this.simStatusElement.textContent = 'Running';
        this.logEvent('Simulation started.', 'info');
        this.disableRLControls(true); 
        this.disableSimControls(true, false); 
        this.gameLoop();
    }

    pauseSimulation() {
        this.isRunning = false;
        if (this.animationId) {
            clearTimeout(this.animationId);
            this.animationId = null;
        }
        if (this.environment && this.simStatusElement.textContent !== 'Complete' && !this.isTraining) { 
             this.simStatusElement.textContent = 'Paused';
             if(this.currentTurn > 0) this.logEvent('Simulation paused.', 'info');
        }
        if(!this.isTraining) {
            this.disableRLControls(false);
            this.disableSimControls(false); 
        }
    }

    resetSimulation() {
        this.pauseSimulation(); 
        this.stopRLTraining(); 
        this.logEvent('Simulation reset.', 'info');
        this.initializeSimulation(); 
        this.disableSimControls(false);
        this.disableRLControls(false);
    }

    gameLoop() {
        if (!this.isRunning) return;

        this.currentTurn++;
        this.turnCounterElement.textContent = this.currentTurn;
        
        const epsilonForExploit = this.rlConfig.useRLAgents ? this.rlConfig.epsilonMin : 0;
        this.environment.update(epsilonForExploit); 
        
        this.updateDisplay();
        this.updateStats();

        if (this.environment.isComplete(this.currentTurn, this.rlConfig.maxStepsPerEpisode * 2 )) {
            this.isRunning = false; 
            this.simStatusElement.textContent = 'Complete';
            this.logEvent('Simulation completed!', 'success');
            this.disableRLControls(false);
            this.disableSimControls(false); 
            if (this.animationId) { 
                clearTimeout(this.animationId);
                this.animationId = null;
            }
        } else {
            this.animationId = setTimeout(() => this.gameLoop(), this.gameSpeed);
        }
    }

    stepSimulationOnce() {
        if (this.isTraining) {
            this.logEvent("Cannot step simulation while training is active.", "warning");
            return;
        }
        if (!this.environment) this.initializeSimulation();
        if (this.isRunning) this.pauseSimulation();

        this.currentTurn++;
        this.turnCounterElement.textContent = this.currentTurn;
        const epsilonForExploit = this.rlConfig.useRLAgents ? this.rlConfig.epsilonMin : 0;
        this.environment.update(epsilonForExploit);
        this.updateDisplay();
        this.updateStats();

        if (this.environment.isComplete(this.currentTurn, this.rlConfig.maxStepsPerEpisode * 2)) {
            this.simStatusElement.textContent = 'Complete';
            this.logEvent('Simulation completed via step!', 'success');
            this.isRunning = false; 
        } else if (!this.isRunning && this.simStatusElement.textContent !== 'Complete') {
            this.simStatusElement.textContent = 'Paused (Stepped)';
        }
        this.disableRLControls(this.isRunning); 
    }

    // --- RL Training Methods ---
    async startRLTraining() {
        if (this.isTraining) {
            this.logEvent("Training is already in progress.", "warning");
            return;
        }
        if (this.isRunning) this.pauseSimulation();

        this.isTraining = true;
        this.currentEpisode = 0; // This will track *completed* episodes for UI, loop will handle 1 to N
        this.trainingRewards = [];
        this.loadRLConfigFromUI(); 
        this.currentEpsilon = this.rlConfig.epsilonStart;

        this.logEvent(`RL Training started with ${this.rlConfig.algorithm}. Episodes: ${this.rlConfig.numEpisodes}.`, 'success');
        console.log(`RL Training started. Episodes: ${this.rlConfig.numEpisodes}, Epsilon: ${this.currentEpsilon}, MaxSteps: ${this.rlConfig.maxStepsPerEpisode}`);
        this.trainingStatusElement.textContent = 'Status: Training...';
        this.disableSimControls(true);
        this.disableRLControls(true, true); 
        
        await this.runRLTrainingLoop();
    }
    
    async runRLTrainingLoop() {
        if (!this.isTraining) {
            console.log("runRLTrainingLoop: Stopping because isTraining is false (likely stop button).");
            return;
        }

        // currentEpisode tracks completed episodes. Loop runs from episode 1 up to numEpisodes.
        const episodeToRun = this.currentEpisode + 1;

        if (episodeToRun <= this.rlConfig.numEpisodes) {
            try {
                this.currentTurn = 0; // Reset step counter for the episode
                console.log(`runRLTrainingLoop: Starting Episode ${episodeToRun}/${this.rlConfig.numEpisodes}`);
                                
                const episodeReward = await this.runRLTrainingEpisode(episodeToRun); 
                
                this.trainingRewards.push(episodeReward);
                console.log(`runRLTrainingLoop: Finished Episode ${episodeToRun}, Reward: ${episodeReward.toFixed(2)}, Epsilon: ${this.currentEpsilon.toFixed(3)}`);

                this.currentEpisode = episodeToRun; // Mark this episode as completed

                if (this.currentEpsilon > this.rlConfig.epsilonMin) {
                    this.currentEpsilon *= this.rlConfig.epsilonDecay;
                    this.currentEpsilon = Math.max(this.rlConfig.epsilonMin, this.currentEpsilon);
                }
                
                this.updateTrainingUI(); 
                
                if (this.isTraining) { 
                    requestAnimationFrame(() => this.runRLTrainingLoop());
                } else {
                    console.log("runRLTrainingLoop: isTraining became false during episode, not scheduling next.")
                }

            } catch (error) {
                console.error(`Error during RL Training Loop's episode ${episodeToRun} execution:`, error);
                this.logEvent(`Error in training episode ${episodeToRun}: ${error.message}`, "danger");
                this.stopRLTraining(false); 
            }
        } else {
            console.log(`runRLTrainingLoop: Reached max episodes (${this.currentEpisode}/${this.rlConfig.numEpisodes}). Training complete.`);
            this.stopRLTraining(true); 
        }
    }

    async runRLTrainingEpisode(episodeNumberForLog) { // episodeNumberForLog is 1-indexed
        // Set currentEpisode for logging inside this function to be the one currently running
        const originalLogEpisode = this.currentEpisode;
        this.currentEpisode = episodeNumberForLog; // For logEvent and UI updates during this episode

        console.log(`runRLTrainingEpisode: Called for episode ${episodeNumberForLog}`);
        this.initializeSimulation(true); // CRITICAL: pass true to ensure RL agents are spawned
        let totalEpisodeReward = 0;

        const rlAgents = this.environment.agents.filter(agent => agent.isRLControlled);
        if (rlAgents.length === 0) {
            this.currentEpisode = originalLogEpisode; // Restore before throwing
            throw new Error("No RL agents found to train in episode.");
        }
        console.log(`runRLTrainingEpisode ${episodeNumberForLog}: Found ${rlAgents.length} RL agents.`);

        for (let stepInEpisode = 0; stepInEpisode < this.rlConfig.maxStepsPerEpisode; stepInEpisode++) {
            if (!this.isTraining) {
                console.log(`runRLTrainingEpisode (${episodeNumberForLog}): Stopping mid-episode (step ${stepInEpisode + 1}) as isTraining is false.`);
                break; 
            }
            this.currentTurn = stepInEpisode + 1; 

            const overallOldFireCount = this.environment.getStats().firesActive; 

            for (const agent of rlAgents) {
                if (agent.dead || agent.unconscious) continue;
                agent.temp_s = agent.getAbstractState(this.environment);
                agent.temp_a = agent.chooseAction(agent.temp_s, this.environment, this.currentEpsilon, false);
                agent.temp_old_hp = agent.hp;
            }

            for (const agent of rlAgents) {
                if (agent.dead || agent.unconscious || !agent.temp_s) continue;
                agent.temp_action_reward = this.environment.executeAgentActionAndGetReward(agent, agent.temp_a, true);
            }

            this.environment.updateWorldStateStep(); 

            let episodeShouldEndThisStep = false;
            for (const agent of rlAgents) {
                if (!agent.temp_s) continue; 

                if (agent.dead && agent.temp_old_hp > 0) { 
                    let deathReward = agent.temp_action_reward || 0;
                    deathReward -= 50; 
                    totalEpisodeReward += deathReward;
                    console.log(`Agent ${agent.id.slice(-4)} died. Reward this step: ${deathReward.toFixed(2)} (includes action reward)`);
                    
                     const nextState = agent.getAbstractState(this.environment); 
                     agent.learn(agent.temp_s, agent.temp_a, deathReward, nextState, this.environment, 
                                this.rlConfig.learningRate, this.rlConfig.discountFactor, 
                                this.currentEpsilon, null); 

                    delete agent.temp_s; delete agent.temp_a; delete agent.temp_action_reward; delete agent.temp_old_hp;
                    episodeShouldEndThisStep = this.environment.isEpisodeCompleteForRL(stepInEpisode, this.rlConfig.maxStepsPerEpisode, agent);
                    continue; 
                }
                if (agent.dead || agent.unconscious) { 
                     delete agent.temp_s; delete agent.temp_a; delete agent.temp_action_reward; delete agent.temp_old_hp;
                     continue;
                }

                let stepReward = agent.temp_action_reward;

                if (agent.hp < agent.temp_old_hp) { 
                    stepReward -= (agent.temp_old_hp - agent.hp) * 1.5; 
                }
                
                const currentFireCount = this.environment.getStats().firesActive;
                if (currentFireCount < overallOldFireCount && agent.type === 'firefighter') { 
                    stepReward += (overallOldFireCount - currentFireCount) * 3; 
                }
                if (currentFireCount === 0 && overallOldFireCount > 0 && agent.type === 'firefighter') {
                     stepReward += 50; 
                }

                totalEpisodeReward += stepReward;
                const nextState = agent.getAbstractState(this.environment);
                
                let nextActionForSARSA = null;
                if (this.rlConfig.algorithm === 'sarsa' && !agent.dead) { 
                    nextActionForSARSA = agent.chooseAction(nextState, this.environment, this.currentEpsilon, false);
                }
                
                agent.learn(agent.temp_s, agent.temp_a, stepReward, nextState, this.environment, 
                            this.rlConfig.learningRate, this.rlConfig.discountFactor, 
                            this.currentEpsilon, nextActionForSARSA);
                
                delete agent.temp_s; delete agent.temp_a; delete agent.temp_action_reward; delete agent.temp_old_hp;

                if (this.environment.isEpisodeCompleteForRL(stepInEpisode, this.rlConfig.maxStepsPerEpisode, agent)) {
                    episodeShouldEndThisStep = true; 
                }
            } 

            if (episodeShouldEndThisStep || this.environment.isEpisodeCompleteForRL(stepInEpisode, this.rlConfig.maxStepsPerEpisode, null )) {
                console.log(`Episode ${episodeNumberForLog} completed at step ${stepInEpisode + 1} due to environment condition.`);
                break;
            }
            
            if (stepInEpisode > 0 && stepInEpisode % 30 === 0) { 
                this.updateDisplay();
                this.updateStats();
                this.updateTrainingUI(); // Update UI with the episode *currently running*
                await new Promise(resolve => setTimeout(resolve, 1)); 
            }
        } 

        const finalStats = this.environment.getStats();
        if (finalStats.firesActive === 0 && rlAgents.some(a => a.type === 'firefighter' && !a.dead)) {
            totalEpisodeReward += 200; 
            this.logEvent(`Episode ${episodeNumberForLog}: All fires extinguished! +200 bonus.`, 'success');
        }
        
        this.updateDisplay(); 
        this.updateStats();
        this.currentEpisode = originalLogEpisode; // Restore to completed episode count for next loop iteration
        return totalEpisodeReward;
    }

    stopRLTraining(completed = false) {
        if (!this.isTraining && !completed) return; 

        this.isTraining = false; 
        // Use this.currentEpisode which reflects *completed* episodes for UI after stopping
        this.trainingStatusElement.textContent = completed ? 'Status: Training Complete!' : 'Status: Training Stopped.';
        this.logEvent(completed ? `RL Training completed after ${this.currentEpisode} episodes.` : 'RL Training stopped by user.', completed ? 'success' : 'warning');
        console.log(completed ? `RL Training completed after ${this.currentEpisode} episodes.` : 'RL Training stopped by user.');
        this.disableSimControls(false);
        this.disableRLControls(false);
    }
    
    updateTrainingUI() {
        const lastRewards = this.trainingRewards.slice(-Math.min(this.trainingRewards.length, 100));
        const avgReward = lastRewards.length > 0 
            ? (lastRewards.reduce((a,b) => a+b,0) / lastRewards.length).toFixed(2) 
            : 'N/A';
        // Display this.currentEpisode which is number of completed episodes if called after episode,
        // or current running episode (1-indexed) if called during runRLTrainingEpisode.
        // The logic in runRLTrainingLoop and runRLTrainingEpisode manages this.currentEpisode for logging context.
        const displayEpisode = this.isTraining ? (this.trainingRewards.length + 1) : this.currentEpisode;

        this.episodeInfoElement.textContent = 
            `Episode: ${displayEpisode}/${this.rlConfig.numEpisodes}, Avg Reward (last ${lastRewards.length}): ${avgReward}, ε: ${this.currentEpsilon.toFixed(4)}`;
    }

    saveQTable() {
        if (this.isTraining) {
            this.logEvent("Cannot save Q-Table while training is active.", "warning");
            return;
        }
        if (!this.rlConfig.qTable || Object.keys(this.rlConfig.qTable).length === 0) {
            this.logEvent("Q-Table is empty or not initialized. Train first or load a Q-Table.", "warning");
            console.warn("Attempted to save an empty Q-Table", this.rlConfig.qTable);
            return;
        }
        try {
            const qTableJson = JSON.stringify(this.rlConfig.qTable);
            const blob = new Blob([qTableJson], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `q_table_${this.rlConfig.algorithm}_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.logEvent("Q-Table saved successfully.", "success");
            console.log("Q-Table saved. Size (states):", Object.keys(this.rlConfig.qTable).length, "JSON length:", qTableJson.length);
        } catch (error) {
            this.logEvent(`Error saving Q-Table: ${error.message}`, "danger");
            console.error("Error saving Q-Table:", error);
        }
    }

    loadQTable() {
         if (this.isTraining) {
            this.logEvent("Cannot load Q-Table while training is active.", "warning");
            return;
        }
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const loadedQTable = JSON.parse(e.target.result);
                        if (typeof loadedQTable === 'object' && loadedQTable !== null) {
                            this.rlConfig.qTable = loadedQTable;
                            this.logEvent("Q-Table loaded successfully. Reset simulation or training to apply to new agents.", "success");
                            console.log("Q-Table loaded. Number of states:", Object.keys(loadedQTable).length);
                            if (this.environment && this.environment.agents) {
                                this.environment.agents.forEach(agent => {
                                    if (agent.isRLControlled) {
                                        agent.qTable = this.rlConfig.qTable; 
                                    }
                                });
                                this.logEvent("Q-Table applied to existing RL agents in current environment instance.", "info");
                            }
                        } else {
                            throw new Error("Invalid Q-Table format.");
                        }
                    } catch (error) {
                        this.logEvent(`Error loading Q-Table: ${error.message}`, "danger");
                        console.error("Error loading Q-Table:", error);
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    disableSimControls(disabled, keepPauseResetActive = false) {
        this.startButton.disabled = disabled;
        this.pauseButton.disabled = keepPauseResetActive ? false : disabled;
        this.resetButton.disabled = keepPauseResetActive ? false : disabled; 
        this.stepButton.disabled = disabled;
    }

    disableRLControls(disabled, keepStopButtonResponsive = false) {
        this.rlAlgorithmSelect.disabled = disabled;
        this.numEpisodesInput.disabled = disabled;
        this.learningRateInput.disabled = disabled;
        this.discountFactorInput.disabled = disabled;
        this.epsilonStartInput.disabled = disabled;
        this.epsilonDecayInput.disabled = disabled;
        this.epsilonMinInput.disabled = disabled;
        this.maxStepsPerEpisodeInput.disabled = disabled;

        this.startTrainingButton.disabled = disabled;
        this.stopTrainingButton.disabled = !(disabled && keepStopButtonResponsive);
        
        this.saveQTableButton.disabled = disabled;
        this.loadQTableButton.disabled = disabled;
    }

    updateDisplay() {
        if (!this.environment) return;
        this.simulationGridElement.innerHTML = ''; 
        const fragment = document.createDocumentFragment();

        for (let row = 0; row < this.environment.height; row++) {
            for (let col = 0; col < this.environment.width; col++) {
                const tile = this.environment.getTile(row, col);
                const tileElement = document.createElement('div');
                tileElement.className = 'tile';
                
                tileElement.classList.add(tile.type); 
                if (tile.isOnFire) tileElement.classList.add('fire');
                if (tile.smokeLevel === 'Light') tileElement.classList.add('smoke-light');
                else if (tile.smokeLevel === 'Heavy') tileElement.classList.add('smoke-heavy');
                if (tile.isToxicFumes) tileElement.classList.add('toxic-fumes');
                if (tile.hasDebris) tileElement.classList.add('debris');
                
                const agent = this.environment.getAgentAt(row, col);
                if (agent) {
                    const agentType = agent.type || 'unknown'; // Ensure agent.type is defined
                    const agentElement = document.createElement('div');
                    agentElement.className = `agent ${agentType}`; 
                    let agentSymbol = '';
                    if (agentType === 'firefighter') agentSymbol = '🚒';
                    else if (agentType === 'rescuer') agentSymbol = '👨‍🚒'; 
                    else if (agentType === 'victim') agentSymbol = agent.rescued ? '✅' : (agent.dead ? '💀' : '😰');
                    else agentSymbol = '?'; 
                    agentElement.textContent = agentSymbol;
                    
                    if (agent.unconscious && !agent.dead) agentElement.style.opacity = '0.5';
                    if (agent.dead) agentElement.style.filter = 'grayscale(100%)';
                    tileElement.appendChild(agentElement);
                }
                fragment.appendChild(tileElement);
            }
        }
        this.simulationGridElement.appendChild(fragment);
    }

    updateStats() {
        if (!this.environment || !this.environment.agents) {
            console.warn("updateStats called with no environment or agents.");
            this.agentStatsContainerElement.innerHTML = '<div>No agent data available.</div>';
            return;
        }
        const stats = this.environment.getStats();
        
        this.victimsRescuedElement.textContent = stats.victimsRescued;
        this.victimsRemainingElement.textContent = stats.victimsRemaining;
        this.firesActiveElement.textContent = stats.firesActive;
        this.totalScoreElement.textContent = stats.totalScore;
        
        this.agentStatsContainerElement.innerHTML = '';
        const agentFragment = document.createDocumentFragment();

        this.environment.agents.forEach((agent, i) => {
            if (!agent || typeof agent.type === 'undefined' || typeof agent.id === 'undefined') {
                // This was the defensive check, it should be hit less now with constructor logs
                console.error(`Problematic agent at index ${i} during updateStats:`, JSON.stringify(agent));
                const errorDiv = document.createElement('div');
                errorDiv.className = 'agent-stats';
                errorDiv.innerHTML = `<div style="color: red;">Error: Agent ${i} data incomplete. Type: ${agent ? agent.type : 'N/A'}, ID: ${agent ? agent.id : 'N/A'}</div>`;
                agentFragment.appendChild(errorDiv);
                return; 
            }

            const agentDiv = document.createElement('div');
            agentDiv.className = 'agent-stats';
            
            const agentTypeStr = String(agent.type || "unknown"); 
            const typeIcon = agentTypeStr === 'firefighter' ? '🚒' : 
                           agentTypeStr === 'rescuer' ? '👨‍🚒' : 
                           agentTypeStr === 'victim' ? '😰' : '?';
            
            let statusText = '✅ OK';
            if(agent.dead) statusText = '💀 Dead';
            else if(agent.unconscious) statusText = '😵 Unconscious';
            else if(agent.rescued && agentTypeStr === 'victim') statusText = '✅ Rescued';

            const agentIdStr = String(agent.id || "N/A");
            const displayId = agentIdStr.length > 4 ? agentIdStr.slice(-4) : agentIdStr;

            agentDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span>${typeIcon} ${agentTypeStr.charAt(0).toUpperCase() + agentTypeStr.slice(1)} (ID ${displayId})</span>
                    <span>${statusText}</span>
                </div>
                <div style="font-size: 11px; margin-bottom: 3px;">Health: ${agent.hp !== undefined ? agent.hp : 'N/A'}/${agent.maxHP !== undefined ? agent.maxHP : 'N/A'}</div>
                <div class="health-bar">
                    <div class="fill" style="width: ${agent.hp !== undefined && agent.maxHP ? (agent.hp / agent.maxHP) * 100 : 0}%"></div>
                </div>
                <div style="font-size: 11px; margin-bottom: 3px;">Stamina: ${agent.sp !== undefined ? agent.sp : 'N/A'}/${agent.maxSP !== undefined ? agent.maxSP : 'N/A'}</div>
                <div class="stamina-bar">
                    <div class="fill" style="width: ${agent.sp !== undefined && agent.maxSP ? (agent.sp / agent.maxSP) * 100 : 0}%"></div>
                </div>
                ${agent.maxWater > 0 ? `
                    <div style="font-size: 11px; margin-bottom: 3px;">Water: ${agent.water !== undefined ? agent.water : 'N/A'}/${agent.maxWater}</div>
                    <div class="water-bar">
                        <div class="fill" style="width: ${agent.water !== undefined && agent.maxWater ? (agent.water / agent.maxWater) * 100 : 0}%"></div>
                    </div>
                ` : ''}
                ${(agent.maxSCBA > 0 || agentTypeStr !== 'victim') && typeof agent.scba !== 'undefined' ? `
                    <div style="font-size: 10px; color: #aaa;">SCBA: ${agent.scba} / ${agent.maxSCBA || 0}</div>
                ` : ''}
                <div style="font-size: 10px; color: #feca57;">Panic: ${agent.panic !== undefined ? agent.panic : 0}/100</div>
            `;
            agentFragment.appendChild(agentDiv);
        });
        this.agentStatsContainerElement.appendChild(agentFragment);
    }
}