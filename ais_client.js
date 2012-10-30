/**
 * Dependencies
 */

var net = require('net');
var redis = require('redis');
var fs = require('fs');

/**
 * Logging
 */

function writeToLog(message) {
  var message = '['+new Date().toUTCString()+'] ' + message;
  fs.appendFile(__dirname + '/log/ais_client.log', message + '\n', function(err) {});
  console.log(message);
}

/**
 * Socket connection
 */

var aisPort = 44444;
var aisHost = 'aisstaging.vesseltracker.com';
var aisClient;
var reconnectionTimeout;
var reconnectionCount = 0;

function connectToAISStream() {
  aisClient = net.connect({port: aisPort, host: aisHost});
}

function reconnectToAISStream() {
  clearReconnectionTimeout();
  writeToLog('(AIS socket) Trying to reconnect to ' + aisHost + ':' + aisPort);
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

connectToAISStream();

aisClient.on('connect', function() {
  clearReconnectionTimeout();
  reconnectionCount = 0;
  aisClient.setEncoding('utf8');
  writeToLog('(AIS socket) Connection to ' + aisHost + ':' + aisPort + ' established');
});
aisClient.on('end', function() {
  writeToLog('(AIS socket) Connection to ' + aisHost + ':' + aisPort + ' lost');
});
aisClient.on('close', function() {
  reconnectToAISStream();
});
aisClient.on('error', function(err) {
  writeToLog('(AIS socket) ' + err);
});

/**
 * Data processing
 */

// Split received data into single messages so we can later on parse that messages
var data = '';
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

function parseStreamMessage(message) {
  try {
    var json = JSON.parse(message);
  }
  catch (err) {
    writeToLog('(AIS socket) Error parsing received JSON: ' + err + ' ' + data);
    return;
  }
  if (json.msgid < 4) {
    var vesselPosObject = storeVesselPos(json);
    process.send({eventType: 'vesselPosEvent', data: JSON.stringify(vesselPosObject)});
  }
  if (json.msgid == 5) {
    storeVesselStatus(json);
  }
}

/**
 * Data storage (redis)
 */

var redisClient = redis.createClient();

redisClient.on("error", function (err) {
  writeToLog('(Redis) ' + err);
});

function storeVesselPos(json) {
  obj = {
    aisclient_id: json.aisclient_id+'',
    mmsi: json.userid+'',
    long: json.pos[0]+'',
    lat: json.pos[1]+'',
    cog: (json.cog/10)+'',
    sog: (json.sog/10)+'',
    true_heading: json.true_heading+'',
    nav_status: json.nav_status+'',
    time_received: json.time_received+'',
    sentences: json.sentences+'',
    updated_at: new Date().getTime()+'',
    last_msgid: json.msgid+''
  }
  redisClient.sadd('vessels', 'vessel:'+json.userid);
  redisClient.hmset('vessel:'+json.userid, obj);
  return obj;
}

function storeVesselStatus(json) {
  obj = {
    aisclient_id: json.aisclient_id+'',
    mmsi: json.userid+'',
    imo: json.imo+'',
    left: json.dim_port+'',
    front: json.dim_bow+'',
    width: (json.dim_port + json.dim_starboard)+'',
    length: (json.dim_bow + json.dim_stern)+'',
    name: json.name+'',
    dest: json.dest+'',
    callsign: json.callsign+'',
    draught: json.draught+'',
    ship_type: json.ship_type+'',
    time_received: json.time_received+'',
    updated_at: new Date().getTime()+'',
    last_msgid: json.msgid+''
  }
  redisClient.sadd('vessels', 'vessel:'+json.userid);
  redisClient.hmset('vessel:'+json.userid, obj);
  return obj;
}