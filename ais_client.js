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

var aisPort = 44447;
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
  try 
  {
    message = message.replace(/@/g,"");
    message = message.replace(/userid/g,"mmsi");
    var json = JSON.parse(message);
  }
  catch (err) {
    log('Error parsing received JSON: ' + err + ', ' + data);
    return;
  }
  if (json.msgid < 4)  //Vessel Position Data
  {
    if (json.pos[0] < 180 && json.pos[0] >= -180 && json.pos[1] < 90 && json.pos[1] >= -90) 
    {
      storeVesselPos(json);
      redisClient.publish('vesselPos', message);
    }
  }
  if (json.msgid == 4 ) //AIS Base Station
  {
     storeObject(json);
  }
  if (json.msgid == 5) //Vessel Voyage Data
  {
    storeVesselVoyage(json);
  }
   if (json.msgid == 6) //SAR Aircraft Position
  {
    storeObject(json);
  }
  if(json.msgid == 9) //SAR Aircraft
  {
    storeNavigationalAid(json);
  }
  if(json.msgid == 12) //Addressed Safety
  {
     redisClient.publish('safetyMessage', message);
  }
  if(json.msgid == 14)//Broadcast Safety
  {
    redisClient.publish('safetyMessage', message);
  }
  if(json.msgid == 21) //navigational Aid
  {
    storeNavigationalAid(json);
  }
}

/**
 * MongoDB
 */

var mongoHost = 'localhost';
var mongoPort = 27017;
var mongoServer = new mongo.Server(mongoHost, mongoPort, { auto_reconnect: true });
var mongoDB = new mongo.Db('ais', mongoServer, { safe: true, native_parser: true });
var vesselsCollection;
var baseStationsCollection;

mongoDB.open(function(err, db) {
  if (err) {
    log('(MongoDB) ' + err);
    log('Exiting ...')
    process.exit(1);
  }
  else
  {
    log('(MongoDB) Connection established');
    db.collection('navigationalAid', function(err, collection) {
      if (err) {
        log('(MongoDB) ' + err);
        log('Exiting ...')
        process.exit(1);
      }
      else 
      {
        navigationalAidCollection  = collection;
        collectionCount(navigationalAidCollection);
      }
    });
    db.collection('vessels', function(err, collection) {
      if (err) {
        log('(MongoDB) ' + err);
        log('Exiting ...')
        process.exit(1);
      }
      else {
        vesselsCollection = collection;
        collectionCount(vesselsCollection);
        ensureIndexes();
        connectToAISStream();
      }
    });
  }
});

function collectionCount(coll)
{
  coll.count(function(err, result){
    if(err)
    {
      log(err);
    }
    else
    {
      log('counted '+result +' '+ coll.collectionName);
    }
  })
}

function ensureIndexes() {
  log('(MongoDB) Ensuring indexes ... ')
  vesselsCollection.ensureIndex({ pos: "2d", sog: 1, time_received: 1 }, function(err, result) {
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
 navigationalAidCollection.ensureIndex({ pos: "2d" }, function(err, result) {
    if (err) {
      log(err);
    }
    else {
      log('(MongoDB) Ensuring index ' + result);
    }
  });
  navigationalAidCollection.ensureIndex({ mmsi: 1 }, { unique: true }, function(err, result) {
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
    mmsi: json.mmsi,
    pos: json.pos,
    cog: (json.cog),
    sog: (json.sog),
    nav_status: json.nav_status,
    time_received: json.time_received,
    last_msgid: json.msgid
    //sentences: json.sentences+'',
    //updated_at: new Date().getTime()+'',
  }
  if (json.true_heading && json.true_heading !=511 && json.true_heading < 360)
  {
    obj.true_heading = json.true_heading+'';
  }
  vesselsCollection.update(
    { mmsi: json.mmsi },
    { $set: obj },
    { safe: false, upsert: true }
  );
    // console.log("VesselPos------------------------");
    // console.log(obj);
}

 function storeVesselVoyage(json) {
  obj = {
    aisclient_id: json.aisclient_id,
    mmsi: json.mmsi,
    dim_port: json.dim_port,
    dim_bow: json.dim_bow,
    dim_starboard: json.dim_starboard,
    dim_stern: json.dim_stern,
    name: json.name+'',
    dest: json.dest+'',
    callsign: json.callsign+'',
    draught: json.draught+'',
    time_received: json.time_received,
    //updated_at: new Date().getTime()+'',
    last_msgid: json.msgid
  }
  if(json.imo)
  {
    obj.imo = json.imo+'';
  }
  if(json.ship_type)
  {
     obj.ship_type = json.ship_type;
  }
  vesselsCollection.update(
  { mmsi: json.mmsi },
  { $set: obj },
  { safe: false, upsert: true }
  );
  // console.log("VesselVoyage------------------------");
  // console.log(obj);
}

function storeObject(obj){
  vesselsCollection.update(
  { mmsi: obj.mmsi },
  { $set: obj },
  { safe: false, upsert: true }
  );
  // console.log("Object-----------------------------");
  // console.log(obj);
}
function storeNavigationalAid(json) {
    navigationalAidCollection.update(
    { mmsi: json.mmsi },
    { $set: json },
    { safe: false, upsert: true }
  );
    // console.log("navigationalAid-----------------------------");
    // console.log(json);
}