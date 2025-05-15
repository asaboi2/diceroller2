
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

            // --- TIMERS STATE ---
            const STRATEGY_TIME_INITIAL = 90;
            let strategyTimeRemaining = STRATEGY_TIME_INITIAL;
            let strategyTimerIntervalId = null;
            let strategyTimerHasExpired = false;
            let countdownClockActions = 0;
            let countdownClockInitialSet = 0;
            let isCountdownClockActive = false;
            let areTimersPausedGlobally = false;


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

            // Timer DOM Elements
            const strategyTimerDisplayEl = document.getElementById('strategyTimerDisplay');
            const strategyTimerStatusEl = document.getElementById('strategyTimerStatus');
            const countdownClockDisplayEl = document.getElementById('countdownClockDisplay');
            const setCountdownClockInputEl = document.getElementById('setCountdownClockInput');
            const setCountdownClockBtnEl = document.getElementById('setCountdownClockBtn');
            const pauseResumeTimersBtnEl = document.getElementById('pauseResumeTimersBtn');
            const masterResetTimersBtnEl = document.getElementById('masterResetTimersBtn');

            const DICE_ICON = '🎲';
            const STAR_ICON = '✨';
            // const USER_ICON = '👤'; // Not used directly in visible UI text

            // --- TIMER FUNCTIONS ---
            function updateStrategyTimerDisplay() {
                if (!strategyTimerDisplayEl || !strategyTimerStatusEl) return;
                if (strategyTimerHasExpired) {
                    strategyTimerDisplayEl.textContent = "0s";
                    strategyTimerDisplayEl.classList.add('expired');
                    strategyTimerStatusEl.textContent = "Time's Up!";
                    strategyTimerStatusEl.classList.add('active');
                } else {
                    strategyTimerDisplayEl.textContent = `${strategyTimeRemaining}s`;
                    strategyTimerDisplayEl.classList.remove('expired');
                    if (areTimersPausedGlobally && isStrategyTimerActive()) {
                        strategyTimerStatusEl.textContent = "Paused";
                        strategyTimerStatusEl.classList.add('active');
                    } else if (isStrategyTimerActive()) {
                         strategyTimerStatusEl.textContent = "Planning...";
                         strategyTimerStatusEl.classList.add('active');
                    } else {
                        strategyTimerStatusEl.textContent = "";
                        strategyTimerStatusEl.classList.remove('active');
                    }
                }
            }

            function updateCountdownClockDisplay() {
                if (!countdownClockDisplayEl) return;
                if (isCountdownClockActive) {
                    countdownClockDisplayEl.textContent = countdownClockActions;
                    if (countdownClockActions <= 0) {
                        countdownClockDisplayEl.classList.add('expired');
                    } else {
                        countdownClockDisplayEl.classList.remove('expired');
                    }
                } else {
                    countdownClockDisplayEl.textContent = '--';
                    countdownClockDisplayEl.classList.remove('expired');
                }
            }

            function isStrategyTimerActive() {
                return strategyTimerIntervalId !== null && !strategyTimerHasExpired && strategyTimeRemaining > 0;
            }

            function startStrategyTimer() {
                if (isRolling || hasRolledThisTurn || strategyTimerHasExpired || areTimersPausedGlobally) {
                    updateStrategyTimerDisplay(); // Ensure display is correct even if not starting
                    return;
                }
                clearInterval(strategyTimerIntervalId);
                strategyTimeRemaining = STRATEGY_TIME_INITIAL;
                // strategyTimerHasExpired is reset by clearAllContributionsAndStatsJS or masterResetTimersBtn
                updateStrategyTimerDisplay();

                strategyTimerIntervalId = setInterval(() => {
                    if (areTimersPausedGlobally || strategyTimerHasExpired) {
                        updateStrategyTimerDisplay(); // Reflect paused state
                        return; // Effectively paused or if already expired by other means
                    }
                    strategyTimeRemaining--;
                    updateStrategyTimerDisplay();

                    if (strategyTimeRemaining <= 0) {
                        clearInterval(strategyTimerIntervalId);
                        strategyTimerIntervalId = null;
                        strategyTimerHasExpired = true;
                        outcomeText = "Strategy Timer Expired! Roll automatically fails.";
                        hasRolledThisTurn = true;
                        isRolling = false;
                        rolls = [];
                        // Keep expertise & special moves for record, but the roll itself fails
                        fullUIUpdate();
                    }
                }, 1000);
            }

            function stopStrategyTimer(isFullReset = false) {
                clearInterval(strategyTimerIntervalId);
                strategyTimerIntervalId = null;
                if (isFullReset) {
                    strategyTimeRemaining = STRATEGY_TIME_INITIAL;
                    // strategyTimerHasExpired is handled by the caller of full reset
                }
                updateStrategyTimerDisplay();
            }

            function handleSetCountdownClock() {
                const val = parseInt(setCountdownClockInputEl.value);
                if (isNaN(val) || val < 0) {
                    countdownClockInitialSet = 0;
                    countdownClockActions = 0;
                    isCountdownClockActive = false;
                } else {
                    countdownClockInitialSet = val;
                    countdownClockActions = val;
                    isCountdownClockActive = true;
                }
                updateCountdownClockDisplay();
                fullUIUpdate();
            }

            function processEndOfTurnForCountdown(completedRollsArray) {
                if (!isCountdownClockActive || areTimersPausedGlobally || !hasRolledThisTurn) return;

                // Only decrement the main action if a roll attempt was made (not just SM success)
                // or if strategy timer expired (counts as a turn/action used)
                if ((completedRollsArray && completedRollsArray.length > 0) || strategyTimerHasExpired) {
                     countdownClockActions--;
                }


                if (completedRollsArray && completedRollsArray.length > 0) {
                    const hasSix = completedRollsArray.some(r => r === 6);
                    const hasOne = completedRollsArray.some(r => r === 1);

                    if (hasSix) countdownClockActions++;
                    if (hasOne) countdownClockActions--; // This might be a double penalty if payPrice also costs an action; adjust if needed
                }
                countdownClockActions = Math.max(0, countdownClockActions);
                updateCountdownClockDisplay();
            }

            function handlePauseResumeTimers() {
                areTimersPausedGlobally = !areTimersPausedGlobally;
                pauseResumeTimersBtnEl.textContent = areTimersPausedGlobally ? 'Resume Timers' : 'Pause Timers';

                if (!areTimersPausedGlobally) {
                    if (!isStrategyTimerActive() && !hasRolledThisTurn && !strategyTimerHasExpired) {
                         startStrategyTimer();
                    }
                }
                updateStrategyTimerDisplay();
                fullUIUpdate();
            }

            function handleMasterResetTimers() {
                areTimersPausedGlobally = false;
                pauseResumeTimersBtnEl.textContent = 'Pause Timers';

                stopStrategyTimer(true);
                strategyTimerHasExpired = false;
                startStrategyTimer(); // Restart for fresh planning

                const initialCountdownVal = parseInt(setCountdownClockInputEl.value) || countdownClockInitialSet; // Use initial set if input is cleared
                countdownClockInitialSet = initialCountdownVal; // Update stored initial
                countdownClockActions = initialCountdownVal;
                isCountdownClockActive = initialCountdownVal > 0;

                updateCountdownClockDisplay();
                fullUIUpdate();
            }


            // --- CORE FUNCTIONS ---
            function generatePlayerColor() {
                const hue = nextPlayerHue;
                nextPlayerHue = (nextPlayerHue + HUE_INCREMENT) % 360;
                return `hsl(${hue}, ${SATURATION}%, ${LIGHTNESS}%)`;
            }
            const getNumSpecialMovesVisuallyCoveringSlots = () => Math.min(specialMoves, Math.max(0, difficulty));
            const getNumPrimarySlotsForExpertiseOrEmpty = () => {
                const coveredBySM = getNumSpecialMovesVisuallyCoveringSlots();
                return Math.max(0, difficulty - coveredBySM);
            };
            const getDicePool = () => expertise;

            function renderDicePool() {
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
                const commonDisableCondition = isRolling || canPushLuck || canPayPrice || isRedoingRollAfterPrice || hasRolledThisTurn || strategyTimerHasExpired || (isCountdownClockActive && countdownClockActions <= 0 && !hasRolledThisTurn && !isRolling);

                players.forEach(player => {
                    const playerItemDiv = document.createElement('div');
                    playerItemDiv.classList.add('player-item');

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
                    addExpertiseBtn.disabled = player.contributedDice >= 3 || commonDisableCondition;
                    addExpertiseBtn.addEventListener('click', () => handlePlayerContributesExpertise(player.id));
                    actionIconsDiv.appendChild(addExpertiseBtn);

                    const addSpecialMoveBtn = document.createElement('button');
                    addSpecialMoveBtn.classList.add('player-action-btn'); addSpecialMoveBtn.innerHTML = STAR_ICON;
                    addSpecialMoveBtn.title = `Add Special Move`;
                    const numSMCovers = getNumSpecialMovesVisuallyCoveringSlots();
                    addSpecialMoveBtn.disabled = (difficulty > 0 && numSMCovers >= difficulty) || commonDisableCondition;
                    addSpecialMoveBtn.addEventListener('click', () => handlePlayerContributesSpecialMove(player.id));
                    actionIconsDiv.appendChild(addSpecialMoveBtn);

                    playerItemDiv.appendChild(actionIconsDiv);
                    playerListEl.appendChild(playerItemDiv);
                });
            }

            function updateStatusMessage() {
                let msg = "Ready to roll!";
                const numPrimarySlotsNeeded = getNumPrimarySlotsForExpertiseOrEmpty();
                const currentDicePool = getDicePool();

                if (strategyTimerHasExpired) {
                    msg = outcomeText || "Strategy Timer Expired! Roll failed. Reset to try again.";
                } else if (isCountdownClockActive && countdownClockActions <= 0 && !hasRolledThisTurn && !isRolling) {
                     msg = "No actions left! Set more actions or Reset.";
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
                     if (rolls.length > 0 && !isRolling && !isRedoingRollAfterPrice) {
                         msg += ` (XP: ${rolls.length * 10})`;
                         if(pushedLuckDieRoll !== null) msg += ` (Pushed Luck Die: ${pushedLuckDieRoll})`;
                     }
                     if (isCountdownClockActive && countdownClockActions <= 0 && hasRolledThisTurn) {
                         msg += " Final action was used!";
                     }
                } else if (currentDicePool === 0 && difficulty > 0 && getNumSpecialMovesVisuallyCoveringSlots() < difficulty) {
                    msg = `Add expertise dice to attempt Difficulty ${difficulty}.`;
                } else if (expertise < numPrimarySlotsNeeded) {
                    const needed = numPrimarySlotsNeeded - expertise;
                    msg = `Need ${needed} more expertise ${needed === 1 ? 'die' : 'dice'} to cover Difficulty ${difficulty}.`;
                }
                statusMessageEl.textContent = msg;
            }

            function updateActionButtons() {
                const currentDicePool = getDicePool();
                const numSMCovers = getNumSpecialMovesVisuallyCoveringSlots();
                rollDiceBtn.classList.remove('roll-mode', 'reset-mode');

                if (strategyTimerHasExpired) {
                    rollDiceBtn.textContent = "Reset";
                    rollDiceBtn.disabled = false;
                    rollDiceBtn.classList.add('reset-mode');
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
                    rollDiceBtn.disabled = isRolling ||
                        (difficulty > 0 && currentDicePool === 0 && numSMCovers < difficulty) ||
                        (isCountdownClockActive && countdownClockActions <= 0);
                    rollDiceBtn.classList.add('roll-mode');
                    if (isCountdownClockActive && countdownClockActions <= 0 && !isRolling && !hasRolledThisTurn) {
                         rollDiceBtn.textContent = "No Actions Left";
                    }
                }

                pushLuckBtn.style.display = canPushLuck && !strategyTimerHasExpired ? 'inline-block' : 'none';
                payPriceBtn.style.display = canPayPrice && !strategyTimerHasExpired ? 'inline-block' : 'none';
            }

            function updateDifficultyDisplay() {
                difficultyDisplay.textContent = difficulty;
            }

            function determineSingleDieOpportunity(die) {
                 if (!canPushLuck && !canPayPrice) {
                    if (die === 6) {
                        canPushLuck = true;
                    } else if (die === 1) {
                        canPayPrice = true;
                    }
                 }
            }

            function finalizeOverallOutcome(diceArray) {
                outcomeText = ""; // Clear previous outcome
                if (strategyTimerHasExpired) {
                    outcomeText = "Strategy Timer Expired! Roll automatically fails.";
                    return;
                }
                if (canPushLuck || canPayPrice || isRedoingRollAfterPrice) {
                     // Specific messages for these states are handled by their respective functions or updateStatusMessage
                     // If pushedLuckDieRoll IS set, but other flags are false, it means PYL resolved.
                     if(!canPushLuck && !canPayPrice && !isRedoingRollAfterPrice && pushedLuckDieRoll !== null) {
                        // Outcome text for PYL already set by handlePushLuck if it resolved.
                     } else {
                        return; // Don't set a generic outcome if an opportunity is pending or just resolved via PYL.
                     }
                }


                 if (diceArray.length === 0 && getDicePool() === 0 && getNumSpecialMovesVisuallyCoveringSlots() >= difficulty && difficulty > 0) {
                     outcomeText = "Success! Difficulty covered by special moves, no roll needed.";
                     return;
                 }

                 if (diceArray.length === 0 && getDicePool() === 0 && !(getNumSpecialMovesVisuallyCoveringSlots() >= difficulty && difficulty > 0)) {
                    if (hasRolledThisTurn) { // Only if a "roll" action was attempted
                       outcomeText = "No dice rolled. Outcome determined by situation or requires dice."; return;
                    } else {
                        return; // Not yet rolled, don't set an outcome
                    }
                 }
                 if (diceArray.length === 0 && !pushedLuckDieRoll) return; // Avoid setting outcome if no dice results yet and PYL not done

                const effectiveDice = diceArray.filter(d => d !== undefined); // Filter out any undefined from redo scenarios if needed
                if (effectiveDice.length === 0 && !pushedLuckDieRoll) return; // Still no real results

                const highest = Math.max(...effectiveDice);
                if (pushedLuckDieRoll !== null) {
                    // PYL logic has already set outcomeText if PYL happened
                    // This function should primarily focus on the main roll's outcome if PYL wasn't the most recent event.
                } else if (highest === 6 && !effectiveDice.includes(1)) outcomeText = "Success! The goal is achieved, cleanly.";
                else if (highest === 6 && effectiveDice.includes(1)) outcomeText = "Critical Success with a major complication (6 and 1)!";
                else if (highest === 1) outcomeText = "Failure! Face consequences, loss, or harm.";
                else if (highest <= 3) outcomeText = "Failure with a silver lining (2-3)";
                else if (highest >= 4) outcomeText = "Success with a complication (4-5)";
                else {
                    // This case should ideally not be reached if diceArray has numbers
                    outcomeText = "Outcome unclear. Review dice results.";
                }
            }

            function fullUIUpdate() {
                updateDifficultyDisplay();
                renderDicePool();
                renderPlayerList();
                updateStrategyTimerDisplay();
                updateCountdownClockDisplay();
                updateActionButtons();
                updateStatusMessage();
            }

            function handleImageUploadJS(event) {
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

            function addPlayerJS() {
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
                if (hasRolledThisTurn || isRolling || canPushLuck || canPayPrice || isRedoingRollAfterPrice || strategyTimerHasExpired || (isCountdownClockActive && countdownClockActions <= 0 && !isRolling && !hasRolledThisTurn)) return;
                const playerIndex = players.findIndex(p => p.id === playerId);
                if (playerIndex === -1) return;
                if (players[playerIndex].contributedDice < 3) {
                    players[playerIndex].contributedDice += 1;
                    diceContributions.push(playerId); expertise += 1;
                    fullUIUpdate();
                } else { alert(`${players[playerIndex].name} has reached the maximum of 3 expertise contributions.`); }
            }

            function handlePlayerContributesSpecialMove(playerId) {
                 if (hasRolledThisTurn || isRolling || canPushLuck || canPayPrice || isRedoingRollAfterPrice || strategyTimerHasExpired || (isCountdownClockActive && countdownClockActions <= 0 && !isRolling && !hasRolledThisTurn)) return;
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

            function clearAllContributionsAndStatsJS() {
                // Process countdown clock *before* resetting hasRolledThisTurn
                processEndOfTurnForCountdown(rolls);

                players.forEach(p => { p.contributedDice = 0; p.contributedSpecialMoves = 0; });
                diceContributions = []; specialMoveContributions = [];
                expertise = 0; specialMoves = 0;
                rolls = [];
                outcomeText = "";
                isRolling = false;
                hasRolledThisTurn = false; // Now reset for the new turn
                currentRollIndex = null; currentAnimatedValue = null;
                if (sequenceChainTimeoutId) clearTimeout(sequenceChainTimeoutId);
                sequenceChainTimeoutId = null;
                canPushLuck = false; canPayPrice = false;
                pushedLuckDieRoll = null; isRedoingRollAfterPrice = false;
                indexOfRollToRedo = -1;
                currentSequenceTotalDice = 0;

                stopStrategyTimer(true);
                strategyTimerHasExpired = false;
                fullUIUpdate(); // Update UI before restarting timer
                if (!areTimersPausedGlobally) {
                    startStrategyTimer();
                }
            }

            function handlePushLuck() {
                if (!canPushLuck) return;
                if (sequenceChainTimeoutId) clearTimeout(sequenceChainTimeoutId);
                sequenceChainTimeoutId = null;
                pushedLuckDieRoll = Math.floor(Math.random() * 6) + 1;
                canPushLuck = false;
                if (pushedLuckDieRoll <= 3) {
                    outcomeText = "Push Your Luck Failed! Original success potentially undone, complication added.";
                } else {
                    outcomeText = "Push Your Luck Succeeded! Advantage pressed further.";
                }
                // Add PYL result to rolls if it's a unique outcome not already represented
                // Or simply track it separately for display as done.
                isRolling = false;
                hasRolledThisTurn = true; // The turn concludes here or moves to reset
                fullUIUpdate();
            }

             function handlePayPrice() {
                if (!canPayPrice) return;
                const pricePaidDescription = prompt("Describe the price you pay (e.g., lose supplies, take stress, alert enemies):");
                if (pricePaidDescription === null) return; // User cancelled
                if (pricePaidDescription.trim() === "") {
                    alert("You must describe a price to pay.");
                    return;
                }

                if (sequenceChainTimeoutId) clearTimeout(sequenceChainTimeoutId);
                sequenceChainTimeoutId = null;

                canPayPrice = false;
                isRedoingRollAfterPrice = true;
                if(indexOfRollToRedo === -1) {
                     alert("Error: Could not identify which roll to redo. Resetting.");
                     clearAllContributionsAndStatsJS();
                     return;
                }
                outcomeText = `Price Paid: ${pricePaidDescription}. Redo the roll of 1.`;
                pushedLuckDieRoll = null;
                isRolling = false;
                // hasRolledThisTurn is already true.
                fullUIUpdate();
            }

            function startRollingJS() {
                if (rollDiceBtn.classList.contains('reset-mode')) {
                    clearAllContributionsAndStatsJS();
                    return;
                }
                if (strategyTimerHasExpired) {
                     // Should be caught by button being in reset mode.
                     // If somehow not, status message will indicate.
                     return;
                }
                if (isStrategyTimerActive() && !areTimersPausedGlobally) {
                    stopStrategyTimer(); // Successfully used strategy time
                }
                if (isCountdownClockActive && countdownClockActions <= 0) {
                    statusMessageEl.textContent = "No actions left to roll!";
                    return;
                }

                if (isRedoingRollAfterPrice) {
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
                            const newDieRoll = Math.floor(Math.random() * 6) + 1; // Ensure 2-6 for a redo? Or allow another 1? Current allows 1.
                            rolls[indexOfRollToRedo] = newDieRoll;
                            currentAnimatedValue = newDieRoll;
                            renderDicePool();

                            const redoDisplayPauseTimeout = setTimeout(() => {
                                currentAnimatedValue = null;
                                isRolling = false;
                                isRedoingRollAfterPrice = false;

                                determineSingleDieOpportunity(newDieRoll);

                                if (canPushLuck || canPayPrice) {
                                    hasRolledThisTurn = true;
                                    fullUIUpdate();
                                } else {
                                    const dieSlotThatWasRedone = indexOfRollToRedo;
                                    indexOfRollToRedo = -1;
                                    outcomeText = "";

                                    const nextDieInOriginalSequence = dieSlotThatWasRedone + 1;

                                    if (nextDieInOriginalSequence < currentSequenceTotalDice) {
                                        isRolling = true;
                                        fullUIUpdate();

                                        sequenceChainTimeoutId = setTimeout(() => {
                                            if(isRolling) {
                                                processNextDieInSequence(nextDieInOriginalSequence, currentSequenceTotalDice);
                                            }
                                        }, SINGLE_DIE_POST_ANIMATION_PAUSE / 2);
                                    } else {
                                        finalizeOverallOutcome(rolls);
                                        hasRolledThisTurn = true;
                                        fullUIUpdate();
                                    }
                                }
                            }, SINGLE_DIE_POST_ANIMATION_PAUSE);
                        }
                    }, SINGLE_DIE_ANIMATION_INTERVAL);
                    return;
                }

                const currentDicePool = getDicePool();
                const numSMCovers = getNumSpecialMovesVisuallyCoveringSlots();
                 if (currentDicePool === 0) {
                    if (difficulty > 0 && numSMCovers >= difficulty) {
                         outcomeText = "Success! Difficulty covered by special moves, no roll needed.";
                         finalizeOverallOutcome([]); // Pass empty for SM success type
                         hasRolledThisTurn = true;
                    } else if (difficulty > 0 && numSMCovers < difficulty) {
                        outcomeText = "Cannot roll: Need more expertise or special moves for this difficulty.";
                        hasRolledThisTurn = false;
                    } else { // difficulty is 0
                        outcomeText = "Difficulty is 0, automatic success assumed. No roll needed.";
                         finalizeOverallOutcome([]);
                         hasRolledThisTurn = true;
                    }
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
                if (!isRolling) {
                    return;
                }
                if (canPushLuck || canPayPrice) { // If an opportunity arose from a *previous* die
                    fullUIUpdate();
                    return;
                }

                currentRollIndex = rollIdx;
                currentAnimatedValue = null;
                renderDicePool();

                let animationCounter = 0;
                const animationIntervalId = setInterval(() => {
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
                            renderDicePool(); // Clear animation class

                            determineSingleDieOpportunity(currentDieRoll);

                            if (canPushLuck || canPayPrice) {
                                isRolling = false; // PAUSE the sequence
                                hasRolledThisTurn = true;
                                if (canPayPrice) {
                                    indexOfRollToRedo = rollIdx;
                                }
                                fullUIUpdate();
                                return;
                            }

                            const isLastDieInSequence = (rollIdx + 1) >= totalDiceInPool;

                            if (isLastDieInSequence) {
                                isRolling = false;
                                currentRollIndex = null;
                                finalizeOverallOutcome(rolls);
                                hasRolledThisTurn = true;
                                fullUIUpdate();
                            } else {
                                const delayForNextDie = BASE_DELAY_AFTER_DIE_FINISHES + (rollIdx * DELAY_INCREMENT_PER_DIE);
                                sequenceChainTimeoutId = setTimeout(() => {
                                    if (isRolling) {
                                        processNextDieInSequence(rollIdx + 1, totalDiceInPool);
                                    }
                                }, delayForNextDie);
                            }
                        }, SINGLE_DIE_POST_ANIMATION_PAUSE);
                    }
                }, SINGLE_DIE_ANIMATION_INTERVAL);
            }

            // --- EVENT LISTENERS ---
            const commonDisableForDifficulty = () => isRolling || hasRolledThisTurn || canPushLuck || canPayPrice || isRedoingRollAfterPrice || strategyTimerHasExpired;

            decreaseDifficultyBtn.addEventListener('click', () => {
                if (!commonDisableForDifficulty()) {
                    difficulty = Math.max(0, difficulty - 1);
                    stopStrategyTimer(true); strategyTimerHasExpired = false;
                    fullUIUpdate(); // Update display first
                    if(!areTimersPausedGlobally) startStrategyTimer(); // Then start
                }
            });
            increaseDifficultyBtn.addEventListener('click', () => {
                if (!commonDisableForDifficulty()) {
                    difficulty += 1;
                    stopStrategyTimer(true); strategyTimerHasExpired = false;
                    fullUIUpdate(); // Update display first
                    if(!areTimersPausedGlobally) startStrategyTimer(); // Then start
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
            setCountdownClockBtnEl.addEventListener('click', handleSetCountdownClock);
            pauseResumeTimersBtnEl.addEventListener('click', handlePauseResumeTimers);
            masterResetTimersBtnEl.addEventListener('click', handleMasterResetTimers);

            // --- INITIALIZATION ---
            handleSetCountdownClock();
            fullUIUpdate();
            if (!areTimersPausedGlobally) {
                startStrategyTimer();
            }
        });
    </script>
