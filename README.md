stat-blockssimilar# ShererStress.github.io

'A Terrible Dungeon Crawl' contains the following files:
  -tdc.js
  -battle.js
  -index.html
  -style.css

It makes use of standard js, html, and css functionality, in addition to:
  -jQuery (https://code.jquery.com/jquery-3.4.0.min.js)
  -google fonts (https://fonts.googleapis.com/css?family=Press+Start+2P)
  -svg (http://www.w3.org/2000/svg)
  -USGS data supplied via API (https://earthquake.usgs.gov/fdsnws/event/1/)

It can be accessed with the following link (for the time being):
  -https://shererstress.github.io/

For 'installation', copy index.html, and the 'terrible_dungeon_crawl' directory, arrange them in the same manner as they are here, and open 'index.html' in google chrome (I can't guarantee it will work in the slightest in any other browser)


For 'tdc.js', the primary focus was to build a floor (eventually a set of them), that could be traversed by a player as easily as possible. Taking the 'simple' map data (an array of 0s and 1s) and generating a more complex (but more useful) array that included 'wall information' was useful in this regard. The 'complex' array would then used to dynamically generate a grid of buttons that represented the array.
Using a separate class the store the information and methods the player would use seemed ideal for keeping things sorted. The movement functions, initially hard coded commands for up, right, etc., were converted into functions that were called by the grid. To cover distances greater than 1, a pair of recursive functions were made to plot and move along (one of) the shortest paths to the destination.

For 'battle.js', the goal was to make a turn based combat mini-game, with more than a single combatant on each side. This eventually expanded into a system that incorporated two initiative systems, a focus on 'threat' management rather than who to attack directly, random encounters, and a leveling system.
A group of adventurers are controlled by the player, and groups of enemies (who share the same base class as the adventurers) are quasi-randomly generated to fight the adventurers. All of the combatants are connected to the battlefield class, which directs the flow of combat.
Combat is a series of 'rounds', one after the other, until one side is defeated. It is not a while loop, but a series of functions that call each other as the round continues. First, each combatant decides on an action to take (the order of which is dictated by their perception scores - higher chooses later!). Those actions are then carried out in initiative order (highest first, this time). Once all actions are take, a new round begins.
Instead of doing direct damage to a selected target, everything deals damage to something (selected quasi-randomly) based on what it threatens. The player does not get to choose what to damage, but instead what to threaten.
The API is used in a different action 'conjure earthquake'- this grabs all of the geological events the USGS detected in the past day, picks one, and displays the magnitude of the event (similar to the Richter scale) on the DOM. That value is then converted to a damage amount for all foes to take.
At the end of a fight, the adventurers may gain some stat increases.


Unsolved Problems:
The responsiveness is still pretty bad. The game was designed for a desktop/laptop sized browser window, and took full advantage of the space available. Trying to compress it onto a mobile screen resulted in small text sizes, add positioning, and a need for horizontal scrolling and zooming. That said, I would rather put effort into making the game itself better with support for a single device than making a worse game responsive. (personal opinion, but that's no surprise given how much worse my css is compared to my js)

There are a handful of improvements to the game to make it more user-friendly (a tutorial, some status text on the map screen, more info on what the stats do in game).

On the code-side of things, I could use more comments in a lot of areas (CSS especially). Some of the word choice is inconsistent (Player character vs adventurer, enemy vs foe). Improving the stat-blocks in the combat overlay also would have been nice.

The biggest issue would be how some of the one-off class interactions work. A lot of these would need to be redone if the functionality was to be expanded. Ultimately, I'm not sure on the best way to have to classes communicate in js. Are getters/setters ideal? Is directly changing the parameters of another class acceptable? Everything here works (and many of the features are scalable - if it wasn't for the size of the window I could add more adventurers/foes to each side). How does one get around the scope issues that the jQuery onLoad function causes? 
