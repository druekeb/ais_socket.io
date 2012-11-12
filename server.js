/**
 * Dependencies
 */

var path = require('path');
var fs = require('fs');
var sio = require('socket.io');
var connect = require('connect');
var child = require('child_process');
var mongo = require('mongodb');
//               Zoom 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,15,16,17,18
var zoomSpeedArray = [20,20,20,20,20,20,16,12,8,4,2,1,0,-1,-1,-1,-1,-1,-1];
/**
 * Servers & Clients
 */

var aisClient; // AIS Client child process
var httpServer; // HTTP Server
var io; // Socket.IO Server

/**
 * Logging
 */

function log(message) {
  var message = '['+new Date().toUTCString()+'] ' + message;
  fs.appendFile(__dirname + '/log/server.log', message + '\n', function(err) {});
  console.log(message);
}

/**
 * Database (mongoDB)
 */

var mongoHost = 'localhost';
var mongoPort = 27017;
var mongoServer = new mongo.Server(mongoHost, mongoPort, {auto_reconnect: true});
var mongoDB = new mongo.Db('ais', mongoServer, {safe: true});

var vessels;

mongoDB.open(function(err, db) {
  if (!err) {
    db.collection('vessels', function(err, collection) {
      if (!err) {
        vessels = collection;
        log('(Server) Connection to mongoDB established');
        startHTTPServer();
        startSocketIO();
        startAISClient();
      }
    });
  }
});

/**
 * HTTP server
 */

function startHTTPServer() {
  var httpLogFile = fs.createWriteStream(__dirname + '/log/http_server.log', {flags: 'a'});
  var httpPort = 8090;
  var app = connect()
    .use(connect.logger({stream: httpLogFile}))
    .use(connect.static('public'));
  httpServer = app.listen(httpPort);
  log('(Server) HTTP Server started');
}

/**
 * AIS client
 */

function startAISClient() {
  // Try to fork the AIS client (create a new child process for it)
  try {
    aisClient = child.fork(path.join(__dirname, 'ais_client.js'));
  }
  catch (err) {
    writeToLog('(Server) Error forking AIS client process: ' + err);
    process.exit(1);
  }

  aisClient.on('message', function(message) {
    if (message.eventType == 'vesselPosEvent') {
      var clients = io.sockets.clients();
      var lon = message.lon;
      var lat = message.lat;
      var sog = message.sog;
      clients.forEach(function(client) {
        client.get('bounds', function(err, bounds) {
          if (bounds != null && lon != null && lat != null) 
          {
            if (positionInBounds(lon, lat, bounds)) 
            {
              client.get('zoom', function(err, zoom) 
              {
                if(sog !=null && sog> (zoomSpeedArray[zoom]))
                {
                  client.emit('vesselPosEvent', message.data);
                }
              });
            }
          }
        });
      });
    }
  });
  log('(Server) AIS client started');
}

/**
 * Socket.IO
 */

function startSocketIO() {
  io = sio.listen(httpServer);

  // Configure Socket.IO for production (NODE_ENV=production node server.js)
  io.configure('production', function() {
    io.enable('browser client minification');
    io.enable('browser client etag');
    io.enable('browser client gzip');
    io.set('log level', 1);
    io.set('transports', [
        'websocket'
      , 'flashsocket'
      , 'htmlfile'
      , 'xhr-polling'
      , 'jsonp-polling'
    ]);
  });

  // Configure Socket.IO for development (node server.js)
  io.configure('development', function() {
    io.set('log level', 2);
    io.set('transports', ['websocket']);
  });

  io.sockets.on('connection', function(client) {
    client.emit('zoomSpeedEvent', JSON.stringify(zoomSpeedArray));
    client.on('register', function(bounds, zoom) {
      client.set('zoom', zoom);
      client.set('bounds', bounds, function() {
      getVesselsInBounds(client, bounds, zoom);
      });
    });
    client.on('unregister', function() {
      client.del('bounds');
    });
  });


  log('(Server) Socket.IO started');
}

function getVesselsInBounds(client, bounds, zoom) {
  var cursor = vessels.find({ pos: { $within: { $box: [ [bounds.left,bounds.bottom], [bounds.right,bounds.top] ] } },
                              sog:{$exists:true}, sog: {$gt: zoomSpeedArray[zoom]}, time_received: {$gt: (new Date() - 10 * 60 * 1000)}});
  cursor.toArray(function(err, vessels) {
    if (!err) {
      var boundsString = '['+bounds.left+','+bounds.bottom+']['+bounds.right+','+bounds.top+']';
      console.log('(Debug) Found ' + vessels.length + ' vessels in bounds ' + boundsString +" with sog > "+zoomSpeedArray[zoom]);
      client.emit('vesselsInBoundsEvent', JSON.stringify(vessels));
    }
  });
}

function positionInBounds(lon, lat, bounds) {
  return (lon > bounds.left && lon < bounds.right && lat > bounds.bottom && lat < bounds.top);
}