/* To do
Convert to jQuery

Implement stairs + swapping floors
room 'inventiory'/events

roaming 'enemies' + collision detection

Line of sight? Just cardinal directions?

save/load seems feasible, given setItem and getItem using local storage
simple map data, and character data seem prudent to save
*/

//Global classes - accessible by ALL, cannot access anything else due to scope.
//No messing with jQuery, and no passing things directly through these to the other script!

//Bunding everything through a single class for now. Should never touch the variables within other classes - rely only on their methods to do things to avoid errors.
class mapBattleCommunicator {
  constructor() {
    //The list of player characters for combat
    this.linkedAdventurerList = [];
    //The battlefield the PCs and foes exist in
    this.linkedBattlefield;
    this.linked
  }

  //Add a PC to the list
  commAddTolinkedAdventurerList(adventurerIn) {
    this.linkedAdventurerList.push(adventurerIn);
    console.log(this.linkedAdventurerList);
  };

  //Add the battlefield
  commLinkToBattlefield(battlefieldIn) {
    this.linkedBattlefield = battlefieldIn;
  }

  //Recovers the wounds of a single adventurer. If the amount is = -1, it fully heals them.
  commRemoveWoundsSingleTarget(targetAdventurerIndex = 0, woundRecoveryAmount = 0) {
    let adventurerToHeal = this.linkedAdventurerList[targetAdventurerIndex];
    if(woundRecoveryAmount !== -1) {
      adventurerToHeal.restoreWounds(woundRecoveryAmount,0)
    } else {
      adventurerToHeal.restoreWounds(0,1);
    }
    this.linkedBattlefield.updateHealthValues();
    //This is bad. Link directly to the player group.
    this.linkedBattlefield.attachedPlayerGroup.updateMapHealthBlocks();
  };

  //Loops over the entire list of linked adventurers, recovering that many wounds for each. Once again, a value of -1 recovers all wounds.
  commRemoveWoundsAllTargets(woundRecoveryAmount = 0) {
    console.log("Healing everyone!");
    for (let i = 0; i < this.linkedAdventurerList.length; i++) {
      this.commRemoveWoundsSingleTarget(i,woundRecoveryAmount);
    }
  };


} //End mapBattleCommunicator class


//Define this here? I need both scripts to be able to see it.
const mbComms = new mapBattleCommunicator();


$(()=>{ //Start jQuery

  //////Button listeners
  //These show and hide the help modal.
  $("#helpButton").on("click", showHelp );
  $("#closeHelpButton").on("click", hideHelp);


  //Map Arrays - add more as needed. To navigate: array[row][col]
  //Values: 0-wall, 1-hidden, 2-explorable, 3-explore
  //Strings: RoomValue_ObjectKey1_ObjectValue1_ObjectKey2...
  //sU/sD - Stairs up/down. Values are the row and column of where to end up on the floor the stairs lead to.
  //t - return to town. This should (eventually) bring up the town modal/menu

  let mapPrototype5 = [
    [1,1,1,1,1,1,0,0,1,0],
    [0,0,1,0,1,0,1,1,1,0],
    [0,1,1,1,1,1,1,0,1,1],
    [0,1,1,0,1,0,1,1,0,1],
    [0,1,0,1,1,0,0,1,0,1],
    [1,1,1,1,1,1,0,0,1,1],
    [0,0,1,0,0,0,0,0,1,0],
    [0,1,1,1,1,1,1,0,1,1],
    [1,1,1,1,0,0,1,1,0,1],
    [0,1,1,1,1,1,1,1,1,1]
  ];

  let floorOne = [
    ["1_t_0",1,1,1,1],
    [0,0,1,0,1],
    [0,0,1,1,1],
    ["1_sU_4.1",1,0,0,1],
    [1,1,1,1,1]
  ];
  //Town 0.0
  //Up: 3.0

  let floorTwo = [
    [1,"1_sU_1.2",0,1,1,1],
    [1,0,0,0,1,1],
    [1,1,1,1,1,1],
    [0,1,1,0,1,0],
    [0,"1_sD_3.0",0,"1_sU_7.0",1,0]
  ];
  //Down 4.1
  //Up1 0.1
  //Up2 4.3

  let floorThree = [
    [1,1,1,1,1,1,0,0,0,0],
    [1,0,"1_sD_0.1",0,0,1,0,1,1,1],
    [1,0,0,0,1,1,0,0,0,1],
    [1,0,1,0,1,0,1,1,0,1],
    [1,1,1,1,1,0,1,1,1,1],
    [0,0,0,0,0,0,0,1,0,0],
    [0,0,1,1,1,1,0,1,1,1],
    ["1_sD_4.3",1,1,1,0,1,0,0,1,0],
    [0,0,1,1,0,1,1,1,1,1],
    [0,0,0,1,1,1,0,0,0,0]
  ];
  //Down1 1.2
  //Down2 7.0




  //////CLASSES

  //Data and methods for a single floor
  //These hold the malleable floor data, and are acted upon by groups.
  class FloorData {

    //List of premadeFloors
    static floorLayouts() {
      return [floorOne, floorTwo, floorThree];
    };


    constructor (nameIn, mapDataIn) {
      this.name = nameIn;
      this.level;

      //this.mapData -> [roominfo, upper, right, bottom, left, contents(object)]
      //roomInfo -> 0/notARoom 1/hidden 2/explorable 3/explored 4/current
      //If this is expanded, check other functions so they don't break!
      this.generateMap(mapDataIn);
    };


    //called once on construction, although it could probably be janked to work mid-game to change a map. MUST BE RUN for the map to work
    generateMap (mapDataIn) {
      let mapHeight = mapDataIn.length;
      let mapWidth = mapDataIn[0].length;

      //Generate new array, and populate it with room info
      this.mapData = new Array(mapHeight);
      for(let i = 0; i < mapHeight; i ++) {
        this.mapData[i] = new Array(mapWidth);
      }
      for(let i = 0; i < mapHeight; i ++) {
        for(let j = 0; j < mapWidth; j ++) {
          let roomContents = new Object;

          if(Number.isInteger(mapDataIn[i][j])) { //no contents
            this.mapData[i][j] = [mapDataIn[i][j],-1,-1,-1,-1,roomContents];
          } else { //Contents exist. Parse them, and add keys to the object
            let roomData = mapDataIn[i][j];
            let roomDataArray = roomData.split("_");
            this.mapData[i][j] = [parseInt(roomDataArray.shift()),-1,-1,-1,-1,roomContents];
            while(roomDataArray.length > 0) {
              roomContents[`${roomDataArray.shift()}`] = roomDataArray.shift();
            }
          }
          //Every room gets an id. Might be useful?
          roomContents.roomId = (i*mapWidth+j);
          //console.log(roomContents);

        }
      }

      //Set boundary info based on adjacent rooms
      for(let i = 0; i < mapHeight; i ++) {
        for(let j = 0; j < mapWidth; j ++) {
          //Upper condition
          if(i===0) {
            this.mapData[i][j][1] = 0;
          } else {
            if( this.mapData[i-1][j][0] === 0) {
              this.mapData[i][j][1] = 0;
            } else {
              this.mapData[i][j][1] = 1;
            }
          }
          //Right
          if(j===mapWidth-1) {
            this.mapData[i][j][2] = 0;
          } else {
            if( this.mapData[i][j+1][0] === 0) {
              this.mapData[i][j][2] = 0;
            } else {
              this.mapData[i][j][2] = 1;
            }
          }
          //Bottom
          if(i===mapHeight-1) {
            this.mapData[i][j][3] = 0;
          } else {
            if( this.mapData[i+1][j][0] === 0) {
              this.mapData[i][j][3] = 0;
            } else {
              this.mapData[i][j][3] = 1;
            }
          }
          //Left
          if(j===0) {
            this.mapData[i][j][4] = 0;
          } else {
            if( this.mapData[i][j-1][0] === 0) {
              this.mapData[i][j][4] = 0;
            } else {
              this.mapData[i][j][4] = 1;
            }
          }
        }
      }
    };


    //These two functions are useful for bugfixing, but can be trashed eventually.
    //Prints the map to the console, along with wall and object info. Quite verbose.
    showFullMap () {
      console.log(`Full map for ${this.name}:`);
      console.log(this.mapData);
    };


    //Prints the map to the console; only shows the rooms (not wall conditions/objects)
    showMap () {
      console.log(`Map for ${this.name}:`);
      let simpleMap = new Array(this.mapData.length);
      for(let i = 0; i < this.mapData.length; i ++) {
        simpleMap[i] = new Array(this.mapData[0].length).fill(0);
      }
      for(let i = 0; i < this.mapData.length; i ++) {
        for(let j = 0; j < this.mapData[0].length; j ++) {
          simpleMap[i][j] = this.mapData[i][j][0];
        }
      }
      console.log(simpleMap);
    };

  }; //End of FloorData class


  //A marker for the location of the group/party. No stats; just movement and display related functionality here.
  class GroupLocation {

    constructor(towerIn, startLocationRow, startLocationCol) {
      this.currentTower = towerIn;
      this.currentFloor = towerIn.floorList[0];
      this.currentFloorLevel  = 0;
      this.rowLocation = startLocationRow;
      this.colLocation = startLocationCol;
      //this.currentFloor.showMap();
      this.currentFloor.mapData[this.rowLocation][this.colLocation][0] = 4;
      this.directionOptions = this.checkMovementOptions();

      this.currentDirections = [];
      this.movingBool = false;
      displayMap(this.currentFloor.mapData);
      //Used to determine if a battle is going to occur
      this.encounterChance = 0;
    }


    //Returns length 4 array of booleans for possible movement based on the group's current location. [up, right, down, left]. This needs to be run after each movement, as it shows new rooms!
    checkMovementOptions() {
      //direction array is effectivly wall information - can you move in the cardinal directions
      let directionArray = this.currentFloor.mapData[this.rowLocation][this.colLocation].slice();
      //The output - this is a much simplified version of the wall info. Used by other functions.
      let outputArray = [0,0,0,0]
      //wow this is bad - making a function for this would be good
      //Checks if you can move in that direction(up, in this case)
      if(directionArray[1] === 1) { //Up
        outputArray[0] = 1;
        //These blocks are used to change 'hidden' rooms into 'explorable ones' without messing with the revealed ones.
        if(this.currentFloor.mapData[this.rowLocation-1][this.colLocation][0] === 1) {
          this.currentFloor.mapData[this.rowLocation-1][this.colLocation][0] = 2;
        }
      }
      if(directionArray[2]===1) { //Right
        outputArray[1] = 1;
        if(this.currentFloor.mapData[this.rowLocation][this.colLocation+1][0] === 1) {
          this.currentFloor.mapData[this.rowLocation][this.colLocation+1][0] = 2;
        }
      }
      if(directionArray[3]===1) { //Down
        outputArray[2] = 1;
        if(this.currentFloor.mapData[this.rowLocation+1][this.colLocation][0] === 1) {
          this.currentFloor.mapData[this.rowLocation+1][this.colLocation][0] = 2;
        }
      }
      if(directionArray[4]===1) { //Left
        outputArray[3] = 1;
        if(this.currentFloor.mapData[this.rowLocation][this.colLocation-1][0] === 1) {
          this.currentFloor.mapData[this.rowLocation][this.colLocation-1][0] = 2;
        }
      }
      return outputArray;
    };

    //Use the changePosition function to move in the specified direction by 1 room. Relys on the directionOptions to be updated with it's current position!
    changePosition(direction) { //0,1,2,3 = up/right/down/left
      //If (selected direction is allowed)
      if(this.directionOptions[direction] === 1) {
        //The previous room is now explored, as opposed to occupied by the party.
        this.currentFloor.mapData[this.rowLocation][this.colLocation][0] = 3;
        switch (direction) {
          case 0: { //Up
            this.rowLocation--;
            //console.log("Moved up!");
            break;
          }
          case 1: { //Right
            this.colLocation++;
            //console.log("Moved right!");
            break;
          }
          case 2: { //Down
            this.rowLocation++;
            //console.log("Moved down!");
            break;
          }
          case 3: { //left
            this.colLocation--;
            //console.log("Moved left!");
            break;
          }
        }
        //The new room is occupied by the party.
        this.currentFloor.mapData[this.rowLocation][this.colLocation][0] = 4;
      } else {
        console.log("Can't go that way");
      }
      //Update these to check for where the group can move next!
      this.directionOptions = this.checkMovementOptions();
      //clearMap();
      displayMap(this.currentFloor.mapData);

      //run room-based events here!
    };

    //This takes in a set of coordinates (often by clicking on a location), generates the fastest(?) available path there from the group's current location, then loops changePosition() through that path.
    moveToLocation(rowIn, colIn) {
      //If moving, don't change course
      if(this.currentDirections.length > 0) {
        console.log("Wait until we have finished moving!");
        return;
      }
      //No movement necissary - check the room you are in
      let currentLocationOnMap = this.currentFloor.mapData[rowIn][colIn];
      if((rowIn === this.rowLocation) && (colIn === this.colLocation)) {
        console.log("Searching the room we are in...");
        this.searchLocation(currentLocationOnMap);
        return;
      }
      //This generates the path (if one exists)
      let pathToTake = generatePath(this.currentFloor.mapData, this.rowLocation, this.colLocation, rowIn, colIn);

      if(pathToTake === undefined) { //no path found
        console.log("You cannot go there!");
      } else { //A path was found
        //It's a string, turn it into an array
        this.currentDirections = pathToTake.split("");
        //takeStep() is recursive - calling it once here is sufficient
        this.takeStep();
      }
    };


    //Used to control the rate of movement, instead of appearing to teleport there - I DID IT
    takeStep() {
      //causes the group to move
      this.changePosition(parseInt(this.currentDirections.shift()));
      //checks if the movement is complete - can probably put the 'goToCombat' trigger here to interrupt movement consistently
      if(Math.random()*100 < this.encounterChance) {
        this.currentDirections.length = 0;
        this.encounterChance = 0 - Math.trunc(10 - (this.encounterChance)/10);
        console.log("BATTLETIME");
        $("#combatOverlay").show();
      } else {
        this.encounterChance += 2;
      }
      console.log(this.encounterChance);
      if(this.currentDirections.length > 0) {
        //using 'this' in a setTimeout refers to the window of setTimeout... I think. The following allows the method to refer to the instantiation of the class, instead
        let theGroup = this;
        setTimeout(function(){
          theGroup.takeStep(); }, 100); //In ms, the delay between moves
        }
      };


      //Used to check the current room the group is in, and possibly do something if there is something in the room. If there is something in the room, trigger an interaction here!
      searchLocation(currentLocationOnMap) {
        //Stairs going up
        if(currentLocationOnMap[5].sU !== undefined) {
          console.log("...found some stairs! They go up!");
          let newLocation = currentLocationOnMap[5].sU.split(".");
          this.changeFloors(1,Number.parseInt(newLocation[0]),Number.parseInt(newLocation[1]));
        }
        //Stairs going down
        if(currentLocationOnMap[5].sD !== undefined) {
          console.log("...found some stairs! They go down!");
          let newLocation = currentLocationOnMap[5].sD.split(".");
          this.changeFloors(-1,Number.parseInt(newLocation[0]),Number.parseInt(newLocation[1]));
        }
        //Path back to town
        if(currentLocationOnMap[5].t !== undefined) {
          mbComms.commRemoveWoundsAllTargets(-1);
          console.log("Heading back to town.");
          this.encounterChance = 0;
        }
      };


      //Move up or down a floor.
      changeFloors(directionIn, destinationRow, destinationCol) {
        //Change the current room to explored
        this.currentFloor.mapData[this.rowLocation][this.colLocation][0] = 3;

        //Change critical variables for the group
        console.log(`Changing floor by ${directionIn}`);
        this.currentFloor = this.currentTower.floorList[this.currentFloorLevel+directionIn];
        this.currentFloorLevel  += directionIn;
        this.rowLocation = destinationRow;
        this.colLocation = destinationCol;

        //We are now at the other end of the stairs in the new floor
        this.currentFloor.mapData[this.rowLocation][this.colLocation][0] = 4;
        //We moved, so we run this
        this.directionOptions = this.checkMovementOptions();
        displayMap(this.currentFloor.mapData);
      };

    } //End GroupLocation


    //Stores + creates floors. Allows groups to traverse between floors easily.
    class TowerOfFloors {
      constructor (nameIn) {
        this.name = nameIn;
        this.floorList = [];
      };

      //Add in a floor. Added to the end of the list
      assembleNewFloor (mapDataIn) {
        const newFloor = new FloorData(this.name + ", level " + (this.floorList.length+1), mapDataIn);
        newFloor.level = (this.floorList.length+1);
        this.floorList.push(newFloor);
      };

      //Lists the floors.
      listFloors () {
        for(let i = 0; i < this.floorList.length; i++) {
          console.log(this.floorList[i].name);
        }
      };

      //Lists the floors, and prints a simple map for each to the console.
      listFloorsWithMap () {
        for(let i = 0; i < this.floorList.length; i++) {
          this.floorList[i].showMap();
        }
      }

    } //End TowerOfFloors class














    //////html DOM manipulation functions

    //Takes 'complex' map data from a floor (the one that includes wall info), and generates a grid of buttons to the html. The colors/uses of the buttons depends on the room status.
    function displayMap(arrayIn) {
      //Empty the existing map first
      clearMap();
      //'mapZone' is the grid the buttons are fit into.
      let $map = $("#mapZone");

      for(let i = 0; i < arrayIn.length; i++) {
        for(let j = 0; j < arrayIn[i].length; j++) {
          //Generate button ids - "buttonR-C". The dash avoids two buttons having the same name in a few cases where row+column concatenation results in identical outcomes.
          let $newSquare = $("<Button>");
          $newSquare.attr("id",`button${i}-${j}`)
          $newSquare.attr("class", "roomButton")
          if(arrayIn[i][j][0] >= 1) {

            //The following statements add classes/symbols to the rooms - order is VERY important based on what should be rendered. Test various outcomes if something new is added!
            if(arrayIn[i][j][0] === 1) { //The room is black
              $newSquare.addClass("hidden");
            }
            if(Object.keys(arrayIn[i][j][5]).length > 1) { //The room has something in it
              let roomSymbol = "";
              if(arrayIn[i][j][5].sD !== undefined) { //Stairs down
                roomSymbol += "S&#8595";
              }
              if(arrayIn[i][j][5].sU !== undefined) { //Stairs up
                roomSymbol += "S&#8593";
              }
              if(arrayIn[i][j][5].t !== undefined) { //Path to town
                roomSymbol += "T";
              }
              $newSquare.html(roomSymbol); //Add the symbol to the room
            }
            if(arrayIn[i][j][0] === 2) { //The room is grey, and reachable
              $newSquare.addClass("explorable");
              $newSquare.text("?");
            }
            if(arrayIn[i][j][0] === 3) { //Room is white, and reachable
              $newSquare.addClass("explored");
            }
            if(arrayIn[i][j][0] === 4) { //Red - indicates current location
              $newSquare.addClass("currentLoc");
            }
            if(arrayIn[i][j][1] === 1) { //Changes borders
              $newSquare.addClass("topDoor");
            }
            if(arrayIn[i][j][2] === 1) {
              $newSquare.addClass("rightDoor");
            }
            if(arrayIn[i][j][3] === 1) {
              $newSquare.addClass("bottomDoor");
            }
            if(arrayIn[i][j][4] === 1) {
              $newSquare.addClass("leftDoor");
            }
          }
          $map.append($newSquare);
          //Calls the moveToLocation method for the group to move to this room - change this if the buttons wind up doing something else!
          $(`#button${i}-${j}`).on("click", function () {
            theParty.moveToLocation(i,j);
          });
        }
      }//end loops

      //Change these to rescale maps if it gets too big - remember to consider the effects of the borders (currently 4 px)!
      let roomSize = 40;

      $map.css("height", `${4+(arrayIn.length)*roomSize}px`);
      $map.css("width",`${4+(arrayIn[0].length)*roomSize}px`);

      let $rooms = $(".roomButton")
      $rooms.css("width", `${roomSize}px`);
      $rooms.css("height", `${roomSize}px`);

    };

    //This is bad to use for each refresh, but will work given the small size
    function clearMap() {
      while($("#mapZone").children().length > 0) {
        $("#mapZone").empty();
      }
    };

    //Help button functions
    function showHelp() {
      let $helpBoxElements = $(".helpBox");
      $helpBoxElements.css("display", "block");
    };

    function hideHelp() {
      let $helpBoxElements = $(".helpBox");
      $helpBoxElements.css("display", "none");
    };













    //////GLOBAL FUNCTIONS

    //Starts the search for the fastest path from initial to final
    //Returns a string if it finds a path, and [-1] if it does not.
    //Uses complex map data from a floor. Does not require the involvement of groupPosition.
    function generatePath(originalArrayIn, initialRow, initialCol, finalRow, finalCol) {
      //mapData needs to be shared - using the same array in each object will work nicely! (never expected this aspect of js arrays to be so useful)
      //mapData - array
      //storedPaths - array of[searchLocation - object {path-string, row - int, col - int} ]

      //Generate new array, populate with room info
      let mapHeight = originalArrayIn.length;
      let mapWidth = originalArrayIn[0].length;
      let searchArray = new Array(mapHeight);
      for(let i = 0; i < mapHeight; i ++) {
        searchArray[i] = new Array(mapWidth);
        for(let j = 0; j <mapWidth; j++) {
          searchArray[i][j] = new Array(5);
        }
      }
      for(let i = 0; i < mapHeight; i ++) {
        for(let j = 0; j < mapWidth; j ++) {
          for(let k = 0; k < 5; k++) { //Only check for wall info
            searchArray[i][j][k] = originalArrayIn[i][j][k];
          }
        }
      }
      //An array of objects that stores:
      //row/col: the square the next checkNextStep will search from
      //path: how to get to that square
      let storedPaths = [];

      let searchLocation = {
        path: "",
        row: initialRow,
        col: initialCol
      }

      storedPaths.push(searchLocation);

      //Calls the actual recursive function
      return(checkNextStep(searchArray, storedPaths, finalRow, finalCol).path);

    };

    //Recursivly checks adjacent squares to see if they are the destination. Breadth-first search to look at closer squares first.
    function checkNextStep(mapData, storedPaths, finalRow, finalCol) {

      //mapData - array
      //storedPaths - array of[searchLocation - object {path-string, row - int, col - int} ]

      //get (and remove) the first element of storedPaths
      let searchThis = storedPaths.shift();
      let checkRow = searchThis.row;
      let checkCol = searchThis.col;

      //Check each adjacent location
      //mark on the array that location has been reached (set to 1!)
      //check each location to see if it is the destination
      //tack new possiblePath objects onto the END of storedPaths
      let tempPathHolder;
      let finalPath;
      if(mapData[checkRow][checkCol][1] === 1) { //up
        tempPathHolder = generatePossiblePath(searchThis.path, checkRow, checkCol, "0",-1,0);
        if (tempPathHolder.row === finalRow && tempPathHolder.col === finalCol) {
          finalPath = tempPathHolder; //done! use in later if statement
        }
        if (mapData[tempPathHolder.row][tempPathHolder.col][0] === 3) { //can see/move to the location
          storedPaths.push(tempPathHolder);
          mapData[tempPathHolder.row][tempPathHolder.col][0] = 1;
        }
      }

      if(mapData[checkRow][checkCol][2] === 1) { //right
        tempPathHolder = generatePossiblePath(searchThis.path, checkRow, checkCol, "1",0,1);
        if (tempPathHolder.row === finalRow && tempPathHolder.col === finalCol) {
          finalPath = tempPathHolder; //done! use in later if statement
        }
        if (mapData[tempPathHolder.row][tempPathHolder.col][0] === 3) { //can see/move to the location
          storedPaths.push(tempPathHolder);
          mapData[tempPathHolder.row][tempPathHolder.col][0] = 1;
        }
      }

      if(mapData[checkRow][checkCol][3] === 1) { //down
        tempPathHolder = generatePossiblePath(searchThis.path, checkRow, checkCol, "2",1,0);
        if (tempPathHolder.row === finalRow && tempPathHolder.col === finalCol) {
          finalPath = tempPathHolder; //done! use in later if statement
        }
        if (mapData[tempPathHolder.row][tempPathHolder.col][0] === 3) { //can see/move to the location
          storedPaths.push(tempPathHolder);
          mapData[tempPathHolder.row][tempPathHolder.col][0] = 1;
        }
      }

      if(mapData[checkRow][checkCol][4] === 1) { //left
        tempPathHolder = generatePossiblePath(searchThis.path, checkRow, checkCol, "3",0,-1);
        if (tempPathHolder.row === finalRow && tempPathHolder.col === finalCol) {
          finalPath = tempPathHolder; //done! use in later if statement
        }
        if (mapData[tempPathHolder.row][tempPathHolder.col][0] === 3) { //can see/move to the location
          storedPaths.push(tempPathHolder);
          mapData[tempPathHolder.row][tempPathHolder.col][0] = 1;
        }
      }

      if(finalPath != undefined) { //Found a vaild path - send it up!
        return finalPath;
      } else {
        if(storedPaths.length > 0) { //not the destination, try the next one.
          finalPath = checkNextStep(mapData, storedPaths, finalRow, finalCol);
        } else {//Everything is a dead end, no path exists
          return([-1]);
        }
      }

      return finalPath; //A safety measure?
    };


    //Makes a new object to search another square. Used by checkNextStep().
    function generatePossiblePath(pathIn, currentRow, currentCol, pathAddition,rowShift, colShift) {

      let searchLocation = {
        path: pathIn+pathAddition,
        row: currentRow+rowShift,
        col: currentCol+colShift
      }

      return(searchLocation);
    };


    //Run these initially.



    const theSpire = new TowerOfFloors("The Spire");
    theSpire.assembleNewFloor(FloorData.floorLayouts()[0]);
    theSpire.assembleNewFloor(FloorData.floorLayouts()[1]);
    theSpire.assembleNewFloor(FloorData.floorLayouts()[2]);

    theSpire.listFloors();

    const theParty = new GroupLocation(theSpire,0,0);

  }); //End jQuery
