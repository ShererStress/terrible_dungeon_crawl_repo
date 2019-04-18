# ShererStress.github.io

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

For 'battle.js', the goal was to make a turn based combat mini-game, with more than a single combatant on each side. 
