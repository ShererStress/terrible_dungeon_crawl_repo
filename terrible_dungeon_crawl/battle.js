/*
Characters can engage targets, automatically damaging them each round. Damage is split among targets (inconsistent distribution).
Engaging too many foes causes the character to become overwhelmed, taking penalites until some foes have disengaged.

Actions:
Engage target (up to limit)
Ability use
Guard (redirects all new attackers)
Disengage/withdraw
Shift stance

// todo:
convert to jQuery

removing creatures is a bit more complex, as they exist in:
every foe's engagement arrays
~initative order (s)
~list of foes

Get this into the html, not too far off, honestly
elements to display everything
a button to select which foe to focus
everything else should still be automated at this point

*/

$(()=>{ //Start jQuery

  //The basis for most in-game creatures
  //Only uses fatigue for health - no wounds
  class Creature {
    constructor(nameIn = "RUNELORD") {
      this.name = nameIn;
      this.engagedFoes = [];
      this.engagementThreshold = 2;
      this.totalEngagement = 0;
      this.overwhelmedState = 0; //0 -> no, 1 -> at limit, 2 -> Yes

      this.fatigue = 80;
      this.maxWounds = 80; //used to keep track of max fatigue

      this.damage = 5;
      this.armor = 1;

      this.onesGroup;
      this.currentBattlefield; //Allows references to battlefield
      this.battlefieldId; //Used to refer to html element ids

      this.aliveBool = true;
    };

    //Do some damage. By default, this is applied to something in the array of engaged foes.
    //Getting an undefined error? Make some notArray -> array code
    attack(targetList = this.engagedFoes) {

      let totalDamage = this.calculateDamage();
      //Pick a target - new function?
      let possibleTargetArray = [];
      let highestPriority = 0;
      for(let i = 0; i < this.engagedFoes.length; i++) {
        if(this.engagedFoes[i][1] > highestPriority) {
          highestPriority = this.engagedFoes[i][1]; //Sets new priority level
          possibleTargetArray.length = 0; //Avoids memory leaks?
          possibleTargetArray = [i];
        } else if (this.engagedFoes[i][1] === highestPriority) {
          highestPriority = this.engagedFoes[i][1];
          possibleTargetArray.push(i);
        }
      }
      //Choose a target from the list of highest priority foes
      let selectedTargetIndex = possibleTargetArray[Math.floor(Math.random()*possibleTargetArray.length)];

      let target = targetList[selectedTargetIndex][0];
      target.takeDamage(totalDamage);
    };

    calculateDamage() {
      //let damageModifier = this.engagementThreshold - ;
      return(this.damage - this.totalEngagement);
    }

    takeDamage(incomingDamage) {
      let effectiveArmor = this.calculateDR();
      let damageTaken = Math.max(incomingDamage-effectiveArmor,1);
      this.fatigue -= damageTaken;
      this.currentBattlefield.updateHealthValues();
      if( this.fatigue <= 0) { //If dead
        $(`#${this.battlefieldId}Block`).css("backgroundColor", "#4f2b2b");
        $(`#${this.battlefieldId}Block`).css("border-color","#5e5542");
        this.aliveBool = false;
        this.clearThreat();
        this.currentBattlefield.drawThreatLines()
      }
      return(damageTaken);
    };

    calculateDR() {
      let effectiveArmor = this.armor;
      if(this.overwhelmedState === 2) {
        effectiveArmor -= (this.totalEngagement - this.engagementThreshold);
      }
      return(effectiveArmor);
    }

    engageTarget(targetCreature, reciprocateBoolean = 0) {
      //Search list of engaged targets for the foe
      let enemyExists = false;

      if(this.overwhelmedState >= 1 && reciprocateBoolean === 1) {
        console.log(`${this.name} can't attack another foe - they are busy with their current targets!`);
      } else {
        for(let i =0; i < this.engagedFoes.length; i++) {
          if(this.engagedFoes[i].indexOf(targetCreature) === 0) {
            this.engagedFoes[i][1]++;
            if(reciprocateBoolean === 1) {
              console.log(`${this.name} focused the attack against ${targetCreature.name}`);
            }
            enemyExists = true;
          }
        }
        if(!enemyExists) {
          this.engagedFoes.push([targetCreature,1]);
          if(reciprocateBoolean === 1) {
            console.log(`${this.name} moved to attack ${targetCreature.name}`);
          }
        }

        this.updateTotalEngagement();

        if (this.totalEngagement > this.engagementThreshold){
          console.log(`${this.name} is fighting too many foes - they're being overwhelmed!`);
        }

        //this is REALLY important - stops an infinte loop of recursion
        if(reciprocateBoolean) {
          targetCreature.engageTarget(this);
        }
      }
    };

    updateTotalEngagement() {
      let totalProblems = 0;
      for(let i = 0; i<this.engagedFoes.length; i++) {
        totalProblems += this.engagedFoes[i][1];
      }
      this.totalEngagement = totalProblems;
      if(this.totalEngagement >= this.engagementThreshold) {
        this.overwhelmedState = 1;
        if (this.totalEngagement > this.engagementThreshold) {
          this.overwhelmedState = 2;
        }
      } else {
        this.overwhelmedState = 0;
      }
      //Now update everything's Atk/Arm/Threat values
      this.currentBattlefield.updateAttackArmorThreatValues();
    };

    //Loops through this creature's threat array and removes itself from other creates threat lists. Then deletes this creates threat list. Used in case of retreat or death.
    //this.engagedFoes.push([targetCreature,1]);
    clearThreat() {
      for (let i = 0; i < this.engagedFoes.length; i++) {
        let currentCreature = this.engagedFoes[i][0];
        let currentCreatureThreatList = this.engagedFoes[i][0].engagedFoes;
        for (let j = 0; j < currentCreatureThreatList.length; j++) {
          if(currentCreatureThreatList[j][0] === this) {
            currentCreatureThreatList.splice(j,1);
            currentCreature.updateTotalEngagement()
          }
        }
      }
      this.engagedFoes.splice(0,this.engagedFoes.length);
      this.updateTotalEngagement();
      console.log(`Cleared ${this.name}'s list`);
    }

    logHealth() {
      console.log(`${this.fatigue}/${this.maxWounds}`);
    };

  } //End of Creature class

  class Adventurer extends Creature {
    constructor(nameIn = "Garzmok") {
      super();
      this.name = nameIn;
      this.maxWounds = 40;
      this.wounds = 40;
      this.fatigue = 40;
      this.engagementThreshold = 7;

      this.damage = 13;
      this.armor = 3;

      this.aliveBool = true;
    };

    takeDamage(incomingDamage) {
      let damageTaken = Math.max(incomingDamage-this.calculateDR(),1); //Always take 1 damage
      let fatigueDamageTaken = Math.min(damageTaken, this.fatigue);
      let woundDamage = damageTaken-fatigueDamageTaken;
      //console.log("WOUND DAMAGE : " + woundDamage);
      this.fatigue -= fatigueDamageTaken;
      woundDamage += Math.floor(damageTaken/(Math.floor(this.maxWounds/10)));
      //console.log("TOTAL WOUND DAMAGE: "+ woundDamage);
      this.wounds -= woundDamage;
      this.currentBattlefield.updateHealthValues();
      if( this.wounds <= 0) { //If dead
        $(`#${this.battlefieldId}Block`).css("backgroundColor", "#4f2b2b");
        this.aliveBool = false;
      }
    };

    logHealth() {
      console.log(`${this.fatigue}/${this.wounds}/${this.maxWounds}`);
    };

    //Same as the creatures, but allows the combat flow to continue
    engageTarget(targetCreature, reciprocateBoolean = 0) {
      super.engageTarget(targetCreature, reciprocateBoolean);
      if(reciprocateBoolean === 1) {
        this.currentBattlefield.playerTurnComplete();
      }
    };



    // Methods for interacting with Battlefield and PlayerGroup classes

    //call this once on character generation to generate arrays for making buttons in combat. Organize this stuff WELL
    makeCombatOptionsObjects() {
      //Object - Engage Target buttons (4?), when displayed, only show a number equal to the number of foes. Each button is keyed to an index in the enemy array, as opposed to a specific enemy instantiation.
    };

    //Displays the buttons to allow the player to input a turn. This may get REALLY bloated.
    displayTurnOptions(keysIn = []) {
      console.log("generating options");
      $("#commandList").empty();
      let buttonOwner = this;

      //If target=enemy
      for(let i = 0; i < this.currentBattlefield.enemyList.length; i++) {
        if(this.currentBattlefield.enemyList[i].aliveBool) {
          //use a switch here to select which function to tack onto the button
          let $newButton = $("<button>").text(`Threaten: ${this.currentBattlefield.enemyList[i].name}`);
          $newButton.addClass("commandButton");
          $newButton.on("click", function() {
            buttonOwner.engageTarget(buttonOwner.currentBattlefield.enemyList[i],1);
          });
          $newButton.on("mouseenter", function() {
            $(`#enemy${i}Block`).css("border-color","blue");
          });
          $newButton.on("mouseleave", function() {
            $(`#enemy${i}Block`).css("border-color","#5e5542");
          });
          $("#commandList").append($newButton)
        }
      }

      //if else (target ally)




      //if else (target self)





      //This won't work forever as more buttons are added
      if($("#commandList").children().length === 0) {
        console.log("No foes remain.");

        return;
      }
      // $("#testButton").on("click", function() {
      //   for(let i = 0; i < buttonOwner.currentBattlefield.enemyList.length; i++) {
      //     if(buttonOwner.currentBattlefield.enemyList[i].aliveBool) {
      //
      //
      //     }
      //   }
      //
      // });

    };


  } //End of Adventurer class

  class Enemy extends Creature {
    constructor() {
      super();
      this.fatigue = 20;

      this.damage = 5;
      this.armor = 1;

      this.engagedFoes = [];
    };


  } //End of Enemy class


  //Controls the flow of the fight, and has access to eveything in it
  class Battlefield {
    constructor(playerGroupIn) {
      this.combatState = 0; //

      this.playerCharacterList = playerGroupIn.playerList;

      //Lets the PCs easily refer to this class
      for(let i =0; i < this.playerCharacterList.length; i++) {
        this.playerCharacterList[i].currentBattlefield = this;
        this.playerCharacterList[i].battlefieldId = `pc${i}`;
      }

      this.currentPlayerCharacter = 0;

      this.enemyList = [];

      this.initiativeList = [];

    }

    /*
    function order:
    startCombat() -> Looped(primePlayerTurn() <-> playerTurnComplete())
    ^                                     |
    |                                     v
    roundCleanUp()  <-  resolveCombat() <-  enemyTurn()
    */
    //Generates foes (abstract this part eventually), and resets any necissary variables from the last fight
    //Called once at the start of each fight
    startCombat() {

      //loop for more foes
      for (let i = 0; i < 3; i++) {
        let newEnemy = new Creature(`RUNELORD${i+1}`);
        this.enemyList.push(newEnemy);
      }

      for(let i =0; i < this.enemyList.length; i++) {
        this.enemyList[i].currentBattlefield = this;
        this.enemyList[i].battlefieldId = `enemy${i}`;
      }

      //once the player has entered all commands, we can use a chain of functions (although being able to slow down or pause the combat would be nice - use setDelay!)
      this.combatState = 1;
      this.displayBattlefield();
    }

    //Adds dynamic html elements. Call once at start of combat, but can also be used to refresh everything about all statblocks.
    displayBattlefield() {
      this.createPCStatBlocks();
      this.createEnemyStatBlocks();

      this.primePlayerTurn();
    };

    //Sets up player statblocks. Currently has name, health values, health bar, attack and armor
    createPCStatBlocks() {
      $("#playerCharacterZone").empty();
      for(let i = 0; i < this.playerCharacterList.length; i++) {

        let currentFatigue = this.playerCharacterList[i].fatigue;
        let currentWounds = this.playerCharacterList[i].wounds;
        let maxWounds = this.playerCharacterList[i].maxWounds;
        let damage = this.playerCharacterList[i].calculateDamage();
        let armor = this.playerCharacterList[i].calculateDR();
        let threat = this.playerCharacterList[i].totalEngagement;
        let maxThreat = this.playerCharacterList[i].engagementThreshold;

        let $newPCBlock = $("<div>").attr("id",`pc${i}Block`);
        $newPCBlock.addClass("pcStatBlock");
        $newPCBlock.append($("<h4>").text(`${this.playerCharacterList[i].name}`).css("margin","1em"));
        let $flexContainerHealth = $("<div>").addClass("flexBoxRow");

        let $healthContainer = $("<div>").addClass("healthContainer").css("margin", "auto");
        let $fatigueBar = $("<bar>").addClass("fatigueBar");
        $fatigueBar.attr("id",`pc${i}FatigueBar`);
        let $woundBar = $("<bar>").addClass("woundBar");
        $woundBar.attr("id",`pc${i}WoundBar`);
        $fatigueBar.css("width",`${100*currentFatigue/currentWounds}%`);
        $woundBar.css("width",`${100*currentWounds/maxWounds}%`);
        $healthContainer.append($woundBar);
        $woundBar.append($fatigueBar);

        $("#playerCharacterZone").append($newPCBlock);
        $newPCBlock.append($flexContainerHealth);
        $flexContainerHealth.append($healthContainer);
        $flexContainerHealth.append($("<h3>").text(`${currentFatigue}/${currentWounds}`).css("margin","auto"));
        $newPCBlock.append($("<h3>").text(`Attack: ${damage}`));
        $newPCBlock.append($("<h3>").text(`Armor: ${armor}`));
        $newPCBlock.append($("<h3>").text(`Threat: ${threat}/${maxThreat}`));

      }
    };

    createEnemyStatBlocks() {
      $("#enemyZone").empty();
      for(let i = 0; i < this.enemyList.length; i++) {

        let currentFatigue = this.enemyList[i].fatigue;
        let maxWounds = this.enemyList[i].maxWounds;

        let $newEnemyBlock = $("<div>").attr("id",`enemy${i}Block`);
        $newEnemyBlock.addClass("enemyStatBlock");
        $newEnemyBlock.append($("<h4>").text(`${this.enemyList[i].name}`));
        $newEnemyBlock.append($("<h3>").text(`${currentFatigue}/${maxWounds}`));

        let $healthContainer = $("<div>").addClass("healthContainer");
        let $fatigueBar = $("<bar>").addClass("fatigueBar");
        $fatigueBar.attr("id",`enemy${i}FatigueBar`);
        $fatigueBar.css("width",`${100*currentFatigue/maxWounds}%`);

        $("#enemyZone").append($newEnemyBlock);
        $($newEnemyBlock).append($healthContainer);
        $healthContainer.append($fatigueBar);
      }
    };

    //Goes through all characters and updates fatigue/wounds
    updateHealthValues() {
      for(let i = 0; i < this.playerCharacterList.length; i++) {
        let currentFatigue = this.playerCharacterList[i].fatigue;
        let currentWounds = this.playerCharacterList[i].wounds;
        let maxWounds = this.playerCharacterList[i].maxWounds;
        let $healthText = `${currentFatigue}/${currentWounds}`;
        //Change these values if the statblocks are rearranged!
        $(`#pc${i}Block`).children().eq(1).children().eq(1).text($healthText);
        $(`#pc${i}WoundBar`).css("width",`${100*currentWounds/maxWounds}%`);
        $(`#pc${i}FatigueBar`).css("width",`${100*currentFatigue/currentWounds}%`);
      }
      for(let i = 0; i < this.enemyList.length; i++) {
        let currentFatigue = this.enemyList[i].fatigue;
        let maxFatigue = this.enemyList[i].maxWounds;
        let healthText = `${currentFatigue}/${maxFatigue}`;
        $(`#enemy${i}Block`).children().eq(1).text(healthText);
        $(`#enemy${i}FatigueBar`).css("width",`${100*currentFatigue/maxFatigue}%`);
      }
    };

    updateAttackArmorThreatValues() {
      for(let i = 0; i < this.playerCharacterList.length; i++) {
        let damage = this.playerCharacterList[i].calculateDamage();
        let armor = this.playerCharacterList[i].calculateDR();
        let threat = this.playerCharacterList[i].totalEngagement;
        let maxThreat = this.playerCharacterList[i].engagementThreshold;

        $(`#pc${i}Block`).children().eq(2).text(`Attack: ${damage}`);
        $(`#pc${i}Block`).children().eq(3).text(`Armor: ${armor}`);
        $(`#pc${i}Block`).children().eq(4).text(`Threat: ${threat}/${maxThreat}`);
      }
      for(let i = 0; i < this.enemyList.length; i++) {
      }
    }

    //Creates buttons for one of the characters the player controls
    //Each time it is called, it applies to the next character in the group; calls playerTurnComplete each time
    primePlayerTurn() {
      //Index for each player

      console.log("Current turn: " + this.playerCharacterList[this.currentPlayerCharacter].name);


      this.currentPlayerCharacter++;
      if(this.currentPlayerCharacter === this.playerCharacterList.length) {
        this.combatState = 2;
      }

      this.playerCharacterList[this.currentPlayerCharacter-1].displayTurnOptions();
    }

    //Whenever the player finishes selecting what to do on a turn, this should be called to move combat forward. Calls 'enemyTurn()' once all player characters have selected actions.
    playerTurnComplete() {
      if(this.combatState === 2) {
        this.enemyTurn();
      } else {
        this.primePlayerTurn();
      }
    }

    //Decides what the enemies do. Probably random for the most part, for my sake. Calls resolve combat once done (or primes a button to do so).
    enemyTurn() {
      for( let i = 0; i < this.enemyList.length; i++) {
        if(this.enemyList[i].aliveBool) {
          this.enemyList[i].engageTarget(this.playerCharacterList[0],1);
        }
      }

      this.resolveCombat();
    }

    //Now everything acts based on initative order.
    //Display the buttons that were made during the player's turn one at a time, each moves combat forward one turn with the correct action
    // This one could get messy, depending how complicated combat becomes.
    resolveCombat() {

      fightOne.drawThreatLines();

      for( let i = 0; i < this.playerCharacterList.length; i++) {
        console.log(`${this.playerCharacterList[i].name} attacks!`);
        this.playerCharacterList[i].attack();

      }
      for( let i = 0; i < this.enemyList.length; i++) {
        if(this.enemyList[i].aliveBool) {
          console.log(`${this.enemyList[i].name} attacks!`);
          this.enemyList[i].attack();

        } else {
          console.log(`${this.enemyList[i].name} does nothing`);
        }

      }

      //this.playerCharacterList[0].clearThreat();

      //console.log("Done?");

      //console.log(this.playerCharacterList[0].engagedFoes);
      //console.log(this.enemyList[0].engagedFoes);
      //console.log(this.enemyList[1].engagedFoes);
      //actions/damage
      //pause for button confirm
      //roundCleanup()


      //reset the round - temporary
      this.combatState = 1;
      this.currentPlayerCharacter = 0;
      this.primePlayerTurn();
    }

    //
    roundCleanUp() {
      // (DONT) remove the fallen, reset menus, etc.
      //Check for victory/defeat

      //temporary
      //document.getElementById("combatOverlay").style.display = "none";

      // primePlayerTurn();
    }

    //Draws the lines that indicate who threatens who - I'm glad this works, because the game REALLY needs them to make sense
    //These values will have to change with responsiveness...
    drawThreatLines() {
      let $drawArea = $("#centerZone").children().eq(0);
      $drawArea.empty();
      let numberPCs = this.playerCharacterList.length;
      let numberEnemies = this.enemyList.length;
      let yOneStart = Math.round(600/(numberPCs+1));
      let yTwoStart = Math.round(600/(numberEnemies+1))
      //Assuming default height of 600px, width of 300px
      for(let i = 0; i < this.playerCharacterList.length; i++) {
        let currentCharThreat = this.playerCharacterList[i].engagedFoes;
        for (let j = 0; j < currentCharThreat.length; j++) {
          let threatAmount = currentCharThreat[j][1];
          for(let k=threatAmount; k > 0; k--) {
            //1red3   1/1-red
            //2red9 - 1tan3   1/2-tan 2/2 red
            //3red15 - 2tan9 - 1red3   1/3 red  2/3tan 3/3red
            let lineWidth = (6*k-3); //Each line is 3px wide
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


  //Contains the list of player characters, and some functions to act on all of them
  class PlayerGroup {
    constructor() {
      this.playerList = []
    };

    addPC(characterIn) {
      this.playerList.push(characterIn);
    };

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
          $("#combatLog").text(`Found some earthquake data: ${quakeData}`);
        },
        ()=>{
          console.log('bad request');
        }
      );
    };


  }




  //////Global functions






  //////





  //This is temporary - everything here will have to be broken down into separate functions (that are called using elements in the html)
  function combatLoop() {





    console.log("DONE");

  } //End combatLoop function



  //Run 'Stuff'



  let garzmok = new Adventurer("Garzmok");
  let runa = new Adventurer("Runa");
  let partyOne = new PlayerGroup();
  let quake = new ForceOfNature();

  partyOne.addPC(garzmok);
  partyOne.addPC(runa);

  let fightOne = new Battlefield(partyOne);

  fightOne.startCombat();

  quake.getExternalData();

  //Test API functionality













}); //End jQuery











//
