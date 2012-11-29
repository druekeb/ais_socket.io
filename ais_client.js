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
  if (json.msgid == 4) //AIS Base Station
  {
     storeVesselPos(json);
  }
  if (json.msgid == 5) //Vessel Voyage Data
  {
    storeVesselStatus(json);
  }
   if (json.msgid == 6) //SAR Aircraft Position
  {
    storeVesselPos(json);
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
   vesselsCollection.update(
    { mmsi: json.mmsi },
    { $set: json },
    { safe: false, upsert: true }
  );
}

function storeVesselStatus(json) {
  vesselsCollection.update(
    { mmsi: json.mmsi },
    { $set: json },
    { safe: false, upsert: true }
  );
}

function storeNavigationalAid(json) {
    navigationalAidCollection.update(
    { mmsi: json.mmsi },
    { $set: json },
    { safe: false, upsert: true }
  );
}

var shipTypes = {
                  6:'Passenger Ships',
                  7: 'Cargo Ships',
                  8: 'Tankers',
                  30:'Fishing',
                  31:'Towing',
                  32:'Towing',
                  33:'Dredger',
                  34:'Engaged in diving operations',
                  35:'Engaged in military operations',
                  36: 'Sailing',
                  37: 'Pleasure craft',
                  50:'Pilot vessel',
                  51:'Search and rescue vessels',
                  52:'Tugs',53:'Port tenders',
                  54:'anti-pollution vessels',
                  55:'Law enforcement vessels',
                  56:'Spare for local vessels',
                  57:'Spare for local vessels',
                  58:'Medical transports',
                  59:'Ships according to RR'
                };

var nav_stati = {
                  0:'under way using engine',
                  1:'at anchor',
                  2: 'not under command',
                  3: 'restricted maneuverability',
                  4: 'constrained by her draught',
                  5: 'moored',
                  6: 'aground',
                  7: 'engaged in fishing',
                  8: 'under way sailing',
                  9: 'future use',
                  10: 'future use',
                  11: 'future use',
                  12: 'future use',
                  13: 'future use',
                  14: 'AIS-SART (active)',
                  15: 'not defined' 
                }
var aton_types = {
                  0:'notSpecified',
                  1:'ReferencePoint',
                  2: 'RACON',
                  3: 'off-shoreStructure',
                  4: 'futureUse',
                  5: 'LightWithoutSectors',
                  6: 'LightWithSectors',
                  7: 'LeadingLightFront',
                  8: 'LeadingLightRear',
                  9: 'BeaconCardinalN',
                  10: 'BeaconCardinalE',
                  11: 'BeaconCardinalS',
                  12: 'BeaconCardinalW',
                  13: 'BeaconPorthand', 
                  14: 'BeaconStarboardhand',
                  15: 'BeaconPreferredChannelPortHand',
                  16: 'BeaconPreferredChannelStarboardHand',
                  17: 'BeaconIsolatedDanger',
                  18: 'BeacoSafeWater',
                  19: 'BeaconSpecialMark',
                  20: 'CardinalMarkN',
                  21: 'CardinalMarkE',
                  22: 'CardinalMarkS',
                  23: 'CardinalMarkW',
                  24: 'PortHandMark',
                  25: 'StarboardHandMark',
                  26: 'PreferredChannelPortHand',
                  27: 'PreferredChannelStarboardHand',
                  28: 'IsolatedDanger',
                  29: 'SafeWater',
                  30: 'SpecialMark',
                  31: 'LightVessel/LANBY/Rigs'
                }