/* Dependencies */

var net = require('net');
var fs = require('fs');
var mongo = require('mongodb');
var redis = require('redis');

/* Redis - Database */
var redisClient = redis.createClient();

redisClient.on("error", function (err) {
  log('(Redis) ' + err);
});

/* Logging */
function log(message) {
  var message = '['+new Date().toUTCString()+'] ' + '[AIS Client] ' + message;
  fs.appendFile(__dirname + '/log/ais_client.log', message + '\n', function(err) {});
  console.log(message);
}

/* AIS stream socket connection */
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
    /*extract correct messages from the submitted chunks of data*/
    aisClient.on('data', function(chunk) {
      data += chunk;
      var messageSeparator = '\r\n';
      var messageSeparatorIndex = data.indexOf(messageSeparator);
      while (messageSeparatorIndex != -1) {
        var message = data.slice(0, messageSeparatorIndex);
        parseStreamMessage(message);
        data = data.slice(messageSeparatorIndex + 1);
        messageSeparatorIndex = data.indexOf(messageSeparator);
      }
      data = data.slice(messageSeparatorIndex + 1);
    });
  });
}

/* lost-connection - Treatment */
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

/* handle the different types of received AIS-Messages */
function parseStreamMessage(message) {
  try 
  {
    message = message.replace(/@/g,"");
    var json = JSON.parse(message);
  }
  catch (err) {
    log('Error parsing received JSON: ' + err + ', ' + message);
    return;
  }
  if (json.msgid < 4)  /*Vessel Position Data (Type 1, 2, 3) */
  {
    if (json.pos[0] < 180 && json.pos[0] >= -180 && json.pos[1] < 90 && json.pos[1] >= -90) 
    {
      /* save Position in MongoDB */
      storeVesselPos(json);
      /* publish position to Redis */
      redisClient.publish('vesselPos', message);
    }
  }
  if (json.msgid == 5) /*Vessel and  Voyage Data */
  {
    storeVesselVoyage(json);
  }
}

/* MongoDB */
var mongoHost = 'localhost';
var mongoPort = 27017;
var mongoServer = new mongo.Server(mongoHost, mongoPort, { auto_reconnect: true });
var mongoClient = new mongo.Db('ais', mongoServer, { safe: true, native_parser: false });
var vesselsCollection;
var baseStationsCollection;

mongoClient.open(function(err, db) {
  if (err) {
    log('(mongoClient) ' + err);
    log('Exiting ...')
    process.exit(1);
  }
  else
  {
    log('(mongoClient) Connection established');
    db.collection('vessels', function(err, collection) {
      if (err) 
      {
        log('(mongoClient) ' + err);
        log('Exiting ...')
        process.exit(1);
      }
      else
      {
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
}

function storeVesselPos(json) {
  obj = {
    aisclient_id: json.aisclient_id,
    mmsi: json.userid,
    pos: json.pos,
    nav_status: json.nav_status,
    time_received: json.time_received,
    time_captured: json.time_captured,
    msgid: json.msgid
  }
  if(typeof json.sog != "undefined" && json.sog < 1023)
  {
    obj.sog = json.sog/10;
  } 
  if (typeof json.cog != "undefined" && json.cog < 3600)
  {
    obj.cog = json.cog/10;
  }
  if (typeof json.true_heading != "undefined"  && json.true_heading !=511 && json.true_heading < 360)
  {
    obj.true_heading = json.true_heading;
  }
  if (typeof json.rot != "undefined" && json.rot > -127 && json.rot < 127)
  {
    var sign = json.rot < 0? -1 : 1;
    obj.rot = Math.round(Math.sqrt(Math.abs(json.rot))*4733 * sign)/1000;
  }
  vesselsCollection.update(
    { mmsi: obj.mmsi },
    { $set: obj },
    { safe: false, upsert: true }
  );
}

 function storeVesselVoyage(json) {
  obj = {
    aisclient_id: json.aisclient_id,
    mmsi: json.userid,
    dim_port: json.dim_port,
    dim_bow: json.dim_bow,
    dim_starboard: json.dim_starboard,
    dim_stern: json.dim_stern,
    
    dest: json.dest+'',
    callsign: json.callsign+'',
    draught: json.draught,
    time_received: json.time_received,
    time_captured: json.time_captured,
    msgid: json.msgid
  }
  if(typeof json.imo != "undefined" && json.imo > 0)
  {
    obj.imo = json.imo+'';
  }
  if(typeof json.ship_type != "undefined")
  {
     obj.ship_type = json.ship_type;
  }
  if(typeof json.name != "undefined")
  {
    obj.name = json.name;
  }
  vesselsCollection.update(
  { mmsi: obj.mmsi },
  { $set: obj },
  { safe: false, upsert: true }
  );
}