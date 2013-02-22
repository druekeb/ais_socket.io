/**
 * Dependencies
 */

var path = require('path');
var fs = require('fs');
var sio = require('socket.io');
var connect = require('connect');
var http = require('http');
var mongo = require('mongodb');
var redis = require('redis');

// Zoom 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,15,16,17,18
//    var zoomSpeedArray = [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];
var zoomSpeedArray = [20,20,20,20,20,20,16,12,8,4,2,1,0.1,-1,-1,-1,-1,-1,-1];

/**
 * Logging
 */

function log(message) {
  var message = '['+new Date().toUTCString()+'] ' + '[Worker '+process.pid+'] ' + message;
  fs.appendFile(__dirname + '/log/worker.log', message + '\n', function(err) {});
  console.log(message);
}

function logPosEvent(message) {
  var message = message +" "+new Date().getTime();
  fs.appendFile(__dirname + '/log/PosEvent.log', message + '\n', function(err) {
    if (err != null) console.log("couldn't write PosEvent :"+message+", Error: "+err);
  });
}

function logBoundsEvent(message) {
  var message =  message +" "+new Date().getTime();
  fs.appendFile(__dirname + '/log/BoundsEvent.log', message + '\n', function(err) {
    if (err != null) console.log("couldn't write BoundsEvent :"+message+", Error: "+err);
  });
}

/**
 * HTTP server
 */

function startHTTPServer(callback) {
  var httpLogFile = fs.createWriteStream(__dirname + '/log/http_server.log', {flags: 'a'});
  var app = connect()
    .use(connect.logger({stream: httpLogFile}))
    .use(connect.static('client'));
  httpServer = http.createServer(app).listen(8090);
  log('HTTP Server started');
  callback();
}

/**
 * Socket.IO
 */

function startSocketIO(callback) {
  io = sio.listen(httpServer);

  // Configure Socket.IO for production (NODE_ENV=production)
  io.configure('production', function() {
    io.enable('browser client minification');
    io.enable('browser client etag');
    io.enable('browser client gzip');
    io.set('log level', 1);
    io.set('transports', ['websocket', 'flashsocket']);
  });

  // Configure Socket.IO for development
  io.configure('development', function() {
    io.set('log level', 2);
    io.set('transports', ['websocket', 'flashsocket']);
  });

  io.sockets.on('connection', function(client) {
    client.on('register', function(bounds, zoom) {
      client.set('zoom', zoom);
      client.set('bounds', bounds, function() {
      getVesselsInBounds(client, bounds, zoom);
      });
    });
    client.on('unregister', function() {
      client.del('bounds');
      client.del('zoom');
    });
  });
  callback();
}

/**
 * Redis
 */

function connectToRedis() {
  redisClient = redis.createClient();

  redisClient.on('connect', function() {
    log('(Redis) Connection established');
  });
  redisClient.on('error', function(err) {
    log('(Redis) ' + err);
  });
  redisClient.on('message', function(channel, message) {
    if (channel == 'safetyMessage')
    {
      try
      {
        var json = JSON.parse(message);
      }
      catch(err)
      {
        log('Error parsing received JSON - safetyMessage: ' + err );
        return;
      }
      var clients = io.sockets.clients();
      clients.forEach(function(client) {
        client.emit('safetyMessageEvent', message);
      });
    }
    if (channel == 'vesselPos') {
      try {
        var json = JSON.parse(message);
      }
      catch (err) {
        log('Error parsing received JSON - vesselpos: ' + err );
        return;
      }
      var clients = io.sockets.clients();
      var lon = json.pos[0];
      var lat = json.pos[1];
      var sog = json.sog/10;
      clients.forEach(function(client) {
        client.get('bounds', function(err, bounds) {
          if (bounds != null && lon != null && lat != null) 
          {
            if (positionInBounds(lon, lat, bounds)) 
            {
              client.get('zoom', function(err, zoom) 
              {
                if(sog !=null && sog > (zoomSpeedArray[zoom]) && sog != 102.3)
                {
                  // logPosEvent(json.userid +" "+json.utc_sec);
                  client.emit('vesselPosEvent', message);
                }
              });
            }
          }
        });
      });
    }
  });
  redisClient.subscribe('vesselPos');
  redisClient.subscribe('safetyMessage');
}

/**
 * MongoDB
 */

var mongoHost = 'localhost';
var mongoPort = 27017;
var mongoServer = new mongo.Server(mongoHost, mongoPort, {auto_reconnect: true});
var mongoDB = new mongo.Db('ais', mongoServer, {safe: true});

function connectToMongoDB() {
  mongoDB.open(function(err, db) {
    if (err) {
      log('(MongoDB) ' + err);
      log('Exiting ...')
      process.exit(1);
    }
    else {
      log('(MongoDB) Connection established');
      db.collection('vessels', function(err, collection) {
        if (err) {
          log('(MongoDB) ' + err);
          log('Exiting ...')
          process.exit(1);
        }
        else 
        {
          vesselsCollection = collection;
          db.collection('navigationalAid', function(err,coll){
            if(err){
              log('(MongoDB) ' + err);
              log('Exiting ...')
              process.exit(1);
            }
            else
            {
              navigationalAidCollection = coll;
              startHTTPServer(function(){
                startSocketIO(function(){
                  connectToRedis();
                });
              });
            }
          });
        }
      });
    }
  });
}

function getVesselsInBounds(client, bounds, zoom) {
  var timeFlex = new Date().getTime();
  var vesselCursor = vesselsCollection.find({
    pos: { $within: { $box: [ [bounds._southWest.lng,bounds._southWest.lat], [bounds._northEast.lng,bounds._northEast.lat] ] } },
    time_received: { $gt: (new Date() - 10 * 60 * 1000) },
    $or:[{sog: { $exists:true },sog: { $gt: zoomSpeedArray[zoom]},sog: {$ne: 102.3}}/*,{msgid:4}*/,{ $gt:{msgid: 5}}]
  });
  vesselCursor.toArray(function(err, vesselData) 
  {
    if (!err)
    {
      var boundsString = '['+bounds._southWest.lng+','+bounds._southWest.lat+']['+bounds._northEast.lng+','+bounds._northEast.lat+']';
      console.log('(Debug) Found ' + vesselData.length + ' vessels in bounds ' + boundsString +" with sog > "+zoomSpeedArray[zoom]);
      // if(zoom < 6)
      // {
        client.emit('vesselsInBoundsEvent', JSON.stringify(vesselData));
      // }
      // else
      // {
      //   var navigationalAidCursor = navigationalAidCollection.find({
      //       pos: { $within: { $box:[ [bounds._southWest.lng,bounds._southWest.lat], [bounds._northEast.lng,bounds._northEast.lat]]} }
      //       ,time_received: { $gt: (new Date() - 10 * 60 * 1000) }
      //       });
      //   navigationalAidCursor.toArray(function(err, navigationalAids){
      //       console.log('(Debug) Found ' + (navigationalAids !=null?navigationalAids.length:0) + ' navigational aids in bounds ' + boundsString);
      //       var vesNavArr = vesselData.concat(navigationalAids);
      //       logBoundsEvent(vesNavArr.length + " "+(new Date().getTime()-timeFlex) );
      //       client.emit('vesselsInBoundsEvent', JSON.stringify(vesNavArr));
      //       });
      // }
    }
  });
}

function positionInBounds(lon, lat, bounds) {
  return (lon > bounds._southWest.lng && lon < bounds._northEast.lng && lat > bounds._southWest.lat && lat < bounds._northEast.lat);
}

connectToMongoDB();

