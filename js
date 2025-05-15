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
            // let numDiceToResumeAfterPrice = 0; // REMOVED - Replaced by currentSequenceTotalDice logic
            // let currentResumeRollCount = 0;   // REMOVED

            let currentSequenceTotalDice = 0; // NEW: To track total dice in the current full roll sequence

            let nextPlayerHue = 0;
            const HUE_INCREMENT = 40;
            const SATURATION = 70;
            const LIGHTNESS = 55;

            const SINGLE_DIE_ANIMATION_FRAMES = 5;
            const SINGLE_DIE_ANIMATION_INTERVAL = 50;
            const SINGLE_DIE_POST_ANIMATION_PAUSE = 500;

            const BASE_DELAY_AFTER_DIE_FINISHES = 100;
            const DELAY_INCREMENT_PER_DIE = 250;


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

            const DICE_ICON = '🎲';
            const STAR_ICON = '✨';
            const USER_ICON = '👤';

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
                    const currentExpertiseDieOriginalIndex = k; // This is the index within the 'expertise' dice pool
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
                    addExpertiseBtn.disabled = player.contributedDice >= 3 || isRolling || canPushLuck || canPayPrice || isRedoingRollAfterPrice || hasRolledThisTurn;
                    addExpertiseBtn.addEventListener('click', () => handlePlayerContributesExpertise(player.id));
                    actionIconsDiv.appendChild(addExpertiseBtn);
                    const addSpecialMoveBtn = document.createElement('button');
                    addSpecialMoveBtn.classList.add('player-action-btn'); addSpecialMoveBtn.innerHTML = STAR_ICON;
                    addSpecialMoveBtn.title = `Add Special Move`;
                    const numSMCovers = getNumSpecialMovesVisuallyCoveringSlots();
                    addSpecialMoveBtn.disabled = (difficulty > 0 && numSMCovers >= difficulty) || isRolling || canPushLuck || canPayPrice || isRedoingRollAfterPrice || hasRolledThisTurn;
                    addSpecialMoveBtn.addEventListener('click', () => handlePlayerContributesSpecialMove(player.id));
                    actionIconsDiv.appendChild(addSpecialMoveBtn);
                    playerItemDiv.appendChild(actionIconsDiv);
                    playerListEl.appendChild(playerItemDiv);
                });
            }

            function updateStatusMessage() {
                let msg = "Ready to roll!";
                const numSMCovers = getNumSpecialMovesVisuallyCoveringSlots();
                const numPrimarySlotsNeeded = getNumPrimarySlotsForExpertiseOrEmpty();
                const currentDicePool = getDicePool();

                if (isRolling && !isRedoingRollAfterPrice) { // General rolling message if sequence is active
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
                } else if (currentDicePool === 0 && difficulty > 0 && numSMCovers < difficulty) {
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

                if (hasRolledThisTurn && !isRolling && !isRedoingRollAfterPrice) {
                    rollDiceBtn.textContent = "Reset & Prepare Next Roll";
                    rollDiceBtn.disabled = false;
                    rollDiceBtn.classList.add('reset-mode');
                } else if (isRedoingRollAfterPrice) {
                    rollDiceBtn.textContent = "Redo Failed Roll";
                    rollDiceBtn.disabled = isRolling; // Disable if redo animation is active
                    rollDiceBtn.classList.add('roll-mode');
                } else {
                    rollDiceBtn.textContent = isRolling ? "Rolling..." : "Roll Dice";
                    rollDiceBtn.disabled =
                        (difficulty > 0 && currentDicePool === 0 && numSMCovers < difficulty) ||
                        isRolling;
                    rollDiceBtn.classList.add('roll-mode');
                }
                pushLuckBtn.style.display = canPushLuck ? 'inline-block' : 'none';
                payPriceBtn.style.display = canPayPrice ? 'inline-block' : 'none';
            }


            function updateDifficultyDisplay() {
                difficultyDisplay.textContent = difficulty;
            }

            function determineSingleDieOpportunity(die) {
                 if (!canPushLuck && !canPayPrice) { // Only trigger if no *other* opportunity is active
                    if (die === 6) {
                        canPushLuck = true;
                    } else if (die === 1) {
                        canPayPrice = true;
                        // indexOfRollToRedo will be set by the calling context (processNextDieInSequence or redo logic)
                    }
                 }
            }

            function finalizeOverallOutcome(diceArray) {
                outcomeText = "";
                if (canPushLuck || canPayPrice || isRedoingRollAfterPrice || pushedLuckDieRoll !== null) {
                    // Let status message or button handlers provide more specific text during these states.
                    // However, if only pushedLuckDieRoll is set, and other flags are false, it means push luck resolved.
                     if(!canPushLuck && !canPayPrice && !isRedoingRollAfterPrice && pushedLuckDieRoll !== null) {
                        // Outcome text is already set by handlePushLuck.
                     } else {
                        return; // Don't set a generic outcome if an opportunity is pending.
                     }
                }

                 if (diceArray.length === 0 && getDicePool() === 0 && getNumSpecialMovesVisuallyCoveringSlots() >= difficulty && difficulty > 0) {
                     outcomeText = "Success! Difficulty covered by special moves, no roll needed.";
                     return;
                 }
                 // If diceArray is empty, but it's because we are mid-roll or pre-roll, don't set this.
                 // This check should only apply if hasRolledThisTurn is true and no dice were actually involved.
                 if (diceArray.length === 0 && getDicePool() === 0 && !(getNumSpecialMovesVisuallyCoveringSlots() >= difficulty && difficulty > 0)) {
                    if (hasRolledThisTurn) { // Only if a "roll" action was attempted
                       outcomeText = "No dice rolled. Outcome determined by situation or requires dice."; return;
                    } else {
                        return; // Not yet rolled, don't set an outcome
                    }
                 }
                 if (diceArray.length === 0) return; // Should be caught above or opportunity pending

                const highest = Math.max(...diceArray);
                if (highest === 6 && !diceArray.includes(1)) outcomeText = "Success! The goal is achieved, cleanly.";
                else if (highest === 6 && diceArray.includes(1)) outcomeText = "Critical Success with a major complication (6 and 1)!"; // Example for mixed
                else if (highest === 1) outcomeText = "Failure! Face consequences, loss, or harm.";
                else if (highest <= 3) outcomeText = "Failure with a silver lining (2-3)";
                else outcomeText = "Success with a complication (4-5)";
            }

            function fullUIUpdate() {
                updateDifficultyDisplay();
                renderDicePool();
                renderPlayerList();
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
                if (hasRolledThisTurn || isRolling || canPushLuck || canPayPrice || isRedoingRollAfterPrice) return;
                const playerIndex = players.findIndex(p => p.id === playerId);
                if (playerIndex === -1) return;
                if (players[playerIndex].contributedDice < 3) {
                    players[playerIndex].contributedDice += 1;
                    diceContributions.push(playerId); expertise += 1;
                    fullUIUpdate();
                } else { alert(`${players[playerIndex].name} has reached the maximum of 3 expertise contributions.`); }
            }

            function handlePlayerContributesSpecialMove(playerId) {
                 if (hasRolledThisTurn || isRolling || canPushLuck || canPayPrice || isRedoingRollAfterPrice) return;
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
                currentSequenceTotalDice = 0; // Reset this
                fullUIUpdate();
            }

            function handlePushLuck() {
                if (!canPushLuck) return;

                if (sequenceChainTimeoutId) clearTimeout(sequenceChainTimeoutId); // Safety clear
                sequenceChainTimeoutId = null;

                pushedLuckDieRoll = Math.floor(Math.random() * 6) + 1;
                canPushLuck = false;
                if (pushedLuckDieRoll <= 3) {
                    outcomeText = "Push Your Luck Failed! Original success potentially undone, complication added.";
                } else {
                    outcomeText = "Push Your Luck Succeeded! Advantage pressed further.";
                }
                if (rolls.indexOf(pushedLuckDieRoll) === -1) rolls.push(pushedLuckDieRoll); // Add to rolls if not already there

                isRolling = false;
                hasRolledThisTurn = true;
                fullUIUpdate();
            }

             function handlePayPrice() {
                if (!canPayPrice) return;
                const pricePaidDescription = prompt("Describe the price you pay (e.g., lose supplies, take stress, alert enemies):");
                if (pricePaidDescription === null) return;
                if (pricePaidDescription.trim() === "") {
                    alert("You must describe a price to pay.");
                    return;
                }

                if (sequenceChainTimeoutId) clearTimeout(sequenceChainTimeoutId);
                sequenceChainTimeoutId = null;

                canPayPrice = false;
                isRedoingRollAfterPrice = true;
                // indexOfRollToRedo should have been set when the '1' was rolled and sequence paused.
                if(indexOfRollToRedo === -1) { // Should ideally not happen if canPayPrice was true.
                     alert("Error: Could not identify which roll to redo. Resetting.");
                     clearAllContributionsAndStatsJS();
                     return;
                }
                outcomeText = `Price Paid: ${pricePaidDescription}. Redo the roll of 1.`;
                pushedLuckDieRoll = null; // Clear any pushed luck from before this price was paid.
                isRolling = false;
                // hasRolledThisTurn is already true because a '1' was rolled.
                fullUIUpdate();
            }

            function startRollingJS() {
                if (rollDiceBtn.classList.contains('reset-mode')) {
                    clearAllContributionsAndStatsJS();
                    return;
                }

                if (isRedoingRollAfterPrice) {
                    if (indexOfRollToRedo === -1) {
                        alert("Error: Cannot redo roll, index invalid.");
                        isRedoingRollAfterPrice = false; fullUIUpdate(); return;
                    }
                    isRolling = true; // For redo animation
                    outcomeText = ""; // Clear previous outcome while redoing
                    currentAnimatedValue = null;
                    currentRollIndex = indexOfRollToRedo; // Highlight the die being redone
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
                                currentAnimatedValue = null;
                                isRolling = false; // Redo animation finished
                                isRedoingRollAfterPrice = false; // Redo action is complete

                                determineSingleDieOpportunity(newDieRoll);

                                if (canPushLuck || canPayPrice) {
                                    // New opportunity from the redone die. Pause again.
                                    // indexOfRollToRedo remains the same if canPayPrice is true again for this slot.
                                    hasRolledThisTurn = true; // Still this turn.
                                    fullUIUpdate();
                                    // Sequence does NOT resume yet. User must act or Reset.
                                } else {
                                    // No new opportunity from redone die. Try to resume sequence.
                                    const dieSlotThatWasRedone = indexOfRollToRedo; // Keep track before clearing
                                    indexOfRollToRedo = -1; // Clear for future '1's elsewhere
                                    outcomeText = ""; // Clear "Price Paid..." message if resuming

                                    const nextDieInOriginalSequence = dieSlotThatWasRedone + 1;

                                    if (nextDieInOriginalSequence < currentSequenceTotalDice) {
                                        isRolling = true; // Resume the main sequence
                                        fullUIUpdate(); // Update UI for rolling state

                                        sequenceChainTimeoutId = setTimeout(() => {
                                            if(isRolling) { // Check state again (user might have reset quickly)
                                                processNextDieInSequence(nextDieInOriginalSequence, currentSequenceTotalDice);
                                            }
                                        }, SINGLE_DIE_POST_ANIMATION_PAUSE / 2); // Short delay for UX
                                    } else {
                                        // The redone die was the last one in the original pool.
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
                         finalizeOverallOutcome([]);
                         hasRolledThisTurn = true;
                    } else if (difficulty > 0 && numSMCovers < difficulty) {
                        outcomeText = "Cannot roll: Need more expertise or special moves for this difficulty.";
                        hasRolledThisTurn = false;
                    } else {
                        outcomeText = "Difficulty is 0, automatic success assumed. No roll needed.";
                         finalizeOverallOutcome([]);
                         hasRolledThisTurn = true;
                    }
                    isRolling = false; fullUIUpdate(); return;
                }

                rolls = []; // Reset rolls for the new expertise pool
                for(let i=0; i < currentDicePool; ++i) rolls.push(undefined); // Pre-fill with undefined

                outcomeText = "";
                canPushLuck = false; canPayPrice = false; pushedLuckDieRoll = null;
                if (sequenceChainTimeoutId) clearTimeout(sequenceChainTimeoutId);
                sequenceChainTimeoutId = null;

                isRolling = true; hasRolledThisTurn = false; // Will be true when sequence pauses/ends
                currentRollIndex = 0;
                currentAnimatedValue = null;
                currentSequenceTotalDice = currentDicePool; // Store total for this sequence

                fullUIUpdate();
                processNextDieInSequence(0, currentSequenceTotalDice);
            }

            function processNextDieInSequence(rollIdx, totalDiceInPool) {
                // Guard: Stop if sequence was explicitly stopped (isRolling=false)
                // or if an opportunity arose from a *previous* die and is pending (canPushLuck/canPayPrice=true)
                // This check ensures that if handlePayPrice sets isRolling=false, this won't run.
                if (!isRolling) {
                    // If an opportunity is pending, UI would reflect that.
                    // If simply stopped by reset, that's handled.
                    return;
                }
                 // If an opportunity (1 or 6) from a *previous die* already paused the sequence,
                 // isRolling would be false, or canPush/Pay would be true.
                 // This secondary check is more for canPush/Pay from previous die.
                if (canPushLuck || canPayPrice) {
                    // isRolling should have been set to false when these flags were set.
                    // This is a defensive stop.
                    fullUIUpdate(); // Ensure UI reflects the pending choice
                    return;
                }


                currentRollIndex = rollIdx;
                currentAnimatedValue = null;
                renderDicePool(); // Show this die as 'waiting' or start animation

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
                            renderDicePool();

                            determineSingleDieOpportunity(currentDieRoll);

                            if (canPushLuck || canPayPrice) {
                                isRolling = false; // PAUSE the sequence
                                hasRolledThisTurn = true; // A decision point is reached.
                                if (canPayPrice) {
                                    indexOfRollToRedo = rollIdx; // Record which die caused the 'Pay Price' pause
                                }
                                fullUIUpdate();
                                return; // Exit, wait for user action (Push, Pay, or Reset)
                            }

                            // If we reach here, current die did NOT trigger an immediate Push/Pay.
                            const isLastDieInSequence = (rollIdx + 1) >= totalDiceInPool;

                            if (isLastDieInSequence) {
                                isRolling = false;
                                currentRollIndex = null;
                                finalizeOverallOutcome(rolls);
                                hasRolledThisTurn = true;
                                fullUIUpdate();
                            } else {
                                // Not the last die, and no interruption: schedule the NEXT die
                                const delayForNextDie = BASE_DELAY_AFTER_DIE_FINISHES + (rollIdx * DELAY_INCREMENT_PER_DIE);
                                sequenceChainTimeoutId = setTimeout(() => {
                                    // Check isRolling again, as user might have Reset during the brief delay
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
            decreaseDifficultyBtn.addEventListener('click', () => { if (!isRolling && !hasRolledThisTurn && !canPushLuck && !canPayPrice) { difficulty = Math.max(0, difficulty - 1); fullUIUpdate(); }});
            increaseDifficultyBtn.addEventListener('click', () => { if (!isRolling && !hasRolledThisTurn && !canPushLuck && !canPayPrice) { difficulty += 1; fullUIUpdate(); }});
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

            fullUIUpdate();
        });
    </script>
