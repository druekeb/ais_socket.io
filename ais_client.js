/**
 * Dependencies
 */

var net = require('net');
var fs = require('fs');
var mongo = require('mongodb');
var redis = require('redis');

/**
 * Logging
 */

function log(message) {
  var message = '['+new Date().toUTCString()+'] ' + '[AIS Client] ' + message;
  fs.appendFile(__dirname + '/log/ais_client.log', message + '\n', function(err) {});
  console.log(message);
}

/**
 * Redis
 */

var redisClient = redis.createClient();

redisClient.on("error", function (err) {
  log('(Redis) ' + err);
});

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
    log('Connection to ' + aisHost + ':' + aisPort + ' established');

    aisClient.on('end', function() {
    log('Connection to ' + aisHost + ':' + aisPort + ' lost');
    });

    aisClient.on('close', function() {
      reconnectToAISStream();
    });

    aisClient.on('error', function(err) {
      log(err);
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
  log('Trying to reconnect to ' + aisHost + ':' + aisPort);
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
    log('Error parsing received JSON: ' + err + ', ' + data);
    return;
  }
  if (json.msgid < 4) {
    if (json.pos[0] < 180 && json.pos[0] >= -180 && json.pos[1] < 90 && json.pos[1] >= -90) {
      var obj = storeVesselPos(json);
      redisClient.publish('vesselPos', JSON.stringify(obj));
    }
  }
  if (json.msgid == 5) {
    storeVesselStatus(json);
  }
}

/**
 * MongoDB
 */

//sog
//102.3 not available
//102.2 102.2 or more knots

//course
//3600 not available
//3601-4095 should not be used

//true_heading
//511 not available
//359

var mongoHost = 'localhost';
var mongoPort = 27017;
var mongoServer = new mongo.Server(mongoHost, mongoPort, { auto_reconnect: true });
var mongoDB = new mongo.Db('ais', mongoServer, { safe: true, native_parser: true });
var vesselsCollection;

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
      else {
        vesselsCollection = collection;
        ensureIndexes();
        connectToAISStream();
      }
    });
  }
});

function ensureIndexes() {
  log('(MongoDB) Ensuring indexes ... ')
  vesselsCollection.ensureIndex({ pos: "2d" }, function(err, result) {
    if (err) {
      log(err);
    }
    else {
      log('(MongoDB) Ensuring index ' + result);
    }
  });
  vesselsCollection.ensureIndex({ mmsi: 1 }, { unique: true }, function(err, result) {
    if (err) {
      log(err);
    }
    else {
      log('(MongoDB) Ensuring index ' + result);
    }
  });
  vesselsCollection.ensureIndex({ sog: 1 }, function(err, result) {
    if (err) {
      log(err);
    }
    else {
      log('(MongoDB) Ensuring index ' + result);
    }
  });
  vesselsCollection.ensureIndex({ time_received: 1 }, function(err, result) {
    if (err) {
      log(err);
    }
    else {
      log('(MongoDB) Ensuring index ' + result);
    }
  });
}

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
  vesselsCollection.update(
    { mmsi: obj.mmsi },
    { $set: obj },
    { safe: false, upsert: true }
  );
  return obj
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
    name: trimAds(json.name),
    dest: json.dest,
    callsign: json.callsign,
    draught: json.draught,
    ship_type: json.ship_type,
    time_received: json.time_received,
    updated_at: new Date(),
    last_msgid: json.msgid
  }
  vesselsCollection.update(
    { mmsi: obj.mmsi },
    { $set: obj },
    { safe: false, upsert: true }
  );
  return obj;
}

function trimAds(name) {
 var l = 0;
  var r = name.length - 1;
  while (l < name.length && name[l] == ' ') {
    l++;
  }
  while (r > l && name[r] == '@') {
    r -= 1;
  }
  return name.substring(l, r + 1);
} 