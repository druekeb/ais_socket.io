/**
 * Dependencies
 */

var path = require('path');
var fs = require('fs');
var sio = require('socket.io');
var connect = require('connect');
var child = require('child_process');
var redis = require('redis');

/**
 * Logging
 */

function writeToLog(message) {
  var message = '['+new Date().toUTCString()+'] ' + message;
  fs.appendFile(__dirname + '/log/server.log', message + '\n', function(err) {});
  console.log(message);
}

/**
 * HTTP server
 */
 
var httpLogFile = fs.createWriteStream(__dirname + '/log/http_server.log', {flags: 'a'});
var httpPort = 8090;
var app = connect()
  .use(connect.logger({stream: httpLogFile}))
  .use(connect.static('public'));
var httpServer = app.listen(httpPort);
writeToLog('HTTP Server listening on http://localhost:' + httpPort + '/');

/**
 * AIS client
 */

var aisClient;
// Try to fork the AIS client (create a new child process for it)
try {
  aisClient = child.fork(path.join(__dirname, 'ais_client.js'));
}
catch (err) {
  writeToLog('Error forking AIS client process: ' + err);
  process.exit(1);
}

/**
 * Socket.IO server
 */

var io = sio.listen(httpServer);

// Set logging level to "info"
io.set('log level', 2);

// When a client connects to our websocket
io.sockets.on('connection', function(client) {
  // On register, set bounds for client
  client.on('register', function(bounds) {
    client.set('bounds', bounds, function() {
      // TODO: Send vessels to client (use getVesselsInBounds() function at bottom)
      // Example: client.emit('vesselsInitEvent', getVesselsInBounds(bounds));
    });
  });
  // On unregister, delete bounds for client
  client.on('unregister', function() {
    client.del('bounds');
  });
});

aisClient.on('message', function(message) {
  // If we have a vesselPosEvent message
  if (message.eventType == 'vesselPosEvent') {
    // Emit this event to all clients in this area
    var clients = io.sockets.clients();
    var clientsLength = clients.length;
    for (var i = 0; i < clientsLength; i++) {
      // Try to get bounds for client
      clients[i].get('bounds', function(err, bounds) {
        if (bounds != null) {
          var lon = message.data.lon;
          var lat = message.data.lat;
          // Check if position is in bounds of client
          if (typeof lon != 'undefined' && typeof lat != 'undefined' && positionInBounds(lon, lat, bounds)) {
            client.emit('vesselPosEvent', JSON.stringify(message.data));
          }
        }
      });
    }
  }
});

// Check if a position is in bounds
function positionInBounds(lon, lat, bounds) {
  return (lon > bounds.left && lon < bounds.right && lat > bounds.bottom && lat < bounds.top);
}

var redisClient = redis.createClient();

// Get all current vessels in bounds
function getVesselsInBounds(bounds) {
  // TODO
  // Wir müssten uns an dieser Stelle entscheiden, ob wir die Daten zu den aktuellen
  // Schiffen vom aisClient abfragen (und dieser muss dann auch die Berechnung ausführen)
  // oder ob wir hier in diesem Prozess auch eine Redis Verbindung herstellen und die Daten
  // selbst abfragen.
}