/**
 * Dependencies
 */

var net = require('net');
var fs = require('fs');

/**
 * Logging
 */

function log(message) {
  var message = '['+new Date().toUTCString()+'] ' + message;
  fs.appendFile(__dirname + '/log/ais_client.log', message + '\n', function(err) {});
  console.log(message);
}

/**
 * AIS stream socket connection
 */

var aisPort = 44444;
var aisHost = 'aisstaging.vesseltracker.com';
var aisClient;
var reconnectionTimeout;
var reconnectionCount = 0;

var data = '';

function connectToAISStream() {
  aisClient = net.connect({port: aisPort, host: aisHost}, function() {
    clearReconnectionTimeout();
    reconnectionCount = 0;
    aisClient.setEncoding('utf8');
    log('(AIS client) Connection to ' + aisHost + ':' + aisPort + ' established');
    startStoredStatistics();

    aisClient.on('end', function() {
    log('(AIS client) Connection to ' + aisHost + ':' + aisPort + ' lost');
    });

    aisClient.on('close', function() {
      reconnectToAISStream();
    });

    aisClient.on('error', function(err) {
      log('(AIS client) ' + err);
    });

    aisClient.on('data', function(chunk) {
      data += chunk;
      var messageSeperator = '\r\n';
      var messageSeperatorIndex = data.indexOf(messageSeperator);
      while (messageSeperatorIndex != -1) {
        var message = data.slice(0, messageSeperatorIndex);
        parseStreamMessage(message);
        data = data.slice(messageSeperatorIndex + 1);
        messageSeperatorIndex = data.indexOf(messageSeperator);
      }
      data = data.slice(messageSeperatorIndex + 1);
    });
  });
}

function reconnectToAISStream() {
  clearReconnectionTimeout();
  log('(AIS client) Trying to reconnect to ' + aisHost + ':' + aisPort);
  if (reconnectionCount == 0) {
    connectToAISStream();
  }
  else if (reconnectionCount > 60) {
    reconnectionTimeout = setTimeout(connectToAISStream, 300*1000);
  }
  else {
    reconnectionTimeout = setTimeout(connectToAISStream, reconnectionCount*1000);
  }
  reconnectionCount++;
}

function clearReconnectionTimeout() {
  if (reconnectionTimeout != null) {
    clearTimeout(reconnectionTimeout);
  }
}

function parseStreamMessage(message) {
  try {
    var json = JSON.parse(message);
  }
  catch (err) {
    log('(AIS client) Error parsing received JSON: ' + err + ', ' + data);
    return;
  }
  if (json.msgid < 4) {
    if (json.pos[0] < 180 && json.pos[0] >= -180 && json.pos[1] < 90 && json.pos[1] >= -90) {
      var vesselPosObject = storeVesselPos(json);
      //process.send({eventType: 'vesselPosEvent', data: JSON.stringify(vesselPosObject)});
    }
  }
  if (json.msgid == 5) {
    storeVesselStatus(json);
  }
}

/**
 * Data storage (mongoDB)
 */

var mongo = require('mongodb');

var mongoHost = 'localhost';
var mongoPort = 27017;
var mongoServer = new mongo.Server(mongoHost, mongoPort, {auto_reconnect: true});
var mongoDB = new mongo.Db('ais', mongoServer, {safe: true});

var vessels;

mongoDB.open(function(err, db) {
  if(!err) {
    db.collection('vessels', function(err, collection) {
      if(!err) {
        vessels = collection;
        log('(AIS client) Connection to mongoDB established');
        connectToAISStream();
      }
    });
  }
});

function storeVesselPos(json) {
  obj = {
    aisclient_id: json.aisclient_id,
    mmsi: json.userid,
    pos: json.pos,
    cog: (json.cog/10),
    sog: (json.sog/10),
    true_heading: json.true_heading,
    nav_status: json.nav_status,
    time_received: json.time_received,
    sentences: json.sentences,
    updated_at: new Date(),
    last_msgid: json.msgid
  }
  vessels.update({mmsi: obj.mmsi}, {$set: obj}, {upsert:true}, function(err, result) {
    if (!err) {
      vessels.ensureIndex({pos: "2d", mmsi: 1}, function(err) {});
      countStoredMessages();
    }
    else {
      log('(AIS client) Error storing VesselPos: ' + err + ', ' + JSON.stringify(json));
    }
  });
  return obj;
}

function storeVesselStatus(json) {
  obj = {
    aisclient_id: json.aisclient_id,
    mmsi: json.userid,
    imo: json.imo,
    left: json.dim_port,
    front: json.dim_bow,
    width: (json.dim_port + json.dim_starboard),
    length: (json.dim_bow + json.dim_stern),
    name: json.name,
    dest: json.dest,
    callsign: json.callsign,
    draught: json.draught,
    ship_type: json.ship_type,
    time_received: json.time_received,
    updated_at: new Date(),
    last_msgid: json.msgid
  }
  vessels.update({mmsi: obj.mmsi}, {$set: obj}, {upsert:true}, function(err, result) {
    if (!err) {
      vessels.ensureIndex({mmsi: 1}, function(err) {});
      countStoredMessages();
    }
    else {
      log('(AIS client) Error storing VesselStatus: ' + err);
    }
  });
  return obj;
}

// Statistics
var storedMessageCounter = 0;
function countStoredMessages() {
  storedMessageCounter++;
}
function startStoredStatistics() {
  setInterval(function() {
    console.log('['+Date()+'] Stored ' + (storedMessageCounter) + ' messages/s');
    storedMessageCounter = 0;
  }, 1000);
}