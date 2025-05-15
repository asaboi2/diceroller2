
 <script>
        document.addEventListener('DOMContentLoaded', () => {
            // --- STATE ---
            let difficulty = 2;
            let expertise = 0;
            let specialMoves = 0;
            let rolls = [];
            let outcomeText = "";
            let isRolling = false;
            let hasRolledThisTurn = false;
            let currentRollIndex = null;
            let currentAnimatedValue = null;
            let players = [];
            let newPlayerName = '';
            let uploadedImage = null;
            let diceContributions = [];
            let specialMoveContributions = [];
            let sequenceChainTimeoutId = null;
            let canPushLuck = false;
            let canPayPrice = false;
            let pushedLuckDieRoll = null;
            let isRedoingRollAfterPrice = false;
            let indexOfRollToRedo = -1;
            let currentSequenceTotalDice = 0;
            let nextPlayerHue = 0;
            const HUE_INCREMENT = 40;
            const SATURATION = 70;
            const LIGHTNESS = 55;
            const SINGLE_DIE_ANIMATION_FRAMES = 5;
            const SINGLE_DIE_ANIMATION_INTERVAL = 50;
            const SINGLE_DIE_POST_ANIMATION_PAUSE = 500;
            const BASE_DELAY_AFTER_DIE_FINISHES = 100;
            const DELAY_INCREMENT_PER_DIE = 250;

            // --- NEW TIMER STATE ---
            const STRATEGY_TIMER_DURATION = 90; // seconds
            let strategyTimerValue = STRATEGY_TIMER_DURATION;
            let strategyTimerIntervalId = null;
            let isStrategyTimerActive = false;
            let hasStrategyTimeRunOut = false;
            let actionCounterValue = 0;
            let initialActionCount = 0; 
            let isActionCounterSet = false;
            let isTimersPaused = false;


            // --- DOM ELEMENTS ---
            const difficultyDisplay = document.getElementById('difficultyDisplay');
            const decreaseDifficultyBtn = document.getElementById('decreaseDifficultyBtn');
            const increaseDifficultyBtn = document.getElementById('increaseDifficultyBtn');
            const dicePoolDisplayEl = document.getElementById('dicePoolDisplay');
            const statusMessageEl = document.getElementById('statusMessage');
            const playerListEl = document.getElementById('playerList');
            const openAddPlayerModalBtn = document.getElementById('openAddPlayerModalBtn');
            const noPlayersTextEl = document.getElementById('noPlayersText');
            const rollDiceBtn = document.getElementById('rollDiceBtn');
            const specialActionButtonsContainerEl = document.getElementById('specialActionButtonsContainer');
            const pushLuckBtn = document.getElementById('pushLuckBtn');
            const payPriceBtn = document.getElementById('payPriceBtn');
            const addPlayerModalEl = document.getElementById('addPlayerModal');
            const playerNameInput = document.getElementById('playerNameInput');
            const playerImageInput = document.getElementById('playerImageInput');
            const imagePreviewContainer = document.getElementById('imagePreviewContainer');
            const imagePreviewEl = document.getElementById('imagePreview');
            const cancelAddPlayerBtn = document.getElementById('cancelAddPlayerBtn');
            const confirmAddPlayerBtn = document.getElementById('confirmAddPlayerBtn');

            // --- NEW TIMER DOM ELEMENTS ---
            const strategyTimerDisplayEl = document.getElementById('strategyTimerDisplay');
            const actionCounterDisplayEl = document.getElementById('actionCounterDisplay');
            const setActionCountInputEl = document.getElementById('setActionCountInput');
            const setActionCountBtn = document.getElementById('setActionCountBtn');
            const timerActionButtonsContainerEl = document.getElementById('timerActionButtonsContainer');
            const pauseResumeTimersBtn = document.getElementById('pauseResumeTimersBtn');
            const resetAllTimersBtn = document.getElementById('resetAllTimersBtn');

            const DICE_ICON = '🎲';
            const STAR_ICON = '✨';
            const USER_ICON = '👤';

            // --- TIMER FUNCTIONS ---
            function updateStrategyTimerDisplay() {
                if (hasStrategyTimeRunOut) {
                    strategyTimerDisplayEl.textContent = "TIME UP!";
                    strategyTimerDisplayEl.classList.add('timed-out');
                } else if (isStrategyTimerActive && !isTimersPaused) {
                    strategyTimerDisplayEl.textContent = `${strategyTimerValue}s`;
                    strategyTimerDisplayEl.classList.remove('timed-out');
                } else if (isTimersPaused && isStrategyTimerActive) {
                    strategyTimerDisplayEl.textContent = `${strategyTimerValue}s (Paused)`;
                    strategyTimerDisplayEl.classList.remove('timed-out');
                }
                 else {
                    strategyTimerDisplayEl.textContent = "--";
                    strategyTimerDisplayEl.classList.remove('timed-out');
                }
            }

            function stopStrategyTimer() {
                if (strategyTimerIntervalId) {
                    clearInterval(strategyTimerIntervalId);
                    strategyTimerIntervalId = null;
                }
                // isStrategyTimerActive is set to false where appropriate (e.g. on roll, on timeout)
            }

            function handleStrategyTimeOut() {
                stopStrategyTimer();
                isStrategyTimerActive = false;
                hasStrategyTimeRunOut = true;
                outcomeText = "Strategy Time Expired! Roll automatically failed.";
                
                // Consume an action if the counter is set
                if (isActionCounterSet && actionCounterValue > 0) {
                    actionCounterValue--;
                    updateActionCounterDisplay();
                }
                
                fullUIUpdate(); // This will update buttons and status
            }

            function startStrategyTimer() {
                if (isStrategyTimerActive || isTimersPaused || hasStrategyTimeRunOut) return;
                if (isActionCounterSet && actionCounterValue <= 0) return; // No actions left

                stopStrategyTimer(); // Clear any existing interval just in case
                strategyTimerValue = STRATEGY_TIMER_DURATION;
                isStrategyTimerActive = true;
                hasStrategyTimeRunOut = false; // Reset this flag
                updateStrategyTimerDisplay();
                timerActionButtonsContainerEl.style.display = 'flex';


                strategyTimerIntervalId = setInterval(() => {
                    if (isTimersPaused) return; // Don't count down if paused

                    strategyTimerValue--;
                    updateStrategyTimerDisplay();
                    if (strategyTimerValue <= 0) {
                        handleStrategyTimeOut();
                    }
                }, 1000);
                fullUIUpdate(); // Update button states etc.
            }
            
            function resetStrategyTimerConditions() {
                stopStrategyTimer();
                isStrategyTimerActive = false;
                hasStrategyTimeRunOut = false;
                strategyTimerValue = STRATEGY_TIMER_DURATION;
                updateStrategyTimerDisplay();
            }

            function updateActionCounterDisplay() {
                actionCounterDisplayEl.textContent = isActionCounterSet ? actionCounterValue : "--";
                setActionCountInputEl.value = isActionCounterSet ? initialActionCount : '';
            }

            function handleSetActionCounter() {
                const count = parseInt(setActionCountInputEl.value);
                if (!isNaN(count) && count >= 0) {
                    initialActionCount = count;
                    actionCounterValue = count;
                    isActionCounterSet = true;
                    updateActionCounterDisplay();
                    timerActionButtonsContainerEl.style.display = 'flex';
                    // If resetting counter, and conditions allow, start strategy timer for a new challenge
                    if (!isRolling && !hasRolledThisTurn && !isStrategyTimerActive && !hasStrategyTimeRunOut && !isTimersPaused) {
                        tryStartStrategyTimer();
                    }
                    fullUIUpdate();
                } else if (setActionCountInputEl.value.trim() === "") { // Allow clearing
                    isActionCounterSet = false;
                    initialActionCount = 0;
                    actionCounterValue = 0;
                    updateActionCounterDisplay();
                    if (!isStrategyTimerActive && !hasStrategyTimeRunOut && !isTimersPaused) {
                         timerActionButtonsContainerEl.style.display = 'none';
                    }
                    fullUIUpdate();
                } else {
                    alert("Please enter a valid number for the action counter.");
                }
            }

            function modifyActionCounter(change) {
                if (isActionCounterSet) {
                    actionCounterValue = Math.max(0, actionCounterValue + change); // Prevent going below 0
                    updateActionCounterDisplay();
                }
            }

            function togglePauseTimers() {
                isTimersPaused = !isTimersPaused;
                pauseResumeTimersBtn.textContent = isTimersPaused ? "Resume Timers" : "Pause Timers";
                if (isTimersPaused && isStrategyTimerActive) {
                    // The interval itself is not cleared, it just checks isTimersPaused
                    updateStrategyTimerDisplay(); // To show "(Paused)"
                } else if (!isTimersPaused && isStrategyTimerActive && strategyTimerValue > 0 && !hasStrategyTimeRunOut) {
                    // If resuming and timer was active, ensure it visually updates immediately
                    updateStrategyTimerDisplay();
                }
                fullUIUpdate(); // Update button states etc.
            }

            function handleResetAllTimers() {
                if (!confirm("Are you sure you want to reset all timers and current roll progress?")) return;

                isTimersPaused = false; // Unpause if paused
                resetStrategyTimerConditions();
                
                isActionCounterSet = false; // Completely reset action counter
                initialActionCount = 0;
                actionCounterValue = 0;
                updateActionCounterDisplay();
                setActionCountInputEl.value = '';

                timerActionButtonsContainerEl.style.display = 'none';
                clearAllContributionsAndStatsJS(); // This also calls fullUIUpdate
            }
            
            function tryStartStrategyTimer() {
                if (isRolling || hasRolledThisTurn || isTimersPaused || isStrategyTimerActive || hasStrategyTimeRunOut) {
                    return;
                }
                if (isActionCounterSet && actionCounterValue <= 0) {
                    // statusMessageEl.textContent = "No actions left for this challenge.";
                    return;
                }
                startStrategyTimer();
            }

            // --- UTILITY FUNCTIONS ---
            function generatePlayerColor() { /* ... (no change) ... */
                const hue = nextPlayerHue;
                nextPlayerHue = (nextPlayerHue + HUE_INCREMENT) % 360;
                return `hsl(${hue}, ${SATURATION}%, ${LIGHTNESS}%)`;
            }
            const getNumSpecialMovesVisuallyCoveringSlots = () => Math.min(specialMoves, Math.max(0, difficulty));
            const getNumPrimarySlotsForExpertiseOrEmpty = () => { /* ... (no change) ... */
                const coveredBySM = getNumSpecialMovesVisuallyCoveringSlots();
                return Math.max(0, difficulty - coveredBySM);
            };
            const getDicePool = () => expertise;

            // --- RENDER FUNCTIONS ---
            function renderDicePool() { /* ... (no change from previous version) ... */
                dicePoolDisplayEl.innerHTML = '';
                let expertiseDieRenderedCount = 0;
                const numSMCovers = getNumSpecialMovesVisuallyCoveringSlots();

                for (let i = 0; i < Math.max(0, difficulty); i++) {
                    const slotDiv = document.createElement('div');
                    slotDiv.classList.add('dice-slot');
                    const isCoveredBySpecialMove = i >= Math.max(0, difficulty) - numSMCovers;

                    if (isCoveredBySpecialMove) {
                        slotDiv.classList.add('special-move-covered');
                        const smContributionIndex = (numSMCovers - 1) - (i - (Math.max(0, difficulty) - numSMCovers));
                        const playerId = specialMoveContributions[smContributionIndex];
                        const player = playerId ? players.find(p => p.id === playerId) : null;

                        if (player && player.image) {
                            const img = document.createElement('img');
                            img.classList.add('player-cover-image');
                            img.src = player.image;
                            img.alt = `${player.name} covers this`;
                            img.title = `${player.name} covers this difficulty`;
                            slotDiv.appendChild(img);
                        } else if (player) {
                             const initialDiv = document.createElement('div');
                             initialDiv.classList.add('player-initial-avatar');
                             initialDiv.style.width = '100%';
                             initialDiv.style.height = '100%';
                             initialDiv.style.borderRadius = '8px';
                             initialDiv.textContent = player.name.charAt(0).toUpperCase();
                             initialDiv.title = `${player.name} covers this difficulty (Initial)`;
                             initialDiv.style.backgroundColor = player.color;
                             slotDiv.appendChild(initialDiv);
                        } else {
                            const genericCoverDiv = document.createElement('div');
                            genericCoverDiv.classList.add('player-cover-image', 'generic-cover');
                            genericCoverDiv.innerHTML = STAR_ICON;
                            genericCoverDiv.title = "Special Move covers this";
                            slotDiv.appendChild(genericCoverDiv);
                        }
                    } else {
                        if (expertiseDieRenderedCount < expertise) {
                            slotDiv.classList.add('filled');
                            const currentExpertiseDieOriginalIndex = expertiseDieRenderedCount;
                            const playerIdForExpertise = diceContributions[currentExpertiseDieOriginalIndex];
                            const playerForExpertise = playerIdForExpertise ? players.find(p => p.id === playerIdForExpertise) : null;

                            const dieFaceDiv = document.createElement('div');
                            dieFaceDiv.classList.add('die-face');
                            let content = DICE_ICON;
                            dieFaceDiv.classList.add('placeholder');

                            if ((isRolling || isRedoingRollAfterPrice) && currentExpertiseDieOriginalIndex === currentRollIndex && currentAnimatedValue !== null) {
                                content = currentAnimatedValue;
                                dieFaceDiv.classList.remove('placeholder', 'waiting', 'filled-placeholder');
                                if (currentAnimatedValue === 6) dieFaceDiv.classList.add('success', 'animating');
                                else if (currentAnimatedValue === 1) dieFaceDiv.classList.add('failure', 'animating');
                                else if (currentAnimatedValue >= 4) dieFaceDiv.classList.add('partial-success', 'animating');
                                else dieFaceDiv.classList.add('partial-failure', 'animating');
                            } else if (rolls[currentExpertiseDieOriginalIndex] !== undefined) {
                                content = rolls[currentExpertiseDieOriginalIndex];
                                dieFaceDiv.classList.remove('placeholder', 'waiting', 'filled-placeholder');
                                if (rolls[currentExpertiseDieOriginalIndex] === 6) dieFaceDiv.classList.add('success');
                                else if (rolls[currentExpertiseDieOriginalIndex] === 1) dieFaceDiv.classList.add('failure');
                                else if (rolls[currentExpertiseDieOriginalIndex] >= 4) dieFaceDiv.classList.add('partial-success');
                                else dieFaceDiv.classList.add('partial-failure');
                            } else if (isRolling || isRedoingRollAfterPrice) {
                                dieFaceDiv.classList.add("waiting");
                            } else {
                                dieFaceDiv.classList.add("filled-placeholder");
                            }
                            dieFaceDiv.innerHTML = content;
                            slotDiv.appendChild(dieFaceDiv);


                            if (playerForExpertise) {
                                const indicator = document.createElement('div');
                                indicator.classList.add('player-indicator');
                                indicator.title = `Expertise from ${playerForExpertise.name}`;
                                if (playerForExpertise.image) {
                                    const imgPlayerIndicator = document.createElement('img');
                                    imgPlayerIndicator.src = playerForExpertise.image;
                                    imgPlayerIndicator.alt = playerForExpertise.name;
                                    indicator.appendChild(imgPlayerIndicator);
                                } else {
                                    indicator.classList.add('generic');
                                    indicator.textContent = playerForExpertise.name.charAt(0).toUpperCase();
                                    indicator.style.backgroundColor = playerForExpertise.color;
                                }
                                slotDiv.appendChild(indicator);
                            }
                            expertiseDieRenderedCount++;
                        } else {
                            slotDiv.classList.add('empty');
                        }
                    }
                    dicePoolDisplayEl.appendChild(slotDiv);
                }

                for (let k = expertiseDieRenderedCount; k < expertise; k++) {
                    const slotDiv = document.createElement('div');
                    slotDiv.classList.add('dice-slot', 'extra');
                    const currentExpertiseDieOriginalIndex = k; 
                    const playerIdForExpertise = diceContributions[currentExpertiseDieOriginalIndex];
                    const playerForExpertise = playerIdForExpertise ? players.find(p => p.id === playerIdForExpertise) : null;

                    const dieFaceDiv = document.createElement('div');
                    dieFaceDiv.classList.add('die-face');
                    let content = DICE_ICON;
                    dieFaceDiv.classList.add('placeholder');

                    if ((isRolling || isRedoingRollAfterPrice) && currentExpertiseDieOriginalIndex === currentRollIndex && currentAnimatedValue !== null) {
                        content = currentAnimatedValue;
                        dieFaceDiv.classList.remove('placeholder', 'waiting', 'filled-placeholder');
                        if (currentAnimatedValue === 6) dieFaceDiv.classList.add('success', 'animating');
                        else if (currentAnimatedValue === 1) dieFaceDiv.classList.add('failure', 'animating');
                        else if (currentAnimatedValue >= 4) dieFaceDiv.classList.add('partial-success', 'animating');
                        else dieFaceDiv.classList.add('partial-failure', 'animating');
                    } else if (rolls[currentExpertiseDieOriginalIndex] !== undefined) {
                        content = rolls[currentExpertiseDieOriginalIndex];
                        dieFaceDiv.classList.remove('placeholder', 'waiting', 'filled-placeholder');
                        if (rolls[currentExpertiseDieOriginalIndex] === 6) dieFaceDiv.classList.add('success');
                        else if (rolls[currentExpertiseDieOriginalIndex] === 1) dieFaceDiv.classList.add('failure');
                        else if (rolls[currentExpertiseDieOriginalIndex] >= 4) dieFaceDiv.classList.add('partial-success');
                        else dieFaceDiv.classList.add('partial-failure');
                    } else if (isRolling || isRedoingRollAfterPrice) {
                        dieFaceDiv.classList.add("waiting");
                    } else {
                        dieFaceDiv.classList.add("filled-placeholder");
                    }
                    dieFaceDiv.innerHTML = content;
                    slotDiv.appendChild(dieFaceDiv);


                    if (playerForExpertise) {
                        const indicator = document.createElement('div');
                        indicator.classList.add('player-indicator');
                        indicator.title = `Expertise from ${playerForExpertise.name}`;
                         if (playerForExpertise.image) {
                            const imgPlayerIndicator = document.createElement('img');
                            imgPlayerIndicator.src = playerForExpertise.image;
                            imgPlayerIndicator.alt = playerForExpertise.name;
                            indicator.appendChild(imgPlayerIndicator);
                        } else {
                            indicator.classList.add('generic');
                            indicator.textContent = playerForExpertise.name.charAt(0).toUpperCase();
                            indicator.style.backgroundColor = playerForExpertise.color;
                        }
                        slotDiv.appendChild(indicator);
                    }
                    dicePoolDisplayEl.appendChild(slotDiv);
                }
                if (pushedLuckDieRoll !== null && !isRolling && !isRedoingRollAfterPrice) {
                    const pushedDieSlot = document.createElement('div');
                    pushedDieSlot.classList.add('dice-slot', 'filled');
                    pushedDieSlot.style.borderColor = 'var(--warning)';
                    const dieFaceDiv = document.createElement('div');
                    dieFaceDiv.classList.add('die-face', 'pushed-luck-die');
                     if (pushedLuckDieRoll <= 3) dieFaceDiv.classList.add('failure'); else dieFaceDiv.classList.add('success');
                    dieFaceDiv.textContent = pushedLuckDieRoll;
                    pushedDieSlot.appendChild(dieFaceDiv);
                    dicePoolDisplayEl.appendChild(pushedDieSlot);
                }
            }

            function renderPlayerList() {
                playerListEl.innerHTML = '';
                noPlayersTextEl.style.display = players.length === 0 ? 'block' : 'none';
                players.forEach(player => {
                    const playerItemDiv = document.createElement('div');
                    playerItemDiv.classList.add('player-item');
                    // ... (rest of player item rendering, no change)
                    const playerInfoDiv = document.createElement('div');
                    playerInfoDiv.classList.add('player-info');
                    const avatarContainer = document.createElement('div');
                    avatarContainer.classList.add('player-avatar-container');
                    if (player.image) {
                        const img = document.createElement('img');
                        img.src = player.image; img.alt = player.name; img.classList.add('player-avatar-img');
                        avatarContainer.appendChild(img);
                    } else {
                        const initialDiv = document.createElement('div');
                        initialDiv.classList.add('player-initial-avatar');
                        initialDiv.textContent = player.name.charAt(0).toUpperCase();
                        initialDiv.style.backgroundColor = player.color;
                        avatarContainer.appendChild(initialDiv);
                    }
                    playerInfoDiv.appendChild(avatarContainer);
                    const nameLabel = document.createElement('span');
                    nameLabel.classList.add('player-name-label'); nameLabel.textContent = player.name;
                    playerInfoDiv.appendChild(nameLabel);
                    playerItemDiv.appendChild(playerInfoDiv);

                    const actionIconsDiv = document.createElement('div');
                    actionIconsDiv.classList.add('player-action-icons');
                    const addExpertiseBtn = document.createElement('button');
                    addExpertiseBtn.classList.add('player-action-btn'); addExpertiseBtn.innerHTML = DICE_ICON;
                    addExpertiseBtn.title = `Add Expertise (${player.contributedDice}/3)`;
                    addExpertiseBtn.disabled = player.contributedDice >= 3 || isRolling || canPushLuck || canPayPrice || isRedoingRollAfterPrice || hasRolledThisTurn || !isStrategyTimerActive || hasStrategyTimeRunOut || isTimersPaused;
                    addExpertiseBtn.addEventListener('click', () => handlePlayerContributesExpertise(player.id));
                    actionIconsDiv.appendChild(addExpertiseBtn);

                    const addSpecialMoveBtn = document.createElement('button');
                    addSpecialMoveBtn.classList.add('player-action-btn'); addSpecialMoveBtn.innerHTML = STAR_ICON;
                    addSpecialMoveBtn.title = `Add Special Move`;
                    const numSMCovers = getNumSpecialMovesVisuallyCoveringSlots();
                    addSpecialMoveBtn.disabled = (difficulty > 0 && numSMCovers >= difficulty) || isRolling || canPushLuck || canPayPrice || isRedoingRollAfterPrice || hasRolledThisTurn || !isStrategyTimerActive || hasStrategyTimeRunOut || isTimersPaused;
                    addSpecialMoveBtn.addEventListener('click', () => handlePlayerContributesSpecialMove(player.id));
                    actionIconsDiv.appendChild(addSpecialMoveBtn);
                    playerItemDiv.appendChild(actionIconsDiv);
                    playerListEl.appendChild(playerItemDiv);
                });
            }

            function updateStatusMessage() {
                let msg = "Ready to roll!";
                const numSMCovers = getNumSpecialMovesVisuallyCoveringSlots();
                const currentDicePool = getDicePool();

                if (isTimersPaused) {
                    msg = "Timers Paused. Resolve to continue.";
                } else if (hasStrategyTimeRunOut) {
                     msg = outcomeText || "Strategy Time Expired! Roll failed. Acknowledge to continue.";
                } else if (isActionCounterSet && actionCounterValue <= 0 && !isRolling && !hasRolledThisTurn) {
                     msg = "No actions left for this challenge. GM can reset action counter.";
                } else if (isStrategyTimerActive) {
                    msg = `Building dice pool... ${strategyTimerValue}s remaining.`;
                } else if (isRolling && !isRedoingRollAfterPrice) { 
                    msg = "Rolling dice...";
                } else if (isRedoingRollAfterPrice) {
                    msg = `Redo the roll of 1! (Price: ${outcomeText.split("Price Paid: ")[1]?.split(". Redo")[0] || 'Paid'})`;
                } else if (canPushLuck) {
                    msg = `A 6! Push your luck? Or Reset.`;
                } else if (canPayPrice) {
                     msg = `A 1! Pay a price to redo this die and continue? Or Reset.`;
                } else if (outcomeText) {
                    msg = outcomeText;
                     if (rolls.length > 0 && !isRolling && !isRedoingRollAfterPrice && !hasStrategyTimeRunOut) { // Don't add XP if strategy timed out
                         msg += ` (XP: ${rolls.length * 10})`;
                         if(pushedLuckDieRoll !== null) msg += ` (Pushed Luck Die: ${pushedLuckDieRoll})`;
                     }
                } else if (currentDicePool === 0 && difficulty > 0 && numSMCovers < difficulty && !isStrategyTimerActive && !hasStrategyTimeRunOut) {
                    msg = `Set difficulty to start strategy phase or add expertise.`;
                } else if (expertise < getNumPrimarySlotsForExpertiseOrEmpty() && !isStrategyTimerActive && !hasStrategyTimeRunOut) {
                    const needed = getNumPrimarySlotsForExpertiseOrEmpty() - expertise;
                    msg = `Need ${needed} more expertise ${needed === 1 ? 'die' : 'dice'} to cover Difficulty ${difficulty}.`;
                }
                statusMessageEl.textContent = msg;
            }

            function updateActionButtons() {
                const currentDicePool = getDicePool();
                const numSMCovers = getNumSpecialMovesVisuallyCoveringSlots();

                rollDiceBtn.classList.remove('roll-mode', 'reset-mode', 'failure-acknowledge-mode');

                if (isTimersPaused) {
                    rollDiceBtn.textContent = "Timers Paused";
                    rollDiceBtn.disabled = true;
                } else if (hasStrategyTimeRunOut) {
                    rollDiceBtn.textContent = "Acknowledge Failure & Reset";
                    rollDiceBtn.disabled = false; 
                    rollDiceBtn.classList.add('failure-acknowledge-mode');
                } else if (isActionCounterSet && actionCounterValue <= 0 && !isRolling && !hasRolledThisTurn) {
                    rollDiceBtn.textContent = "No Actions Left";
                    rollDiceBtn.disabled = true;
                } else if (hasRolledThisTurn && !isRolling && !isRedoingRollAfterPrice) {
                    rollDiceBtn.textContent = "Reset & Prepare Next Roll";
                    rollDiceBtn.disabled = false;
                    rollDiceBtn.classList.add('reset-mode');
                } else if (isRedoingRollAfterPrice) {
                    rollDiceBtn.textContent = "Redo Failed Roll";
                    rollDiceBtn.disabled = isRolling; 
                    rollDiceBtn.classList.add('roll-mode');
                } else {
                    rollDiceBtn.textContent = isRolling ? "Rolling..." : "Roll Dice";
                    rollDiceBtn.disabled =
                        (difficulty > 0 && currentDicePool === 0 && numSMCovers < difficulty) ||
                        isRolling ||
                        !isStrategyTimerActive; // Key: Can only roll if strategy timer is (or was successfully) active
                    rollDiceBtn.classList.add('roll-mode');
                }
                
                pushLuckBtn.style.display = canPushLuck && !isTimersPaused && !hasStrategyTimeRunOut ? 'inline-block' : 'none';
                payPriceBtn.style.display = canPayPrice && !isTimersPaused && !hasStrategyTimeRunOut ? 'inline-block' : 'none';

                // Timer master action buttons
                const showTimerMasterControls = isStrategyTimerActive || hasStrategyTimeRunOut || isActionCounterSet || isTimersPaused;
                timerActionButtonsContainerEl.style.display = showTimerMasterControls ? 'flex' : 'none';
                pauseResumeTimersBtn.textContent = isTimersPaused ? "Resume Timers" : "Pause Timers";
                pauseResumeTimersBtn.disabled = !(isStrategyTimerActive || isActionCounterSet); // Can only pause if a timer is relevant
                resetAllTimersBtn.disabled = !(isStrategyTimerActive || isActionCounterSet || hasStrategyTimeRunOut); // Can reset if any timer was relevant

                // Disable GM controls if timers paused
                decreaseDifficultyBtn.disabled = isTimersPaused || isStrategyTimerActive || hasRolledThisTurn;
                increaseDifficultyBtn.disabled = isTimersPaused || isStrategyTimerActive || hasRolledThisTurn;
                setActionCountBtn.disabled = isTimersPaused;
                setActionCountInputEl.disabled = isTimersPaused;

            }

            function updateDifficultyDisplay() { /* ... (no change) ... */
                difficultyDisplay.textContent = difficulty;
            }

            // --- CORE LOGIC FUNCTIONS ---
            function determineSingleDieOpportunity(die) { /* ... (no change) ... */
                 if (!canPushLuck && !canPayPrice) { 
                    if (die === 6) {
                        canPushLuck = true;
                    } else if (die === 1) {
                        canPayPrice = true;
                    }
                 }
            }

            function finalizeOverallOutcome(diceArray) { /* ... (no change in its direct responsibility for outcome text) ... */
                outcomeText = ""; 
                if (hasStrategyTimeRunOut) { // This takes precedence
                    outcomeText = "Strategy Time Expired! Roll failed.";
                    return;
                }
                if (canPushLuck || canPayPrice || isRedoingRollAfterPrice || pushedLuckDieRoll !== null) {
                     if(!canPushLuck && !canPayPrice && !isRedoingRollAfterPrice && pushedLuckDieRoll !== null) {
                        // Outcome text is already set by handlePushLuck.
                     } else {
                        return; 
                     }
                }

                 if (diceArray.length === 0 && getDicePool() === 0 && getNumSpecialMovesVisuallyCoveringSlots() >= difficulty && difficulty > 0) {
                     outcomeText = "Success! Difficulty covered by special moves, no roll needed.";
                     return;
                 }
                 if (diceArray.length === 0 && getDicePool() === 0 && !(getNumSpecialMovesVisuallyCoveringSlots() >= difficulty && difficulty > 0)) {
                    if (hasRolledThisTurn) { 
                       outcomeText = "No dice rolled. Outcome determined by situation or requires dice."; return;
                    } else {
                        return; 
                    }
                 }
                 if (diceArray.length === 0) return; 

                const highest = Math.max(...diceArray);
                if (highest === 6 && !diceArray.includes(1)) outcomeText = "Success! The goal is achieved, cleanly.";
                else if (highest === 6 && diceArray.includes(1)) outcomeText = "Critical Success with a major complication (6 and 1)!"; 
                else if (highest === 1) outcomeText = "Failure! Face consequences, loss, or harm.";
                else if (highest <= 3) outcomeText = "Failure with a silver lining (2-3)";
                else outcomeText = "Success with a complication (4-5)";
            }
            
            function handleRollSequenceCompletion(completedRolls) {
                isRolling = false; 
                isRedoingRollAfterPrice = false;
                currentRollIndex = null;

                finalizeOverallOutcome(completedRolls); 

                if (isActionCounterSet && actionCounterValue > 0 && !hasStrategyTimeRunOut) { // Don't modify if strategy time out caused failure
                    let modified = false;
                    if (completedRolls.includes(6)) {
                        modifyActionCounter(1);
                        modified = true;
                        if(outcomeText) outcomeText += " (+1 Action)";
                    }
                    if (completedRolls.includes(1)) { // This '1' is a final '1' after any Pay Price
                        modifyActionCounter(-1);
                        modified = true;
                         if(outcomeText) outcomeText += " (-1 Action)";
                    }
                }
                hasRolledThisTurn = true; 
                fullUIUpdate();
            }


            function fullUIUpdate() {
                updateDifficultyDisplay();
                updateStrategyTimerDisplay(); // New
                updateActionCounterDisplay(); // New
                renderDicePool();
                renderPlayerList();
                updateActionButtons();
                updateStatusMessage();
            }

            function handleImageUploadJS(event) { /* ... (no change) ... */
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => { uploadedImage = e.target.result; imagePreviewEl.src = uploadedImage; imagePreviewContainer.style.display = 'block'; };
                    reader.readAsDataURL(file);
                } else {
                    uploadedImage = null;
                    imagePreviewContainer.style.display = 'none';
                    imagePreviewEl.src = "#";
                }
            }

            function addPlayerJS() { /* ... (no change) ... */
                const name = playerNameInput.value.trim();
                if (name) {
                    players.push({
                        id: Date.now(), name, image: uploadedImage,
                        contributedDice: 0, contributedSpecialMoves: 0,
                        color: generatePlayerColor()
                    });
                    playerNameInput.value = ''; playerImageInput.value = ''; uploadedImage = null;
                    imagePreviewContainer.style.display = 'none'; imagePreviewEl.src = "#";
                    addPlayerModalEl.style.display = 'none';
                    fullUIUpdate();
                } else { alert("Player name is required."); }
            }

            function handlePlayerContributesExpertise(playerId) {
                if (hasRolledThisTurn || isRolling || canPushLuck || canPayPrice || isRedoingRollAfterPrice || !isStrategyTimerActive || hasStrategyTimeRunOut || isTimersPaused) return;
                const playerIndex = players.findIndex(p => p.id === playerId);
                if (playerIndex === -1) return;
                if (players[playerIndex].contributedDice < 3) {
                    players[playerIndex].contributedDice += 1;
                    diceContributions.push(playerId); expertise += 1;
                    fullUIUpdate();
                } else { alert(`${players[playerIndex].name} has reached the maximum of 3 expertise contributions.`); }
            }

            function handlePlayerContributesSpecialMove(playerId) {
                 if (hasRolledThisTurn || isRolling || canPushLuck || canPayPrice || isRedoingRollAfterPrice || !isStrategyTimerActive || hasStrategyTimeRunOut || isTimersPaused) return;
                const playerIndex = players.findIndex(p => p.id === playerId);
                if (playerIndex === -1) return;
                const numSMCovers = getNumSpecialMovesVisuallyCoveringSlots();
                if (difficulty > 0 && numSMCovers >= difficulty) {
                    alert("All difficulty slots are already covered by special moves."); return;
                }
                players[playerIndex].contributedSpecialMoves += 1;
                specialMoveContributions.push(playerId); specialMoves += 1;
                fullUIUpdate();
            }

            function clearAllContributionsAndStatsJS(prepareForNextAttempt = true) {
                players.forEach(p => { p.contributedDice = 0; p.contributedSpecialMoves = 0; });
                diceContributions = []; specialMoveContributions = [];
                expertise = 0; specialMoves = 0;
                rolls = []; outcomeText = "";
                isRolling = false; hasRolledThisTurn = false;
                currentRollIndex = null; currentAnimatedValue = null;
                if (sequenceChainTimeoutId) clearTimeout(sequenceChainTimeoutId);
                sequenceChainTimeoutId = null;
                canPushLuck = false; canPayPrice = false;
                pushedLuckDieRoll = null; isRedoingRollAfterPrice = false;
                indexOfRollToRedo = -1;
                currentSequenceTotalDice = 0; 

                if (prepareForNextAttempt) { // Only reset strategy timer conditions if preparing for new attempt
                    resetStrategyTimerConditions();
                }
                // Action counter is NOT reset here, it's persistent for the challenge.
                fullUIUpdate();
            }
            
            function handlePushLuck() {
                if (!canPushLuck || isTimersPaused) return;
                if (sequenceChainTimeoutId) clearTimeout(sequenceChainTimeoutId); 
                sequenceChainTimeoutId = null;

                pushedLuckDieRoll = Math.floor(Math.random() * 6) + 1;
                canPushLuck = false; // Opportunity resolved
                if (pushedLuckDieRoll <= 3) {
                    outcomeText = "Push Your Luck Failed! Original success potentially undone, complication added.";
                } else {
                    outcomeText = "Push Your Luck Succeeded! Advantage pressed further.";
                }
                // rolls array already contains the '6' that triggered this.
                // Add the pushed luck die result to rolls if it's distinct, for XP calc, or just note it.
                // For simplicity, we'll just use outcomeText and hasRolledThisTurn for now for the PYL die.
                // If it needs to be part of 'rolls' for XP, that logic can be added.

                isRolling = false; // Not actively animating dice
                // hasRolledThisTurn = true; // This will be set by handleRollSequenceCompletion
                handleRollSequenceCompletion(rolls.concat(pushedLuckDieRoll)); // Pass all effective dice
            }

             function handlePayPrice() {
                if (!canPayPrice || isTimersPaused) return;
                const pricePaidDescription = prompt("Describe the price you pay (e.g., lose supplies, take stress, alert enemies):");
                if (pricePaidDescription === null) return; // User cancelled
                if (pricePaidDescription.trim() === "") {
                    alert("You must describe a price to pay.");
                    return;
                }

                if (sequenceChainTimeoutId) clearTimeout(sequenceChainTimeoutId);
                sequenceChainTimeoutId = null;

                canPayPrice = false; // Opportunity resolved for now
                isRedoingRollAfterPrice = true; // Set flag to trigger redo logic in startRollingJS
                if(indexOfRollToRedo === -1) { 
                     alert("Error: Could not identify which roll to redo. Resetting.");
                     clearAllContributionsAndStatsJS(); // Full reset
                     return;
                }
                outcomeText = `Price Paid: ${pricePaidDescription}. Redo the roll of 1.`;
                pushedLuckDieRoll = null; 
                isRolling = false;
                // hasRolledThisTurn is already true.
                fullUIUpdate(); // This will change "Roll Dice" button to "Redo Failed Roll"
            }

            function startRollingJS() {
                if (isTimersPaused) return;

                if (rollDiceBtn.classList.contains('failure-acknowledge-mode')) { // From strategy time out
                    // Action counter already decremented by handleStrategyTimeOut
                    clearAllContributionsAndStatsJS(true); // True to reset strategy timer conditions
                    tryStartStrategyTimer(); // Attempt to start for next roll
                    return;
                }

                if (rollDiceBtn.classList.contains('reset-mode')) {
                    clearAllContributionsAndStatsJS(true);
                    tryStartStrategyTimer();
                    return;
                }
                
                // If strategy time ran out, this roll attempt is void.
                if (hasStrategyTimeRunOut) {
                    // This state should be handled by the 'failure-acknowledge-mode' button.
                    // If somehow reached here, re-evaluate.
                    console.warn("Roll attempt while strategy time has run out, but not via acknowledge button.");
                    fullUIUpdate(); // Ensure UI reflects timeout
                    return;
                }
                
                // Stop strategy timer if it was active (means player clicked Roll before it ran out)
                if (isStrategyTimerActive) {
                    stopStrategyTimer();
                    isStrategyTimerActive = false; // Mark as no longer counting down
                    // strategyTimerValue will hold the remaining time, but it's not used further for this roll
                }


                if (isRedoingRollAfterPrice) {
                    // ... (existing redo logic, no change needed here regarding timers)
                    if (indexOfRollToRedo === -1) {
                        alert("Error: Cannot redo roll, index invalid.");
                        isRedoingRollAfterPrice = false; fullUIUpdate(); return;
                    }
                    isRolling = true; 
                    outcomeText = ""; 
                    currentAnimatedValue = null;
                    currentRollIndex = indexOfRollToRedo; 
                    renderDicePool();

                    let animationCounter = 0;
                    const animationIntervalId = setInterval(() => {
                        currentAnimatedValue = Math.floor(Math.random() * 6) + 1;
                        renderDicePool();
                        animationCounter++;
                        if (animationCounter >= SINGLE_DIE_ANIMATION_FRAMES) {
                            clearInterval(animationIntervalId);
                            const newDieRoll = Math.floor(Math.random() * 6) + 1;
                            rolls[indexOfRollToRedo] = newDieRoll;
                            currentAnimatedValue = newDieRoll;
                            renderDicePool();

                            const redoDisplayPauseTimeout = setTimeout(() => {
                                currentAnimatedValue = null; // Clear animation value
                                // isRolling = false; // Don't set to false yet if resuming sequence
                                // isRedoingRollAfterPrice = false; // This flag is cleared after sequence or new opportunity

                                determineSingleDieOpportunity(newDieRoll);

                                if (canPushLuck || canPayPrice) {
                                    isRolling = false; // Pause the sequence, opportunity arose
                                    isRedoingRollAfterPrice = false; // The redo itself is done
                                    hasRolledThisTurn = true; 
                                    if (canPayPrice) indexOfRollToRedo = currentRollIndex; // Update if the new roll is a 1
                                    fullUIUpdate();
                                } else {
                                    // No new opportunity from redone die. Try to resume sequence.
                                    const dieSlotThatWasRedone = indexOfRollToRedo; 
                                    indexOfRollToRedo = -1; 
                                    outcomeText = ""; 
                                    
                                    const nextDieInOriginalSequence = dieSlotThatWasRedone + 1;

                                    if (nextDieInOriginalSequence < currentSequenceTotalDice) {
                                        isRolling = true; 
                                        isRedoingRollAfterPrice = false; // Redo is done, main sequence continues
                                        fullUIUpdate(); 

                                        sequenceChainTimeoutId = setTimeout(() => {
                                            if(isRolling) { 
                                                processNextDieInSequence(nextDieInOriginalSequence, currentSequenceTotalDice);
                                            }
                                        }, SINGLE_DIE_POST_ANIMATION_PAUSE / 2); 
                                    } else {
                                        // The redone die was the last one.
                                        isRedoingRollAfterPrice = false; // Redo is done.
                                        handleRollSequenceCompletion(rolls);
                                    }
                                }
                            }, SINGLE_DIE_POST_ANIMATION_PAUSE);
                        }
                    }, SINGLE_DIE_ANIMATION_INTERVAL);
                    return;
                }
                
                // --- Standard Roll (Not Redo) ---
                const currentDicePool = getDicePool();
                const numSMCovers = getNumSpecialMovesVisuallyCoveringSlots();
                 if (currentDicePool === 0) {
                    if (difficulty > 0 && numSMCovers >= difficulty) {
                         outcomeText = "Success! Difficulty covered by special moves, no roll needed.";
                         finalizeOverallOutcome([]); // Pass empty array for consistency
                         hasRolledThisTurn = true;
                    } else if (difficulty > 0 && numSMCovers < difficulty) {
                        outcomeText = "Cannot roll: Need more expertise or special moves for this difficulty.";
                        // hasRolledThisTurn = false; // Not a full turn attempt
                    } else { // difficulty is 0
                        outcomeText = "Difficulty is 0, automatic success assumed. No roll needed.";
                         finalizeOverallOutcome([]);
                         hasRolledThisTurn = true;
                    }
                    // Decrement action counter for this attempt if it was a "no dice needed" success or a valid attempt setup
                    if (isActionCounterSet && actionCounterValue > 0 && (outcomeText.startsWith("Success!") || outcomeText.startsWith("Difficulty is 0"))) {
                        actionCounterValue--;
                        updateActionCounterDisplay();
                    }
                    isRolling = false; fullUIUpdate(); return;
                }

                // Decrement action counter for this roll attempt
                if (isActionCounterSet && actionCounterValue > 0) {
                    actionCounterValue--;
                    updateActionCounterDisplay();
                } else if (isActionCounterSet && actionCounterValue <= 0) {
                    // This check should ideally be handled by button state, but as a safeguard:
                    outcomeText = "No actions left to perform this roll.";
                    isRolling = false; fullUIUpdate(); return;
                }


                rolls = []; 
                for(let i=0; i < currentDicePool; ++i) rolls.push(undefined); 

                outcomeText = "";
                canPushLuck = false; canPayPrice = false; pushedLuckDieRoll = null;
                if (sequenceChainTimeoutId) clearTimeout(sequenceChainTimeoutId);
                sequenceChainTimeoutId = null;

                isRolling = true; hasRolledThisTurn = false; 
                currentRollIndex = 0;
                currentAnimatedValue = null;
                currentSequenceTotalDice = currentDicePool; 

                fullUIUpdate();
                processNextDieInSequence(0, currentSequenceTotalDice);
            }

            function processNextDieInSequence(rollIdx, totalDiceInPool) {
                if (!isRolling || isTimersPaused) { // Added isTimersPaused check
                    return;
                }
                if (canPushLuck || canPayPrice) {
                    fullUIUpdate(); 
                    return;
                }

                currentRollIndex = rollIdx;
                currentAnimatedValue = null;
                renderDicePool(); 

                let animationCounter = 0;
                const animationIntervalId = setInterval(() => {
                    if (isTimersPaused) { // Check again in interval in case pause happened mid-animation
                        clearInterval(animationIntervalId); // Stop this die's animation
                        // State will be preserved, resume will pick up or UI will reflect pause
                        return;
                    }
                    currentAnimatedValue = Math.floor(Math.random() * 6) + 1;
                    renderDicePool();
                    animationCounter++;

                    if (animationCounter >= SINGLE_DIE_ANIMATION_FRAMES) {
                        clearInterval(animationIntervalId);

                        const currentDieRoll = Math.floor(Math.random() * 6) + 1;
                        rolls[rollIdx] = currentDieRoll;
                        currentAnimatedValue = currentDieRoll;
                        renderDicePool();

                        const postAnimationPauseTimeout = setTimeout(() => {
                            currentAnimatedValue = null;
                            renderDicePool(); // Clear animation value from display

                            determineSingleDieOpportunity(currentDieRoll);

                            if (canPushLuck || canPayPrice) {
                                isRolling = false; 
                                hasRolledThisTurn = true; 
                                if (canPayPrice) {
                                    indexOfRollToRedo = rollIdx; 
                                }
                                fullUIUpdate();
                                return; 
                            }

                            const isLastDieInSequence = (rollIdx + 1) >= totalDiceInPool;

                            if (isLastDieInSequence) {
                                // isRolling = false; // Handled by handleRollSequenceCompletion
                                // currentRollIndex = null;
                                // finalizeOverallOutcome(rolls);
                                // hasRolledThisTurn = true;
                                handleRollSequenceCompletion(rolls);
                                // fullUIUpdate(); // Called by handleRollSequenceCompletion
                            } else {
                                const delayForNextDie = BASE_DELAY_AFTER_DIE_FINISHES + (rollIdx * DELAY_INCREMENT_PER_DIE);
                                sequenceChainTimeoutId = setTimeout(() => {
                                    if (isRolling && !isTimersPaused) { // Check again
                                        processNextDieInSequence(rollIdx + 1, totalDiceInPool);
                                    }
                                }, delayForNextDie);
                            }
                        }, SINGLE_DIE_POST_ANIMATION_PAUSE);
                    }
                }, SINGLE_DIE_ANIMATION_INTERVAL);
            }

            // --- EVENT LISTENERS ---
            decreaseDifficultyBtn.addEventListener('click', () => { 
                if (!isRolling && !hasRolledThisTurn && !canPushLuck && !canPayPrice && !isStrategyTimerActive && !isTimersPaused) { 
                    difficulty = Math.max(0, difficulty - 1); 
                    fullUIUpdate(); 
                    tryStartStrategyTimer(); // Attempt to start timer after difficulty change
                }
            });
            increaseDifficultyBtn.addEventListener('click', () => { 
                 if (!isRolling && !hasRolledThisTurn && !canPushLuck && !canPayPrice && !isStrategyTimerActive && !isTimersPaused) {
                    difficulty += 1; 
                    fullUIUpdate(); 
                    tryStartStrategyTimer();
                }
            });
            openAddPlayerModalBtn.addEventListener('click', () => { addPlayerModalEl.style.display = 'flex'; });
            cancelAddPlayerBtn.addEventListener('click', () => {
                addPlayerModalEl.style.display = 'none'; playerNameInput.value = ''; playerImageInput.value = '';
                uploadedImage = null; imagePreviewContainer.style.display = 'none'; imagePreviewEl.src = '#';
            });
            confirmAddPlayerBtn.addEventListener('click', addPlayerJS);
            playerImageInput.addEventListener('change', handleImageUploadJS);
            rollDiceBtn.addEventListener('click', startRollingJS);
            pushLuckBtn.addEventListener('click', handlePushLuck);
            payPriceBtn.addEventListener('click', handlePayPrice);

            // New Timer Event Listeners
            setActionCountBtn.addEventListener('click', handleSetActionCounter);
            pauseResumeTimersBtn.addEventListener('click', togglePauseTimers);
            resetAllTimersBtn.addEventListener('click', handleResetAllTimers);


            // Initial Setup
            fullUIUpdate();
            updateStrategyTimerDisplay(); // Ensure timer display is correct on load
            updateActionCounterDisplay(); // Ensure action counter display is correct on load
        });
    </script>
