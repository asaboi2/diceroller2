// dice-roller.js

// Entire JS logic including tension timers
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
  let uploadedImage = null;
  let diceContributions = [];
  let specialMoveContributions = [];
  let sequenceChainTimeoutId = null;
  let canPushLuck = false;
  let canPayPrice = false;
  let pushedLuckDieRoll = null;
  let isRedoingRollAfterPrice = false;
  let indexOfRollToRedo = -1;
  let nextPlayerHue = 0;

  // Tension timers
  let strategyTime = 90;
  let strategyInterval = null;
  let actionLimit = 3;

  // --- CONSTANTS ---
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
  const pushLuckBtn = document.getElementById('pushLuckBtn');
  const payPriceBtn = document.getElementById('payPriceBtn');
  const addPlayerModalEl = document.getElementById('addPlayerModal');
  const playerNameInput = document.getElementById('playerNameInput');
  const playerImageInput = document.getElementById('playerImageInput');
  const imagePreviewContainer = document.getElementById('imagePreviewContainer');
  const imagePreviewEl = document.getElementById('imagePreview');
  const cancelAddPlayerBtn = document.getElementById('cancelAddPlayerBtn');
  const confirmAddPlayerBtn = document.getElementById('confirmAddPlayerBtn');

  // Tension timers DOM
  const stratDisp = document.getElementById('strategyDisplay');
  const actDisp = document.getElementById('actionDisplay');
  const setActInput = document.getElementById('setActionInput');
  const pauseBtn = document.getElementById('pauseStrategyBtn');
  const resetStrBtn = document.getElementById('resetStrategyBtn');
  const resetActBtn = document.getElementById('resetActionBtn');

  const DICE_ICON = '🎲';
  const STAR_ICON = '✨';

  // --- HELPERS ---
  function generatePlayerColor() {
    const hue = nextPlayerHue;
    nextPlayerHue = (nextPlayerHue + HUE_INCREMENT) % 360;
    return `hsl(${hue}, ${SATURATION}%, ${LIGHTNESS}%)`;
  }

  const getNumSpecialMovesVisuallyCoveringSlots = () =>
    Math.min(specialMoves, Math.max(0, difficulty));
  const getNumPrimarySlotsForExpertiseOrEmpty = () => {
    const covered = getNumSpecialMovesVisuallyCoveringSlots();
    return Math.max(0, difficulty - covered);
  };
  const getDicePool = () => expertise;

  // --- TENSION TIMERS ---
  function startStrategyTimer() {
    clearInterval(strategyInterval);
    strategyTime = 90;
    stratDisp.textContent = strategyTime;
    strategyInterval = setInterval(() => {
      stratDisp.textContent = --strategyTime;
      if (strategyTime <= 0) {
        clearInterval(strategyInterval);
        statusMessageEl.textContent = 'Timer expired: auto-fail.';
        clearAllContributionsAndStatsJS();
      }
    }, 1000);
  }
  function stopStrategyTimer() {
    clearInterval(strategyInterval);
  }

  // --- RENDER FUNCTIONS ---
  function renderDicePool() {
    dicePoolDisplayEl.innerHTML = '';
    let expertiseCount = 0;
    const numSM = getNumSpecialMovesVisuallyCoveringSlots();
    for (let i = 0; i < Math.max(0, difficulty); i++) {
      const slot = document.createElement('div');
      slot.classList.add('dice-slot');
      const covered = i >= difficulty - numSM;
      if (covered) {
        slot.classList.add('special-move-covered');
        const idx = numSM - 1 - (i - (difficulty - numSM));
        const pid = specialMoveContributions[idx];
        const p = pid ? players.find(x => x.id === pid) : null;
        if (p && p.image) {
          const img = document.createElement('img');
          img.classList.add('player-cover-image');
          img.src = p.image;
          img.title = `${p.name} covers this`;
          slot.appendChild(img);
        } else if (p) {
          const d = document.createElement('div');
          d.classList.add('player-initial-avatar');
          d.style.backgroundColor = p.color;
          d.textContent = p.name.charAt(0).toUpperCase();
          slot.appendChild(d);
        } else {
          const divGeneric = document.createElement('div');
          divGeneric.classList.add('player-cover-image','generic-cover');
          divGeneric.innerHTML = STAR_ICON;
          slot.appendChild(divGeneric);
        }
      } else {
        if (expertiseCount < expertise) {
          slot.classList.add('filled');
          const dieDiv = document.createElement('div');
          dieDiv.classList.add('die-face');
          let val = DICE_ICON;
          dieDiv.classList.add('placeholder');
          if ((isRolling||isRedoingRollAfterPrice) && currentRollIndex===expertiseCount && currentAnimatedValue!=null) {
            val = currentAnimatedValue;
            dieDiv.classList.remove('placeholder');
            if (val===6) dieDiv.classList.add('success','animating');
            else if(val===1) dieDiv.classList.add('failure','animating');
            else if(val>=4) dieDiv.classList.add('partial-success','animating');
            else dieDiv.classList.add('partial-failure','animating');
          } else if (rolls[expertiseCount]!=null) {
            val = rolls[expertiseCount];
            dieDiv.classList.remove('placeholder');
            if (val===6) dieDiv.classList.add('success');
            else if(val===1) dieDiv.classList.add('failure');
            else if(val>=4) dieDiv.classList.add('partial-success');
            else dieDiv.classList.add('partial-failure');
          } else if(isRolling||isRedoingRollAfterPrice) dieDiv.classList.add('waiting');
          else dieDiv.classList.add('filled-placeholder');
          dieDiv.innerHTML = val;
          slot.appendChild(dieDiv);
          // indicator
          const pid = diceContributions[expertiseCount];
          const p = pid?players.find(x=>x.id===pid):null;
          if(p){
            const ind = document.createElement('div');
            ind.classList.add('player-indicator');
            ind.title = `Expertise from ${p.name}`;
            if(p.image){
              const imgI=document.createElement('img');imgI.src=p.image;ind.appendChild(imgI);
            } else {
              ind.classList.add('generic');ind.textContent=p.name.charAt(0).toUpperCase();ind.style.backgroundColor=p.color;
            }
            slot.appendChild(ind);
          }
          expertiseCount++;
        } else slot.classList.add('empty');
      }
      dicePoolDisplayEl.appendChild(slot);
    }
    // extra dice
    for(let k=expertiseCount;k<expertise;k++){
      const slot=document.createElement('div');
      slot.classList.add('dice-slot','extra');
      const dieDiv=document.createElement('div');
      dieDiv.classList.add('die-face','placeholder');
      dieDiv.innerHTML=DICE_ICON;
      slot.appendChild(dieDiv);
      dicePoolDisplayEl.appendChild(slot);
    }
    // pushed luck
    if(pushedLuckDieRoll!=null && !isRolling && !isRedoingRollAfterPrice){
      const slot=document.createElement('div');slot.classList.add('dice-slot','filled');
      slot.style.borderColor='var(--warning)';
      const df=document.createElement('div');df.classList.add('die-face','pushed-luck-die');
      if(pushedLuckDieRoll<=3)df.classList.add('failure');else df.classList.add('success');
      df.textContent=pushedLuckDieRoll;slot.appendChild(df);
      dicePoolDisplayEl.appendChild(slot);
    }
  }

  function renderPlayerList() {
    playerListEl.innerHTML='';
    noPlayersTextEl.style.display=players.length?'none':'block';
    players.forEach(p=>{
      const item=document.createElement('div');item.classList.add('player-item');
      const info=document.createElement('div');info.classList.add('player-info');
      const avatar=document.createElement('div');avatar.classList.add('player-avatar-container');
      if(p.image){const img=document.createElement('img');img.src=p.image;avatar.appendChild(img);} else {
        const init=document.createElement('div');init.classList.add('player-initial-avatar');init.textContent=p.name.charAt(0).toUpperCase();init.style.backgroundColor=p.color;avatar.appendChild(init);
      }
      info.appendChild(avatar);
      const nameLbl=document.createElement('span');nameLbl.classList.add('player-name-label');nameLbl.textContent=p.name;info.appendChild(nameLbl);
      item.appendChild(info);
      const actions=document.createElement('div');actions.classList.add('player-action-icons');
      const btnD=document.createElement('button');btnD.classList.add('player-action-btn');btnD.innerHTML=DICE_ICON;
      btnD.disabled=p.contributedDice>=3||isRolling||canPushLuck||canPayPrice||isRedoingRollAfterPrice||hasRolledThisTurn;
      btnD.addEventListener('click',()=>handlePlayerContributesExpertise(p.id));actions.appendChild(btnD);
      const btnS=document.createElement('button');btnS.classList.add('player-action-btn');btnS.innerHTML=STAR_ICON;
      btnS.disabled=(difficulty>0&&getNumSpecialMovesVisuallyCoveringSlots()>=difficulty)||isRolling||canPushLuck||canPayPrice||isRedoingRollAfterPrice||hasRolledThisTurn;
      btnS.addEventListener('click',()=>handlePlayerContributesSpecialMove(p.id));actions.appendChild(btnS);
      item.appendChild(actions);
      playerListEl.appendChild(item);
    });
  }

  function updateDifficultyDisplay(){difficultyDisplay.textContent=difficulty;}

  function updateActionButtons(){
    rollDiceBtn.classList.remove('roll-mode','reset-mode');
    if(hasRolledThisTurn&&!isRolling&&!isRedoingRollAfterPrice){
      rollDiceBtn.textContent='Reset & Prepare Next Roll';
      rollDiceBtn.disabled=false;
      rollDiceBtn.classList.add('reset-mode');
    } else if(isRedoingRollAfterPrice){
      rollDiceBtn.textContent='Redo Failed Roll';
      rollDiceBtn.disabled=isRolling;
      rollDiceBtn.classList.add('roll-mode');
    } else {
      rollDiceBtn.textContent=isRolling?'Rolling...':'Roll Dice';
      rollDiceBtn.disabled=(difficulty>0&&getDicePool()===0&&getNumSpecialMovesVisuallyCoveringSlots()<difficulty)||isRolling;
      rollDiceBtn.classList.add('roll-mode');
    }
    pushLuckBtn.style.display=canPushLuck?'inline-block':'none';
    payPriceBtn.style.display=canPayPrice?'inline-block':'none';
  }

  function updateStatusMessage(){
    let msg='Ready to roll!';
    if(isRedoingRollAfterPrice){
      msg=`Redo the roll of 1! (${outcomeText.split('Price Paid: ')[1]||''})`;
    } else if(canPushLuck) msg='A 6! Push your luck? Or Reset.';
    else if(canPayPrice) msg='A 1! Pay a price to redo? Or Reset.';
    else if(outcomeText){
      msg=outcomeText;
      if(rolls.length&&!isRolling&&!isRedoingRollAfterPrice) msg+=` (XP: ${rolls.length*10})`;
    } else if(getDicePool()===0&&difficulty>0&&getNumSpecialMovesVisuallyCoveringSlots()<difficulty)
      msg=`Add expertise dice to attempt Difficulty ${difficulty}.`;
    else if(expertise<getNumPrimarySlotsForExpertiseOrEmpty()){
      const need=getNumPrimarySlotsForExpertiseOrEmpty()-expertise;
      msg=`Need ${need} more expertise ${need===1?'die':'dice'} to cover Difficulty ${difficulty}.`;
    }
    statusMessageEl.textContent=msg;
  }

  function determineSingleDieOpportunity(die){
    if(!canPushLuck&&!canPayPrice&&!isRedoingRollAfterPrice){
      if(die===6) canPushLuck=true;
      else if(die===1) canPayPrice=true;
    }
  }

  function finalizeOverallOutcome(d){
    outcomeText='';
    if(canPushLuck||canPayPrice||isRedoingRollAfterPrice||pushedLuckDieRoll!=null) return;
    if(d.length===0 && getDicePool()===0 && getNumSpecialMovesVisuallyCoveringSlots()>=difficulty&&difficulty>0){
      outcomeText='Success! Difficulty covered by special moves.';return;
    }
    if(d.length===0) {outcomeText='No dice rolled.';return;}
    const h=Math.max(...d);
    if(h===6) outcomeText='Success! The goal is achieved, cleanly.';
    else if(h===1) outcomeText='Failure! Face consequences.';
    else if(h<=3) outcomeText='Failure with a silver lining (2-3)';
    else outcomeText='Success with a complication (4-5)';
  }

  function clearAllContributionsAndStatsJS(){
    players.forEach(p=>{p.contributedDice=0;p.contributedSpecialMoves=0});
    diceContributions=[];specialMoveContributions=[];
    expertise=0;specialMoves=0;rolls=[];outcomeText='';
    isRolling=false;hasRolledThisTurn=false;currentRollIndex=null;currentAnimatedValue=null;
    clearTimeout(sequenceChainTimeoutId);sequenceChainTimeoutId=null;
    canPushLuck=false;canPayPrice=false;pushedLuckDieRoll=null;isRedoingRollAfterPrice=false;indexOfRollToRedo=-1;
    fullUIUpdate();
  }

  function handleImageUploadJS(e){
    const file=e.target.files[0];
    if(file){
      const r=new FileReader();
      r.onload=ev=>{uploadedImage=ev.target.result;imagePreviewEl.src=uploadedImage;imagePreviewContainer.style.display='block'};
      r.readAsDataURL(file);
    } else {
      uploadedImage=null;imagePreviewContainer.style.display='none';
    }
  }

  function addPlayerJS(){
    const name=playerNameInput.value.trim();
    if(!name) return alert('Player name is required.');
    players.push({
      id:Date.now(),name,image:uploadedImage,contributedDice:0,contributedSpecialMoves:0,color:generatePlayerColor()
    });
    playerNameInput.value='';playerImageInput.value='';uploadedImage=null;imagePreviewContainer.style.display='none';
    addPlayerModalEl.style.display='none';fullUIUpdate();
  }

  function handlePlayerContributesExpertise(pid){
    if(hasRolledThisTurn||isRolling||canPushLuck||canPayPrice||isRedoingRollAfterPrice) return;
    const p=players.find(x=>x.id===pid);if(!p||p.contributedDice>=3) return;
    p.contributedDice++;diceContributions.push(pid);expertise++;fullUIUpdate();
  }

  function handlePlayerContributesSpecialMove(pid){
    if(hasRolledThisTurn||isRolling||canPushLuck||canPayPrice||isRedoingRollAfterPrice) return;
    if(getNumSpecialMovesVisuallyCoveringSlots()>=difficulty) return;
    const p=players.find(x=>x.id===pid);if(!p) return;
    p.contributedSpecialMoves++;specialMoveContributions.push(pid);specialMoves++;fullUIUpdate();
  }

  function handlePushLuck(){
    if(!canPushLuck) return;
    pushedLuckDieRoll=Math.floor(Math.random()*6)+1;canPushLuck=false;
    outcomeText=pushedLuckDieRoll<=3?'Push Your Luck Failed!':'Push Your Luck Succeeded!';
    if(rolls.indexOf(pushedLuckDieRoll)===-1) rolls.push(pushedLuckDieRoll);
    isRolling=false;hasRolledThisTurn=true;fullUIUpdate();
  }

  function handlePayPrice(){
    if(!canPayPrice) return;
    const desc=prompt('Describe the price you pay:');
    if(desc==null) return;
    if(!desc.trim()) return alert('You must describe a price.');
    clearTimeout(sequenceChainTimeoutId);canPayPrice=false;isRedoingRollAfterPrice=true;
    indexOfRollToRedo=rolls.lastIndexOf(1);if(indexOfRollToRedo<0) return clearAllContributionsAndStatsJS();
    outcomeText=`Price Paid: ${desc}. Redo roll.`;
    isRolling=false;fullUIUpdate();
  }

  function processNextDieInSequence(idx,total){
    if(!isRolling||canPushLuck||canPayPrice){
      isRolling=false;finalizeOverallOutcome(rolls);hasRolledThisTurn=true;fullUIUpdate();return;
    }
    currentRollIndex=idx;currentAnimatedValue=null;renderDicePool();
    let cnt=0;
    const animId=setInterval(()=>{
      currentAnimatedValue=Math.floor(Math.random()*6)+1;renderDicePool();
      if(++cnt>=SINGLE_DIE_ANIMATION_FRAMES){
        clearInterval(animId);
        const val=Math.floor(Math.random()*6)+1;
        rolls[idx]=val;currentAnimatedValue=val;renderDicePool();
        setTimeout(()=>{
          currentAnimatedValue=null;renderDicePool();
          determineSingleDieOpportunity(val);
          const last=idx+1>=total||canPushLuck||canPayPrice;
          if(last){isRolling=false;finalizeOverallOutcome(rolls);hasRolledThisTurn=true;fullUIUpdate();}
          else sequenceChainTimeoutId=setTimeout(()=>processNextDieInSequence(idx+1,total),BASE_DELAY_AFTER_DIE_FINISHES+idx*DELAY_INCREMENT_PER_DIE);
        },SINGLE_DIE_POST_ANIMATION_PAUSE);
      }
    },SINGLE_DIE_ANIMATION_INTERVAL);
  }

  function startRollingJS(){
    if(rollDiceBtn.classList.contains('reset-mode')){clearAllContributionsAndStatsJS();return;}
    if(isRedoingRollAfterPrice){
      if(indexOfRollToRedo<0) return isRedoingRollAfterPrice=false,fullUIUpdate();
      isRolling=true;outcomeText='';currentAnimatedValue=null;currentRollIndex=indexOfRollToRedo;renderDicePool();
      let cnt=0;
      const animId=setInterval(()=>{
        currentAnimatedValue=Math.floor(Math.random()*6)+1;renderDicePool();
        if(++cnt>=SINGLE_DIE_ANIMATION_FRAMES){
          clearInterval(animId);
          const newVal=Math.floor(Math.random()*6)+1;rolls[indexOfRollToRedo]=newVal;currentAnimatedValue=newVal;renderDicePool();
          setTimeout(()=>{
            currentAnimatedValue=null;isRolling=false;isRedoingRollAfterPrice=false;
            determineSingleDieOpportunity(newVal);
            if(!canPushLuck&& !canPayPrice) finalizeOverallOutcome(rolls);
            hasRolledThisTurn=true;indexOfRollToRedo=-1;fullUIUpdate();
          },SINGLE_DIE_POST_ANIMATION_PAUSE);
        }
      },SINGLE_DIE_ANIMATION_INTERVAL);
      return;
    }
    const pool=getDicePool(), numSM=getNumSpecialMovesVisuallyCoveringSlots();
    if(pool===0){
      if(difficulty>0&&numSM>=difficulty) outcomeText='Success! Covered by special moves.';
      else if(difficulty>0&&numSM<difficulty) outcomeText='Cannot roll: need more dice.';
      else outcomeText='Difficulty 0: auto success.';
      finalizeOverallOutcome([]);hasRolledThisTurn=true;isRolling=false;fullUIUpdate();return;
    }
    rolls=[];for(let i=0;i<pool;i++)rolls.push(undefined);
    outcomeText='';canPushLuck=false;canPayPrice=false;pushedLuckDieRoll=null;
    clearTimeout(sequenceChainTimeoutId);isRolling=true;hasRolledThisTurn=false;currentRollIndex=0;currentAnimatedValue=null;
    fullUIUpdate();processNextDieInSequence(0,pool);
  }

  // --- EVENT LISTENERS ---
  decreaseDifficultyBtn.addEventListener('click',()=>{
    if(!isRolling&&!hasRolledThisTurn){difficulty=Math.max(0,difficulty-1);startStrategyTimer();fullUIUpdate();}
  });
  increaseDifficultyBtn.addEventListener('click',()=>{
    if(!isRolling&&!hasRolledThisTurn){difficulty++;startStrategyTimer();fullUIUpdate();}
  });
  rollDiceBtn.addEventListener('click',()=>{stopStrategyTimer();actionLimit=Math.max(0,actionLimit-1);actDisp.textContent=actionLimit;startRollingJS();});
  openAddPlayerModalBtn.addEventListener('click',()=>addPlayerModalEl.style.display='flex');
  cancelAddPlayerBtn.addEventListener('click',()=>addPlayerModalEl.style.display='none');
  confirmAddPlayerBtn.addEventListener('click',addPlayerJS);
  playerImageInput.addEventListener('change',handleImageUploadJS);
  pushLuckBtn.addEventListener('click',handlePushLuck);
  payPriceBtn.addEventListener('click',handlePayPrice);

  setActInput.addEventListener('change',e=>{actionLimit=Math.max(1,parseInt(e.target.value,10)||1);actDisp.textContent=actionLimit;});
  resetActBtn.addEventListener('click',()=>actDisp.textContent=actionLimit);
  pauseBtn.addEventListener('click',stopStrategyTimer);
  resetStrBtn.addEventListener('click',startStrategyTimer);

  // --- INIT ---
  stratDisp.textContent=strategyTime;
  actDisp.textContent=actionLimit;
  fullUIUpdate();
});
</script>
