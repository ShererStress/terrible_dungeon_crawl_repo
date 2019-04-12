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
  constructor() {
    this.name = "RUNELORD";
    this.engagedFoes = [];
    this.engagementThreshold = 1;
    this.totalEngagement = 0;
    this.overwhelmedState = 0; //0 -> no, 1 -> at limit, 2 -> Yes

    this.fatigue = 20;
    this.maxWounds = 20; //used to keep track of max fatigue

    this.damage = 9;
    this.armor = 1;

    this.onesGroup;
    this.currentBattlefield;
  };

  //Do some damage. By default, this is applied to something in the array of engaged foes.
  //Getting an undefined error? Make some notArray -> array code
  attack(targetList = this.engagedFoes) {
    let damageModifier = this.engagementThreshold - this.totalEngagement; //Change as things are implemented
    let totalDamage = this.damage + damageModifier;
    //Pick a target - new function?
    let possibleTargetArray = [];
    let highestPriority = 0;
    for(let i = 0; i < this.engagedFoes.length; i++) {
      if(this.engagedFoes[i][1] >= highestPriority) {
        highestPriority = this.engagedFoes[i][1];
        possibleTargetArray.push(i);
        if(this.engagedFoes[i][1] > highestPriority) {
          highestPriority = this.engagedFoes[i][1];
          possibleTargetArray.length = 0; //Avoids memory leaks?
          possibleTargetArray = [i];
        }
      }
    }
    //Choose a target from the list of highest priority foes
    let selectedTargetIndex = possibleTargetArray[Math.floor(Math.random()*possibleTargetArray.length)];

    let target = targetList[selectedTargetIndex][0];
    target.takeDamage(totalDamage);
  };

  takeDamage(incomingDamage) {
    let effectiveArmor = this.armor;
    if(this.overwhelmedState === 2) {
      effectiveArmor -= (this.totalEngagement - this.engagementThreshold);
    }
    let damageTaken = incomingDamage-effectiveArmor;
    this.fatigue -= damageTaken;
    this.currentBattlefield.updateHealthValues();
    return(damageTaken);
  };

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
  };

  logHealth() {
    console.log(`${this.fatigue}/${this.maxWounds}`);
  };

} //End of Creature class

class Adventurer extends Creature {
  constructor() {
    super();
    this.name = "Garzmok";
    this.maxWounds = 40;
    this.wounds = 40;
    this.fatigue = 40;
    this.engagementThreshold = 3;

    this.damage = 6;
    this.armor = 2;
  };

  takeDamage(incomingDamage) {
    let damageTaken = incomingDamage-this.armor;
    let fatigueDamageTaken = Math.min(damageTaken, this.fatigue);
    let woundDamage = damageTaken-fatigueDamageTaken;
    //console.log("WOUND DAMAGE : " + woundDamage);
    this.fatigue -= fatigueDamageTaken;
    woundDamage += Math.floor(damageTaken/(Math.floor(this.maxWounds/10)));
    //console.log("TOTAL WOUND DAMAGE: "+ woundDamage);
    this.wounds -= woundDamage;
    this.currentBattlefield.updateHealthValues();
  };

  logHealth() {
    //console.log(`${this.fatigue}/${this.wounds}/${this.maxWounds}`);
  };

  //Same as the creatures, but allows the combat flow to continue
  engageTarget(targetCreature, reciprocateBoolean = 0) {
    console.log("Getting there");
    super.engageTarget(targetCreature, reciprocateBoolean);
    console.log("Getting there");
    this.currentBattlefield.playerTurnComplete();
  }



  // Methods for interacting with Battlefield and PlayerGroup classes

  //call this once on character generation to generate arrays for making buttons in combat. Organize this stuff WELL
  makeCombatOptionsObjects() {
    //Object - Engage Target buttons (4?), when displayed, only show a number equal to the number of foes. Each button is keyed to an index in the enemy array, as opposed to a specific enemy instantiation.
  };

  //Displays the buttons to allow the player to input a turn. This may get REALLY bloated.
  displayTurnOptions(keysIn = []) {
    let buttonOwner = this;
    document.getElementById("rollInitButton").textContent = "Damage target";
    document.getElementById("rollInitButton").addEventListener("click", function() {
      buttonOwner.engageTarget(buttonOwner.currentBattlefield.enemyList[0],1);
    });

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
    for (let i = 0; i < 2; i++) {
      let newEnemy = new Creature();
      this.enemyList.push(newEnemy);
    }

    for(let i =0; i < this.enemyList.length; i++) {
      this.enemyList[i].currentBattlefield = this;
    }

    //once the player has entered all commands, we can use a chain of functions (although being able to slow down or pause the combat would be nice - use setDelay!)
    this.combatState = 1;
    this.displayBattlefield();
  }

  //Adds dynamic html elements. Call once at start of combat, but can also be used to refresh everything about all statblocks.
  displayBattlefield() {
    this.displayPCStatBlocks();
    this.displayEnemyStatBlocks();

    this.primePlayerTurn();
  };

  //Sets up player statblocks. Currently has health values: bar.
  displayPCStatBlocks() {
    $("#playerCharacterZone").empty();
    for(let i = 0; i < this.playerCharacterList.length; i++) {

      let currentFatigue = this.playerCharacterList[i].fatigue;
      let currentWounds = this.playerCharacterList[i].wounds;
      let maxWounds = this.playerCharacterList[i].maxWounds;

      let $newPCBlock = $("<div>").attr("id",`pcBlock${i}`);
      $newPCBlock.addClass("pcStatBlock");
      $newPCBlock.append($("<h4>").text(`${this.playerCharacterList[i].name}`));
      $newPCBlock.append($("<h3>").text(`${currentFatigue}/${currentWounds}`));

      let $healthContainer = $("<div>").addClass("healthContainer");
      let $fatigueBar = $("<bar>").addClass("fatigueBar");
      $fatigueBar.attr("id",`pc${i}FatigueBar`);
      let $woundBar = $("<bar>").addClass("woundBar");
      $woundBar.attr("id",`pc${i}WoundBar`);
      $fatigueBar.css("width",`${100*currentFatigue/currentWounds}%`);
      $woundBar.css("width",`${100*currentWounds/maxWounds}%`);

      $("#playerCharacterZone").append($newPCBlock);
      $($newPCBlock).append($healthContainer);
      $healthContainer.append($woundBar);
      $woundBar.append($fatigueBar);

    }
  };

  displayEnemyStatBlocks() {
    $("#enemyZone").empty();
    for(let i = 0; i < this.enemyList.length; i++) {

      let currentFatigue = this.enemyList[i].fatigue;
      let maxWounds = this.enemyList[i].maxWounds;

      //The id of the blocks will change as other enemies are removed from the array - they will have to be changed dynamically!
      let $newEnemyBlock = $("<div>").attr("id",`enemyBlock${i}`);
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
      $(`#pcBlock${i}`).children().eq(1).text($healthText);
      $(`#pc${i}WoundBar`).css("width",`${100*currentWounds/maxWounds}%`);
      $(`#pc${i}FatigueBar`).css("width",`${100*currentFatigue/currentWounds}%`);
    }
      for(let i = 0; i < this.enemyList.length; i++) {
        let currentFatigue = this.enemyList[i].fatigue;
        let maxFatigue = this.enemyList[i].maxWounds;
        let healthText = `${currentFatigue}/${maxFatigue}`;
        $(`#enemyBlock${i}`).children().eq(1).text(healthText);
        $(`#enemy${i}FatigueBar`).css("width",`${100*currentFatigue/maxFatigue}%`);
      }
  };

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
    console.log(this.combatState);
    if(this.combatState === 2) {
      this.enemyTurn();
    } else {
      console.log("we goofed");
      primePlayerTurn()
    }
  }

  //Decides what the enemies do. Probably random for the most part, for my sake. Calls resolve combat once done (or primes a button to do so).
  enemyTurn() {
    this.enemyList[0].engageTarget(garzmok,1);

    garzmok.attack();
    this.enemyList[0].attack();

    garzmok.logHealth();
    this.enemyList[0].logHealth();
    if(this.enemyList[0].fatigue <= 0) {


      //temporary
      document.getElementById("combatOverlay").style.display = "none";

      //-> resolveCombat();
    }
  }

  //Now everything acts based on initative order. Need to find a way to store function calls (and their parameters!) to be used here. This one could get messy, depending how complicated combat becomes.
  resolveCombat() {
    //actions/damage
    //pause for button confirm
    //roundCleanup()
  }

  //
  roundCleanUp() {
    //remove the fallen, reset menus, etc.
    //Check for victory/defeat

    // primePlayerTurn();
  }


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
        $("#combatLog").text(`Found some earthquare data: ${quakeData}`);
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



let garzmok = new Adventurer();
let partyOne = new PlayerGroup();
let quake = new ForceOfNature();

partyOne.addPC(garzmok);

let fightOne = new Battlefield(partyOne);

fightOne.startCombat();

quake.getExternalData();


//Test API functionality













}); //End jQuery











//
