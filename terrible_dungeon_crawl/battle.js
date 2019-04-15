/*
Characters can engage targets, automatically damaging the greatest threat each round.
Engaging too many foes causes the character to become overwhelmed, taking penalites until some foes have disengaged.

Actions:
Engage target (up to limit)  --- Working!
Ability use
Guard ally(redirects threat from attacker(s))
Disengage/withdraw
Shift stance(STRETCH)

// todo:

removing creatures is a bit more complex, as they exist in:
every foe's engagement arrays
~initative order (s)
~list of foes --- Done!

*/

$(()=>{ //Start jQuery

  //The basis for most in-game creatures
  //Only uses vigor for health - no wounds
  class Creature {
    constructor(nameIn = "RUNELORD", weaponDescriptor = "a glaive", perceptionIn = 1) {
      this.name = nameIn;
      this.weapon = weaponDescriptor;
      //Array of enemies this creature is threatening
      this.threatenedFoes = [];
      //Limit to the amount of threat the creature can hold off before suffering greater penalites
      this.threatThreshold = 3;
      //How much threat the creature is currently holding off
      this.totalThreat = 0;
      this.overwhelmedState = 0; //0 -> no, 1 -> at limit, 2 -> Yes

      //'outer' health bar. Easily recovered, lost before others.
      this.vigor = 35;
      this.maxWounds = 35; //used to keep track of max vigor

      //Default damage per attack. Reduced by threat.
      this.damage = 14;
      //Default damage reduction. Reduced by threat past threatThreshold.
      this.armor = 2;

      //Used in determineing turn order.
      this.perception = perceptionIn;
      this.initiative = 3;
      this.rolledInit;

      this.currentBattlefield; //Allows references to battlefield
      this.battlefieldId; //Used to refer to html element ids

      //Is this alive? Updated upon death.
      this.aliveBool = true;
    };


    //Do some damage to something the creature (generally) threatens.
    //Getting an undefined error? Make some notArray -> array code
    attack(targetList = this.threatenedFoes) {
      if(targetList.length === 0) {
        addToCombatLog(`${this.name} was not threatening any foes, and made no attack.`);
        return;
      }
      let totalDamage = this.calculateDamage();
      //Get a list of targets with the greatest threat
      let possibleTargetArray = [];
      let highestPriority = 0;
      for(let i = 0; i < this.threatenedFoes.length; i++) {
        if(this.threatenedFoes[i][1] > highestPriority) {
          highestPriority = this.threatenedFoes[i][1]; //Sets new priority level
          possibleTargetArray.length = 0; //Avoids memory leaks?
          possibleTargetArray = [i];
        } else if (this.threatenedFoes[i][1] === highestPriority) {
          highestPriority = this.threatenedFoes[i][1];
          possibleTargetArray.push(i);
        }
      }
      //Choose a target from the list of highest priority foes
      let selectedTargetIndex = possibleTargetArray[Math.floor(Math.random()*possibleTargetArray.length)];

      let target = targetList[selectedTargetIndex][0];
      addToCombatLog(`${this.name} attacked ${target.name}!`)
      target.takeDamage(totalDamage);
    };


    //Calculates the creature's current damage based on how much threat it is encountering.
    calculateDamage() {
      return(Math.max(this.damage - this.totalThreat,1));
    }


    //Applies damage to this creature. If the damage brings it below 0 vigor, it dies.
    takeDamage(incomingDamage) {
      //Armor mitigates damage on a 1-to-1 basis.
      let effectiveArmor = this.calculateDR();
      //An attack always deals 1 damage.
      let damageTaken = Math.max(incomingDamage-effectiveArmor,1);
      this.vigor -= damageTaken;
      this.currentBattlefield.updateHealthValues();
      addToCombatLog(`${this.name} took ${damageTaken} damage!`)
      if( this.vigor <= 0) { //If dead - changes statBlock colors and clears all threat the creature was connected to.
        addToCombatLog(`${this.name} was slain!`);
        $(`#${this.battlefieldId}Block`).css("backgroundColor", "#4f2b2b");
        $(`#${this.battlefieldId}Block`).css("border-color","#5e5542");
        this.aliveBool = false;
        this.clearAllThreat();
        this.currentBattlefield.drawThreatLines();
      }
      return(damageTaken);
    };


    //Calculates the effective armor of the creature. This is allows to go negative!
    calculateDR() {
      let effectiveArmor = this.armor;
      if(this.overwhelmedState === 2) {
        effectiveArmor -= (this.totalThreat - this.threatThreshold);
      }
      return(effectiveArmor);
    };


    //Adds the target to this creature's list of threatened foes, or increases it's threat level for that creature if it is already there
    engageTarget(targetCreature, reciprocateBoolean = 0) {

      let enemyExists = false;
      if(!targetCreature.aliveBool) { //If the target is dead, no threat is generated.
        addToCombatLog(`${targetCreature.name} is slain - ${this.name} did not bother  threatening it.`);
        return;
      }
      //If this creature is trying to generate more threat, it won't be able to if it is at or above its threatThreshold
      if(this.overwhelmedState >= 1 && reciprocateBoolean === 1) {
        addToCombatLog(`${this.name} can't threaten another foe - they are busy with their current targets!`);
      } else {
        //Search list of engaged targets for the foe. If it exists, increase the threat level, otherwise, add the creatue to the list and generate 1 threat.
        for(let i =0; i < this.threatenedFoes.length; i++) {
          if(this.threatenedFoes[i].indexOf(targetCreature) === 0) {
            this.threatenedFoes[i][1]++; //Amplify threat
            if(reciprocateBoolean === 1) {
              addToCombatLog(`${this.name} pressed the attack against ${targetCreature.name}`);
            }
            enemyExists = true;
          }
        }
        if(!enemyExists) { //Create new threat
          this.threatenedFoes.push([targetCreature,1]);
          if(reciprocateBoolean === 1) {
            addToCombatLog(`${this.name} moved to threaten ${targetCreature.name}`);
          }
        }

        this.updateTotalThreat();

        //Lets the player know something is overwhelemed
        if (this.totalThreat > this.threatThreshold){
          addToCombatLog(`${this.name} is fighting too many foes - they're being overwhelmed!`);
        }

        //this is REALLY important - stops an infinte loop of recursion
        if(reciprocateBoolean) {
          targetCreature.engageTarget(this);
        }
        this.currentBattlefield.drawThreatLines();
      }
    };


    //Totals the amount of threat the creature is encountering and updates the overwhelemedState based on the result. Call after changing threat!
    updateTotalThreat() {
      let totalProblems = 0;
      for(let i = 0; i<this.threatenedFoes.length; i++) {
        totalProblems += this.threatenedFoes[i][1];
      }
      this.totalThreat = totalProblems;
      if(this.totalThreat >= this.threatThreshold) {
        this.overwhelmedState = 1;
        if (this.totalThreat > this.threatThreshold) {
          this.overwhelmedState = 2;
        }
      } else {
        this.overwhelmedState = 0;
      }
      //Now update everything's Atk/Arm/Threat values
      this.currentBattlefield.updateAttackArmorThreatValues();
    };


    //Loops through this creature's threat array and removes itself from other creatures' threat lists. Then deletes this creature's threat list. Used in case of withdraw or death.
    clearAllThreat() {
      while(this.threatenedFoes.length > 0) {
        this.clearSingleThreat(this.threatenedFoes[0][0]);
      }
      this.updateTotalThreat();
      this.currentBattlefield.drawThreatLines();
    };


    //Removes this creature from a single foe's threat list, and this from the foe's list.
    clearSingleThreat(targetCreature, startIndex) {
      //remove this from foe's list
      let targetCreatureThreatList = targetCreature.threatenedFoes;
      for (let j = 0; j < targetCreatureThreatList.length; j++) {
        if(targetCreatureThreatList[j][0] === this) {
          targetCreatureThreatList.splice(j,1);
          targetCreature.updateTotalThreat();
        }
      }
      //remove foe from this one's list
      for (let j = 0; j < this.threatenedFoes.length; j++) {
        if(this.threatenedFoes[j][0] === targetCreature) {
          this.threatenedFoes.splice(j,1);
        }
      }

      this.updateTotalThreat();
      this.currentBattlefield.drawThreatLines();
    };

    //More of a bugfixing method, but maybe it can be used later?
    logHealth() {
      console.log(`${this.vigor}/${this.maxWounds}`);
    };


    //Combat Action list - calls other methods in correct combinations for combat to flow correctly. Called by the combatButtons!

    //Threaten the target, then attack something.
    actionThreatenAttack(threatenTarget, threatenReciprocateBool) {
      if(this.aliveBool) {
        this.engageTarget(threatenTarget,threatenReciprocateBool);
        this.attack();
      } else {
        addToCombatLog(`${this.name} was slain before it could act.`)
      }
      this.currentBattlefield.combatPhaseController();
    };

    //Remove all threat from one target, then attack something
    actionDisengageAttack(targetCreature) {
      if(this.aliveBool) {
        addToCombatLog(`${this.name} moved away from ${targetCreature.name}.`)
        this.clearSingleThreat(targetCreature);
        this.attack();
      } else {
        addToCombatLog(`${this.name} was slain before it could act.`)
      }
      this.currentBattlefield.combatPhaseController();
    }


  } //End of Creature class

  //The adventurers! These are the player characters (PCs). Creatures with added button functionality, wounds, and other abilties/complexity
  class Adventurer extends Creature {
    constructor(nameIn = "Garzmok", weaponIn = "a sword", woundsIn = 40, damageIn = 12, armorIn = 2, threatThIn = 2, perceptionIn = 5) {
      super();
      this.name = nameIn;
      this.weapon = weaponIn;
      //A secondary health bar; adventurers do not perish until their wounds hit zero (note- the players see the opposite: as wounds as taken, this value decreases! Makes more sense from their perspective.)
      this.maxWounds = woundsIn;
      this.wounds = this.maxWounds;

      //these are the same as in the creature class
      this.vigor = this.maxWounds;
      this.damage = damageIn;
      this.armor = armorIn;
      this.threatThreshold = threatThIn;
      this.aliveBool = true;
      this.perception = perceptionIn;
    };

    //Damage is applied to vigor before wounds, but if enough vigor is lost in a single hit, some vigor damage is converted into wound 'chip damage'.
    //This also generates a message to let the player how much damage of each type was applied.
    takeDamage(incomingDamage) {
      let damageTaken = Math.max(incomingDamage-this.calculateDR(),1); //Always take 1 damage
      //This is the wound chip damage
      let woundChipDamage = Math.floor(damageTaken/5);
      damageTaken -= woundChipDamage; //Vigor damage is CONVERTED to wound chip damage
      let vigorDamageTaken = Math.min(damageTaken, this.vigor); //no negative vigor allowed
      //Make sure all the damage is properly accounted for.
      let woundDamage = (damageTaken-vigorDamageTaken) + woundChipDamage;
      this.vigor -= vigorDamageTaken;
      this.wounds -= woundDamage;
      let damageMessage = `${this.name} lost ${vigorDamageTaken} vigor`;
      if(woundDamage > 1) {
        damageMessage += ` and took ${woundDamage} wounds!`;
      } else if (woundDamage === 1) {
        damageMessage += ` and took ${woundDamage} wound!`;
      } else {
        damageMessage += "!";
      }
      addToCombatLog(damageMessage);
      this.currentBattlefield.updateHealthValues();
      //If dead, clear threat and let the player know
      if( this.wounds <= 0) {
        addToCombatLog(`${this.name} has perished.`);
        $(`#${this.battlefieldId}Block`).css("backgroundColor", "#4f2b2b");
        this.aliveBool = false;
        this.clearAllThreat();
      }
    };

    logHealth() {
      console.log(`${this.vigor}/${this.wounds}/${this.maxWounds}`);
    };


    // Methods for interacting with Battlefield and PlayerGroup classes

    //call this once on character generation to generate arrays for making buttons in combat. Organize this stuff WELL
    //May not need this, depending how things get implemented in displayTurnOptions()
    createTurnOptionQuery(targetSelectorIndex, actionSelectorindex) { //Rename this
      let viableTargetTypes = ["actionMenu","foes","adventurers","all","self","foesAoE","adventurersAoE","allAoE"];
      let viabaleActionTypes = ["threatenAttack","disengageAttack"];
      let targetType = viableTargetTypes[targetSelectorIndex];
      let actionType = viabaleActionTypes[actionSelectorindex];

      this.displayTurnOptions(targetType, actionType);
    };


    //Displays the buttons to allow the player to input a turn. This may get REALLY bloated (surprise, it did!).
    displayTurnOptions(targetType, actionType) {
      if(!this.aliveBool) { //If dead, simply pass the turn without making buttons.
        this.currentBattlefield.planningPhaseController();
        return;
      }
      $("#commandList").empty();
      let buttonOwner = this;
      let pcID = this.battlefieldId.slice(-1); //Just get the number


      //Look at targetType ->
      //  create list of possible targets (how to add allies+foes?)
      //  for loop over each applicable array, adding on the characters via slice
      //Iterate through those targets, generating a button for each

      //create a 'back' button that calls 'createTurnOptionQuery' with the previous menu

      //Generate full target array
      let targetArray = [];

      //move this into a new function?
      let menuOptionText = ["Threaten a foe","Disengage from a foe"]
      if(targetType === "actionMenu") { //Generate the list of actions that can be taken.
        for(let i = 0; i < 2; i++) {
          let $planningButton = $("<button>").addClass("commandButton");
          $planningButton.text(`${buttonOwner.name} - ${menuOptionText[i]}`);
          $planningButton.on("click", function() {
            buttonOwner.createTurnOptionQuery(1,i); //This will have to be changed!
            $(`#pc${pcID}Block`).css({"border-color":"#5e5542","background-color":"#e5c990"});
          });

          $planningButton.on("mouseenter", function() {
            $(`#pc${pcID}Block`).css({"border-color":"blue","background-color":"#ffe7b5"});
          });

          $planningButton.on("mouseleave", function() {
            $(`#pc${pcID}Block`).css({"border-color":"#5e5542","background-color":"#e5c990"});
          });
          $("#commandList").append($planningButton);
        }
      }

      if(targetType === "foes" || targetType === "all") {
        for(let i = 0; i < this.currentBattlefield.enemyList.length; i++) {
          if(this.currentBattlefield.enemyList[i].aliveBool){//Only make buttons pertaining to those still in combat - this allows others to ignore the dead
            targetArray.push(this.currentBattlefield.enemyList.slice(i,i+1)[0]);
          }
        }
      }
      if(targetType === "adventurers" || targetType === "all") {
        for(let i = 0; i < this.currentBattlefield.enemyList.length; i++) {
          if(this.currentBattlefield.playerCharacterList[i].aliveBool){
            targetArray.push(this.currentBattlefield.playerCharacterList.slice(i,i+1)[0]);
          }
        }
      }

      for(let i = 0; i < targetArray.length; i++) {
        let targetID = targetArray[i].battlefieldId.slice(-1);
        //Make a planning button for each vaild target
        let $planningButton = $("<button>").addClass("commandButton");
        //The text of the planning button
        if(actionType === "threatenAttack") {
          $planningButton.text(`${this.name} - Threaten: ${targetArray[i].name}`);
        } else if (actionType === "disengageAttack"){
          $planningButton.text(`${this.name} - Disengage: ${targetArray[i].name}`);
        }
        $planningButton.on("click", function() {
          //If this planning button is clicked, the following combat action button will be generated
          let $combatButton = $("<button>").addClass("combatButton");
          if(actionType === "threatenAttack") { //Threaten, then attack
            addToCombatLog(`${buttonOwner.name} is planning to threaten ${targetArray[i].name} with ${buttonOwner.weapon}`);

            $combatButton.text(`Next action: ${buttonOwner.name}`)
            $combatButton.attr("id",`combatButton${buttonOwner.battlefieldId}`);
            $combatButton.on("click", function() {
              //This order is VERY important! The next button needs to be shown.
              $combatButton.remove();
              buttonOwner.actionThreatenAttack(targetArray[i],1);
            });//End the combat button definition

          } else if (actionType === "disengageAttack"){ //Disengage, then attack
            addToCombatLog(`${buttonOwner.name} plans to disengage from ${targetArray[i].name}`);

            $combatButton.text(`Next action: ${buttonOwner.name}`)
            $combatButton.attr("id",`combatButton${buttonOwner.battlefieldId}`);
            $combatButton.on("click", function() {
              //This order is VERY important!
              $combatButton.remove();
              buttonOwner.actionDisengageAttack(targetArray[i]);
            });//End the combat button definition

          }
          $combatButton.css("display", "none");
          $("#actionList").append($combatButton);

          $(`#enemy${targetID}Block`).css({"border-color":"#5e5542","background-color":"#e5c990"});
          $(`#pc${pcID}Block`).css({"border-color":"#5e5542","background-color":"#e5c990"});
          //This character's turn is planned, move onto the next one
          buttonOwner.currentBattlefield.planningPhaseController();
        }); //End 'on click' for planningButton

        $planningButton.on("mouseenter", function() {
          $(`#enemy${targetID}Block`).css({"border-color":"blue","background-color":"#ffe7b5"});
          $(`#pc${pcID}Block`).css({"border-color":"blue","background-color":"#ffe7b5"});
        });

        $planningButton.on("mouseleave", function() {
          $(`#enemy${targetID}Block`).css({"border-color":"#5e5542","background-color":"#e5c990"});
          $(`#pc${pcID}Block`).css({"border-color":"#5e5542","background-color":"#e5c990"});
        });
        $("#commandList").append($planningButton)
      }

      //add a 'back' button to let the player reconsider their options.
      if(targetArray.length > 0) {
        let $backButton = $("<button>").addClass("commandButton");
        $backButton.text(`Back to previous options`);
        $backButton.on("click", function() {
          buttonOwner.createTurnOptionQuery(0,-1); //This will have to be changed!
        });
        $("#commandList").append($backButton);
      }



      //I don't think I need this anymore, keeping it around for a bit longer to be safe
      /*
      if($("#commandList").children().length === 0) {
        //console.log("No foes remain.");

        return;
      }
      */
    };


    //'Globallly used' methods - called by the global class(es?)

    //Recovers some of this character's wounds (by increasing the value).
    restoreWounds(amountRecovered = 0, maxRecoveryBool = 0) {
      if(maxRecoveryBool === 1) { //Max out wounds.
        this.wounds = this.maxWounds;
      } else { //Don't go above the max.
      this.wounds = Math.min(this.maxWounds, this.wounds + amountRecovered);
    }
    this.vigor = this.wounds; //Increase vigor to new maximum.
    if(this.wounds > 0) { //Resurrection! Might change the requirements for this.
      this.aliveBool = true;
      $(`#${this.battlefieldId}Block`).css("backgroundColor", "#e5c990");
    }
  };

} //End of Adventurer class

//I should convert most foes to this. Maybe.
class Enemy extends Creature {
  constructor() {
    super();
    this.vigor = 20;

    this.damage = 5;
    this.armor = 1;

    this.threatenedFoes = [];
  };


} //End of Enemy class







//Controls the flow of the fight, and has access to eveything in it. Brace yourself, this one's beefy
class Battlefield {
  //A battle needs some PCs to control, might as well assign them in the constructor.
  constructor(playerGroupIn) {
    //Used by the clas methods to check where we are in the combat loop
    //0 -> not started; 1 -> started, planning phase not yet begun;
    //2-> planning phase in progress; 3-> planning complete, running through actions (possibly cleanup)
    this.combatState = 0;
    //The list of adventurers in the party.
    this.attachedPlayerGroup = playerGroupIn; //Use when adding new party member?
    this.playerCharacterList = playerGroupIn.playerList;
    //The list of foes to fight in the current battle
    this.enemyList = [];
    //Lets the PCs easily refer to this class
    for(let i =0; i < this.playerCharacterList.length; i++) {
      this.playerCharacterList[i].currentBattlefield = this;
      this.playerCharacterList[i].battlefieldId = `pc${i}`;
    }
    //Use to indicate which adventurer's planning turn it is
    this.currentPlayerCharacter = 0;

    //Unused for now
    this.perceptionList = [];
    this.initiativeList = [];

    //The next 10 lines initialize the html for the first fight, but the fight won't be triggered just yet.
    let theBattlefield = this;
    let $newInitButton = $("<button>").text("-Roll Initiative-");
    $newInitButton.addClass("commandButton");
    $newInitButton.on("click", function() {
      addToCombatLog("Here we go again");
      theBattlefield.startCombat();
      this.remove();
    });
    $("#commandZone").append($newInitButton);
    this.displayBattlefield(true);
  }

  /* For now:
  function order:
  startCombat() -> Looped:[ planningPhaseController() <-> createActions ]
  ^                                                   |
  |                                                   v
  roundCleanUp()  <-  resolveCombat() <-  combatPhaseController()
  */

  //Called once at the start of each fight. Generates foes (abstract this part eventually), and resets any necissary variables from the last fight.
  startCombat() {

    //Decides on and generates a number of foes to fight. Update to pull information from the map side!
    let numberOfFoes = Math.floor(Math.random()*4)+1;
    for (let i = 0; i < numberOfFoes; i++) {
      let newEnemy = new Creature(`RUNELORD${i+1}`, " a glaive", i+1);
      this.enemyList.push(newEnemy);
    }
    //Makes the battlefield aware of the foes, and them aware of it.
    for(let i =0; i < this.enemyList.length; i++) {
      this.enemyList[i].currentBattlefield = this;
      this.enemyList[i].battlefieldId = `enemy${i}`;
    }

    //Combat has begun
    this.combatState = 1;
    this.displayBattlefield();
  }

  //Adds dynamic html elements. Call once at start of combat, but can also be used to refresh everything about all statblocks.
  displayBattlefield(initialFight = false) {
    this.createPCStatBlocks();
    this.createEnemyStatBlocks();

    if(!initialFight) { //Avoids priming a player turn at the start of the game
      this.planningPhaseController();
    }

  };

  //Sets up player statblocks. Currently has name, health values, health bar, attack and armor, and threat. When altering, watch the order carefully!
  createPCStatBlocks() {
    $("#playerCharacterZone").empty();
    for(let i = 0; i < this.playerCharacterList.length; i++) {

      let currentVigor = this.playerCharacterList[i].vigor;
      let currentWounds = this.playerCharacterList[i].wounds;
      let maxWounds = this.playerCharacterList[i].maxWounds;
      let damage = this.playerCharacterList[i].calculateDamage();
      let armor = this.playerCharacterList[i].calculateDR();
      let threat = this.playerCharacterList[i].totalThreat;
      let maxThreat = this.playerCharacterList[i].threatThreshold;

      let $newPCBlock = $("<div>").attr("id",`pc${i}Block`);
      $newPCBlock.addClass("pcStatBlock");
      $newPCBlock.append($("<h4>").text(`${this.playerCharacterList[i].name}`).css("margin","1em"));
      let $flexContainerHealth = $("<div>").addClass("flexBoxRow");

      let $healthContainer = $("<div>").addClass("healthContainer").css("margin", "auto");
      let $vigorBar = $("<bar>").addClass("vigorBar");
      $vigorBar.attr("id",`pc${i}VigorBar`);
      let $woundBar = $("<bar>").addClass("woundBar");
      $woundBar.attr("id",`pc${i}WoundBar`);
      $vigorBar.css("width",`${100*currentVigor/currentWounds}%`);
      $woundBar.css("width",`${100*currentWounds/maxWounds}%`);
      $healthContainer.append($woundBar);
      $woundBar.append($vigorBar);

      $("#playerCharacterZone").append($newPCBlock);
      $newPCBlock.append($flexContainerHealth);
      $flexContainerHealth.append($healthContainer);
      $flexContainerHealth.append($("<h3>").text(`${currentVigor}/${currentWounds}`).css("margin","auto"));
      $newPCBlock.append($("<h3>").text(`Attack: ${damage}`));
      $newPCBlock.append($("<h3>").text(`Armor: ${armor}`));
      $newPCBlock.append($("<h3>").text(`Threat: ${threat}/${maxThreat}`));

      if(currentWounds <= 0) {
        $newPCBlock.css("backgroundColor", "#4f2b2b");
      }

    }
  };


  //Creates enemy statblocks. Has name, health bar, health values
  createEnemyStatBlocks() {
    $("#enemyZone").empty();
    for(let i = 0; i < this.enemyList.length; i++) {

      let currentVigor = this.enemyList[i].vigor;
      let maxWounds = this.enemyList[i].maxWounds;

      let $newEnemyBlock = $("<div>").attr("id",`enemy${i}Block`);
      $newEnemyBlock.addClass("enemyStatBlock");
      $newEnemyBlock.append($("<h4>").text(`${this.enemyList[i].name}`));
      $newEnemyBlock.append($("<h3>").text(`${currentVigor}/${maxWounds}`));

      let $healthContainer = $("<div>").addClass("healthContainer");
      let $vigorBar = $("<bar>").addClass("vigorBar");
      $vigorBar.attr("id",`enemy${i}VigorBar`);
      $vigorBar.css("width",`${100*currentVigor/maxWounds}%`);

      $("#enemyZone").append($newEnemyBlock);
      $($newEnemyBlock).append($healthContainer);
      $healthContainer.append($vigorBar);
    }
  };


  //Goes through all characters and updates all HTML elements for vigor/wounds
  updateHealthValues() {
    for(let i = 0; i < this.playerCharacterList.length; i++) {
      let currentVigor = this.playerCharacterList[i].vigor;
      let currentWounds = this.playerCharacterList[i].wounds;
      let maxWounds = this.playerCharacterList[i].maxWounds;
      let $healthText = `${currentVigor}/${currentWounds}`;
      //Change these values if the statblocks are rearranged!
      $(`#pc${i}Block`).children().eq(1).children().eq(1).text($healthText);
      $(`#pc${i}WoundBar`).css("width",`${100*currentWounds/maxWounds}%`);
      $(`#pc${i}VigorBar`).css("width",`${100*currentVigor/currentWounds}%`);
    }
    for(let i = 0; i < this.enemyList.length; i++) {
      let currentVigor = this.enemyList[i].vigor;
      let maxVigor = this.enemyList[i].maxWounds;
      let healthText = `${currentVigor}/${maxVigor}`;
      $(`#enemy${i}Block`).children().eq(1).text(healthText);
      $(`#enemy${i}VigorBar`).css("width",`${100*currentVigor/maxVigor}%`);
    }
  };


  //Goes through the PCs and updates their HTML for armor, attack, and threat.
  //Expand to include foes!
  updateAttackArmorThreatValues() {
    for(let i = 0; i < this.playerCharacterList.length; i++) {
      let damage = this.playerCharacterList[i].calculateDamage();
      let armor = this.playerCharacterList[i].calculateDR();
      let threat = this.playerCharacterList[i].totalThreat;
      let maxThreat = this.playerCharacterList[i].threatThreshold;

      $(`#pc${i}Block`).children().eq(2).text(`Attack: ${damage}`);
      $(`#pc${i}Block`).children().eq(3).text(`Armor: ${armor}`);
      $(`#pc${i}Block`).children().eq(4).text(`Threat: ${threat}/${maxThreat}`);
    }
    for(let i = 0; i < this.enemyList.length; i++) {
    }
  }


  //Determines the order of who inputs commands, and generates buttons or calls 'enemyTurn()' until all creatures have chosen an action
  planningPhaseController() {
    //make array [creature, perception], ordered by LOWEST perception to HIGHEST (planning later lets you see what everyone else is doing before you decide)
    if(this.combatState === 1){
      //Empty everything from the previosu round, just to be safe
      $("#initativeOrderList").empty();
      $("#actionList").empty();
      this.initiativeList = [];
      this.perceptionList = [];
      //Add the PCs to the lists, rolling for their perception and init. values for the round
      for(let i = 0; i < this.playerCharacterList.length; i++) {
        let currentPlayer = this.playerCharacterList[i];
        if(currentPlayer.aliveBool) {
          let perceptionRoll = currentPlayer.perception + (Math.random()*20);
          currentPlayer.initRoll = currentPlayer.initiative + Math.floor((Math.random()*20));
          //Add these values to the perception and init. arrays
          this.perceptionList.push([currentPlayer, perceptionRoll]);
          this.initiativeList.push([currentPlayer, currentPlayer.initRoll , `combatButton${currentPlayer.battlefieldId}`]);
        }
      }
      //Now for the foes
      for(let i = 0; i < this.enemyList.length; i++) {
        let currentFoe = this.enemyList[i];
        if(currentFoe.aliveBool) {
          let perceptionRoll = currentFoe.perception + (Math.random()*20);
          currentFoe.initRoll = currentFoe.initiative + Math.floor((Math.random()*20));
          this.perceptionList.push([currentFoe, perceptionRoll]);
          this.initiativeList.push([currentFoe, currentFoe.initRoll, `combatButton${currentFoe.battlefieldId}`])
        }
      }
      //the random number should resolve ties randomly... I hope
      //sort the perception list, ascending
      this.perceptionList.sort(function(a,b){return (a[1] - (b[1]+(Math.random()*0.2-0.1)))});
      //sort the initiative list, descending
      this.initiativeList.sort(function(a,b){return (b[1] - (a[1]+(Math.random()*0.2-0.1)))});
      for(let i = 0; i < this.initiativeList.length; i++) {
        let currentCreature = this.initiativeList[i][0];
        $("#initativeOrderList").append($("<h5>").text(`${currentCreature.name} - Initiative: ${this.initiativeList[i][1]}`));
      }

      this.combatState = 2;
    }
    //console.log("perceptionList");
    //console.log(this.perceptionList);
    //check the first index in the array, and call the correct methods for a turn to be created. Remove that index.
    if(this.perceptionList.length > 0) {
      //Add a function here to sort the initiative list as it is built, to allow the player to plan more effectivly


      let nextCharacter = this.perceptionList.shift()[0];
      if(nextCharacter instanceof Adventurer) {
        //Creates a combatButton for one of the characters the player controls
        nextCharacter.createTurnOptionQuery(0,-1);
      } else {
        //Creates a combatButton for one of the foes
        this.enemyTurn(nextCharacter);
      }
    } else { //All turns submitted. Clear the command list and show the first action!
      $("#commandList").empty(); //This should not be necissary - find out why more buttons are being made!

      this.combatPhaseController();
    }
  };




  //Decides what the enemies do. Probably random for the most part, for my sake. Creates a button that executes the enemy's action when clicked by the player. For now, only engages the PCs.
  enemyTurn(whosTurn) {
      if(whosTurn.aliveBool) {

        let validTargets = [];
        for(let i =0; i < this.playerCharacterList.length; i++) {
          if(this.playerCharacterList[i].aliveBool) {
            validTargets.push(i);
          }
        }
        let targetChoiceIndex = validTargets[Math.floor(Math.random()*validTargets.length)];
        let selectedTarget = this.playerCharacterList[targetChoiceIndex]
        let $combatButton = $("<button>").addClass("combatButton");
        addToCombatLog(`${whosTurn.name} is planning to threaten ${selectedTarget.name} with ${whosTurn.weapon}`);
        $combatButton.text(`Initiative ${whosTurn.initRoll}: ${whosTurn.name} - threaten ${selectedTarget.name}`);
        $combatButton.attr("id",`combatButton${whosTurn.battlefieldId}`);
        $combatButton.on("click", function() {
          //This order is VERY important - don't delete the button until everything has been completed!

          console.log(`Turn: ${whosTurn.name}`);
          $combatButton.remove();
          whosTurn.actionThreatenAttack(selectedTarget,1);

          //whosTurn.currentBattlefield.combatPhaseController();

        });
        $combatButton.css("display", "none");
        $("#actionList").append($combatButton);
        //this.actionsRemaining++;
      }

    //enemy turn planned - back to the planning phase controller
    this.planningPhaseController();
  };

  //Determines the order in which the actions buttons are accessed.
  combatPhaseController() {
    console.log("Make next button visible!");
    console.log(this.initiativeList);
    if(this.initiativeList.length > 0) {
      let buttonId = this.initiativeList.shift()[2];
      console.log(buttonId);
      $(`#${buttonId}`).css("display","block");
    }
    //generate correct button Id, make it visible.
    //$("#actionList").children().eq(0).css("display", "block");
    //The combatButtons need Ids for this function to access.
    // "combatButtonenemy${i}" or "combatButtonpc${i}"
    //Make the actionButtons accessible one at a time in the correct order
    //Each combatButton should call this
    //Once all actions are complete, call resolveCombat();

    //Eventually, remove checkToEndturn()
    this.checkToEndTurn();
  }


  //This will be obsolete once combatPhaseController() is working!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  checkToEndTurn() {
    //console.log("checking end of turn");
    //console.log($("#actionList").children().length);
    //this.actionsRemaining--;
    console.log("remianing actions:");
    console.log($("#actionList").children().length);
    if($("#actionList").children().length <= 0) {
      //this.actionsRemaining = 0;
      this.resolveCombat();
    }
  }



  //Now everything acts based on initative order.
  //Display the buttons that were made during the player's turn one at a time, each moves combat forward one turn with the correct action
  // This one could get messy, depending how complicated combat becomes.
  resolveCombat() {

    //The buttons themselves are taking care of this for now - although this function should be used to arrange them in initiative order eventually.

    //clearCombatLog();

    let deadFoes = 0;
    let deadPCs = 0;
    for(let i = 0; i < this.enemyList.length; i++) {
      if(!this.enemyList[i].aliveBool) {
        deadFoes++;
      }
    }
    for(let i = 0; i < this.playerCharacterList.length; i++) {
      if(!this.playerCharacterList[i].aliveBool) {
        deadPCs++;
      }
    }

    if(deadFoes === this.enemyList.length) { //Players win
      addToCombatLog("---");
      addToCombatLog("No foes remain");
      this.combatCleanUp();
    } else if (deadPCs === this.playerCharacterList.length) { //Players lose
      addToCombatLog("---");
      addToCombatLog("The adventurers have fallen");
      addToCombatLog("GAME OVER")
    } else {
      addToCombatLog("---");
      addToCombatLog("A new round begins");
      this.combatState = 1;
      this.currentPlayerCharacter = 0;
      this.planningPhaseController();
    }

  }

  //
  combatCleanUp() {
    console.log("Combat cleanup");
    //make a new button (leaveBattle) that does the following - allows the player to see the outcome BEFORE leaving the battle screen
    let theBattlefield = this;

    let $leaveBattleButton = $("<button>").text("-Resume exploration-");
    $leaveBattleButton.addClass("commandButton");
    $leaveBattleButton.on("click", function() {

      //hide combat overlay
      $("#combatOverlay").hide();



      //reset battlefield values to default state
      theBattlefield.combatState = 0;
      theBattlefield.currentPlayerCharacter = 0;
      theBattlefield.enemyList = [];
      //theBattlefield.actionsRemaining = 0;
      //Initiative lists = [];

      //restore PCs stamina, update the map display
      for(let i = 0; i < theBattlefield.playerCharacterList.length; i++) {
        let currentPC = theBattlefield.playerCharacterList[i];
        currentPC.vigor = currentPC.wounds;
      }
      theBattlefield.attachedPlayerGroup.updateMapHealthBlocks();

      //create new roll initiative button that calls startCombat()

      let $newInitButton = $("<button>").text("-Roll Initiative-");
      $newInitButton.addClass("commandButton");
      $newInitButton.on("click", function() {
        addToCombatLog("Here we go again");
        theBattlefield.startCombat();
        this.remove();
      });
      $("#commandZone").append($newInitButton);

      //Now update the html
      theBattlefield.updateHealthValues();
      theBattlefield.updateAttackArmorThreatValues();
      theBattlefield.createEnemyStatBlocks();
      clearCombatLog();
      this.remove();
      addToCombatLog("More foes.")

    }); //End leaveBattleButton on click

    $("#commandZone").append($leaveBattleButton);

  };

  //Draws the lines that indicate who threatens who - I'm glad this works, because the game REALLY needs them to make sense
  //These values will have to change with responsiveness... oh boy!
  drawThreatLines() {
    let $drawArea = $("#centerZone").children().eq(0);
    $drawArea.empty();
    let numberPCs = this.playerCharacterList.length;
    let numberEnemies = this.enemyList.length;

    let yOneStart = Math.round(400-100*numberPCs);
    let yTwoStart = Math.round(375-75*numberEnemies);
    //Assuming default height of 600px, width of 300px
    for(let i = 0; i < this.playerCharacterList.length; i++) {
      let currentCharThreat = this.playerCharacterList[i].threatenedFoes;
      for (let j = 0; j < currentCharThreat.length; j++) {
        let threatAmount = currentCharThreat[j][1];
        for(let k=threatAmount; k > 0; k--) {
          //1red3   1/1-red
          //2red9 - 1tan3   1/2-tan 2/2 red
          //3red15 - 2tan9 - 1red3   1/3 red  2/3tan 3/3red
          let lineWidth = 2*(2*k-1); //Each line is 2px wide
          let lineColor;
          if((threatAmount+k)%2 === 0) { //even -> red
            lineColor = "rgb(255,0,0)";
          } else { //odd -> tan
            lineColor = "#e5c990";
          }
          let currentEnemyNumber = currentCharThreat[j][0].battlefieldId.slice(-1);
          let $newLine = $("<line>").attr("x1","0").attr("y1",`${yOneStart+200*i}`);
          $newLine.attr("x2","300").attr("y2",`${yTwoStart+(150*currentEnemyNumber)}`);
          $newLine.attr("style",`stroke:${lineColor};stroke-width:${lineWidth}`);
          $drawArea.append($newLine);
        }
      }
    }
    // Some serious (if simple?) magic here in this next line to rectify the lack of cooperation between jQuery and SVG - dynamically adding in lines via jQuery doesn't put them in the SVG namespace (I think it doesn't recgonize them correctly?) --- Found at:
    //https://stackoverflow.com/questions/20539196/creating-svg-elements-dynamically-with-javascript-inside-html (author: Timo Kähkönen)
    //Looks like it 'refreshes' the html within the selected element, causing SVG to restart with the new lines already written - thus rendering them! Magic!
    $("#centerZone").html($("#centerZone").html()); //DO. NOT. DELETE.
  };



}//End Battlefield class


//Contains the list of player characters, and functions to act on all of them. Used by the mapBattleCommunicator.
class PlayerGroup {
  constructor() {
    this.playerList = []
  };

  addPC(characterIn) {
    this.playerList.push(characterIn);
  };

  returnPCs() {
    return this.playerList;
  }

  updateMapHealthBlocks() {
    let $mapHealthBox = $("#mapHealthBarZone");
    $mapHealthBox.empty();

    for(let i = 0; i < this.playerList.length; i++) {
      let currentVigor = this.playerList[i].vigor;
      let currentWounds = this.playerList[i].wounds;
      let maxWounds = this.playerList[i].maxWounds;

      let $healthContainer = $("<div>").addClass("healthContainer").css("margin", "auto");
      $healthContainer.css("width","60px").css("height","15px").css("margin","2px");
      let $vigorBar = $("<bar>").addClass("vigorBar");
      let $woundBar = $("<bar>").addClass("woundBar");
      $vigorBar.css("width",`${100*currentVigor/currentWounds}%`);
      $woundBar.css("width",`${100*currentWounds/maxWounds}%`);
      $healthContainer.append($woundBar);
      $woundBar.append($vigorBar);
      $mapHealthBox.append($("<h2>").text(`${this.playerList[i].name}`).css("font-size","8px"))
      $mapHealthBox.append($("<h2>").text(`${currentVigor}/${currentWounds}`).css("font-size","8px"))
      $mapHealthBox.append($healthContainer);
    }
  };

  //show/hide levelup modal



} //End PlayerGroup class

//The class used to get USGS data and do something with it.
class ForceOfNature {
  constructor() {
    //change to USGS
    //this.queryString = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2014-01-01&endtime=2014-01-02`;
  }

  getExternalData() {

    //Get today's date
    let todaysDate = new Date;
    //Get quake data from just today
    this.queryString = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${todaysDate.getFullYear()}-${todaysDate.getMonth()+1}-${todaysDate.getDate()}`;

    //API magic
    const promise = $.ajax({
      url:this.queryString
    });

    promise.then(
      (data)=>{
        //Grab a random magnitude value from the API
        let quakeData = data.features[Math.floor(Math.random()*data.features.length)].properties.mag;

        //send the data somewhere
        addToCombatLog(`Found some earthquake data: ${quakeData}`);
        addToCombatLog("I will use it eventually, I promise!");
      },
      ()=>{
        console.log('bad request');
      }
    );
  };


}




//////Global functions

function addToCombatLog(textIn) {
  let $newListElement = $("<li>").text(`${textIn}`);
  $("#combatLogDiv").append($newListElement);
  if($("#combatLogDiv").children().length > 8) {
    $("#combatLogDiv").children().eq(0).remove();
  }
}

function clearCombatLog() {
  $("#combatLogDiv").empty();
}


//////





//This is temporary - everything here will have to be broken down into separate functions (that are called using elements in the html)
function combatLoop() {





  console.log("DONE");

} //End combatLoop function



//Run 'Stuff'

let quake = new ForceOfNature();
nameIn = "Garzmok", weaponIn = "a sword", woundsIn = 40, damageIn = 12, armorIn = 2, threatThIn = 2
let garzmok = new Adventurer("Garzmok", "a greatsword", 55, 14, 1, 2,3);
let runa = new Adventurer("Runa", "unarmed strikes", 40, 10, 4, 3,5);
let talathel = new Adventurer("Talathel", "a rapier", 35, 18, 2, 1,2);

let partyOne = new PlayerGroup();
partyOne.addPC(garzmok);
partyOne.addPC(runa);
partyOne.addPC(talathel);
partyOne.updateMapHealthBlocks();
mbComms.commLinkToPlayerGroup(partyOne);

let fightOne = new Battlefield(partyOne);
mbComms.commLinkToBattlefield(fightOne);

quake.getExternalData();









}); //End jQuery











//
