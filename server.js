/**
 * Dependencies
 */

var http = require('http');
var fs = require('fs');
var net = require('net');
var sio = require('socket.io');


var vessels = new Object();
/**
 * HTTP server
 */

var httpServer = http.createServer();


  // Implement a new event listener for a request on our HTTP server
// This will serve our index.html file
httpServer.on('request', function(request, response) {
  // Read from index.html
  fs.readFile('index.html', function(err, contents) {
    // If we encounter an error while reading from file
    if (err) {
      response.writeHead(500);
      response.write('Error loading index.html');
      return response.end();
    }
    // Otherwise respond with status code 200 and serve contents of index.html
    response.writeHead(200, {'Content-Type': 'text/html'});
    response.write(contents);
    response.end();
  });
});

 
// Make HTTP server listen on port 8080 and log some console message on startup
httpServer.listen(8090);
console.log('Server listening on http://localhost:8090/');

/**
 * AIS TCP stream
 */

/// Create a new socket that connects to our AIS TCP stream
var aisStream = net.connect({port: 44444, host: "aisstaging.vesseltracker.com"}, function() {

  // Set encoding for the socket
  // (this makes the data event emit a string instead of a buffer)
  aisStream.setEncoding('utf8');
  
  console.log('[AIS] Connection to AIS data stream established. Receiving data ...');

  // We will use this string to store our data chunks
  var data = "";

  // When we receive new data from our AIS stream 
  aisStream.on('data', function(chunk) {
    // We receive data in buffered chunks. A chunk contains 1 -4 AIS-Messages, that are sometimes incomplete
    // so we combine the end of an unterminated chunk with the beginning of the next one

    data += chunk;
    var messageSeperatorIndex = data.indexOf('\r\n');
    while(messageSeperatorIndex  != -1) 
    {
      //send every complete Message in the chunk to the client
      var message = data.slice(0, messageSeperatorIndex);
      parseStreamMessage(message);
      
      //cut every send Message out of the chunk
      data = data.slice(messageSeperatorIndex +1);
      messageSeperatorIndex = data.indexOf('\r\n');
    }
    data = data.slice(messageSeperatorIndex + 1);
  });

  // Parse and process our json message
  function parseStreamMessage(message) {
    // Try to parse json
    try {
      var json = JSON.parse(message);
    }
    catch (err) {
      console.log('[AIS] Received invalid JSON from AIS data stream: ' + err + ' ' + data);
      return;
    }

    // If the received message is of type 1,2 or 3, we create a new vesselPosEvent
    if (json.msgid < 4) {
      var vesselPosObject;
      if (typeof vessels[""+json.userid]!= "undefined")
      {
        vessels[""+json.userid].pos = json.pos;
        vesselPosObject = vessels[""+json.userid];
      }
      else
      {
        vesselPosObject = createVesselPosObject(json);
        vessels[""+json.userid] = vesselPosObject;
      }
      aisStream.emit('vesselPosEvent', vesselPosObject);
    }

    // If the received message is a type 5 message, we save the vesseldata in the vesselArray
    if (json.msgid == 5) {

      //TODO update auf schiffe, die schon im Array sind (ohne die Position zu überschreiben)
      if (typeof vessels[""+json.userid] == "undefined")
      {
         var vesselStatusObject = createVesselStatusObject(json);
         vessels[""+json.userid] = vesselStatusObject;
      }
  }
}

function createVesselPosObject(json){
  var vesselPosObject = new Object();
  vesselPosObject.aisclient_id = json.aisclient_id;
  vesselPosObject.msgid = json.msgid;
  vesselPosObject.mmsi = json.userid;
  vesselPosObject.pos = json.pos;
  vesselPosObject.cog = json.cog;
  vesselPosObject.sog = json.sog;
  vesselPosObject.true_heading = json.true_heading;
  vesselPosObject.nav_status = json.nav_status;
  vesselPosObject.time_captured = json.time_captured;
  return vesselPosObject;
}

function createVesselStatusObject(json){
  var vesselStatusObject = new Object();
  vesselStatusObject.aisclient_id = json.aisclient_id;
  vesselStatusObject.msgid = json.msgid;
  vesselStatusObject.mmsi = json.userid;
  vesselStatusObject.imo = json.imo;
  vesselStatusObject.left = json.dim_port;
  vesselStatusObject.front = json.dim_bow;
  vesselStatusObject.width = json.dim_port +json.dim_starboard;
  vesselStatusObject.length = json.dim_bow + json.dim_stern;
  vesselStatusObject.name = json.name;
  vesselStatusObject.dest = json.dest;
  vesselStatusObject.callsign = json.callsign;
  vesselStatusObject.draught = json.draught;
  vesselStatusObject.ship_type = json.ship_type;
  vesselStatusObject.time_captured = json.time_captured;
  //TODO:eta_month,eta_day,eta_hour,eta_minute einbauen
  return vesselStatusObject;
}

});
/**
 * Socket.IO Server
 */

var io = sio.listen(httpServer);
// Set logging level to "info"
io.set('log level', 2);


 
var registration = new Array();

//########################################### Socket.IO ##############################################################################

// When a client connects to our websocket
io.sockets.on('connection', function(client) {
  console.log('New client connected to websocket');
  
  //Client für die boundingBox registrieren
  client.on('register',function(bounds)  {
    //Client-registration with boundingbox
      var client_registration = new Array(5);
      client_registration[0] = bounds.top;
      client_registration[1] = bounds.right;
      client_registration[2] = bounds.bottom;
      client_registration[3] = bounds.left;
      client_registration[4] = client;
      registration.push(client_registration);
      //sende alle gespeicherten vesselStatusObjects an den Client, die innerhalb der BoundingBox liegen
      aisStream.emit('vesselStatusEvent', client_registration);

  });

  //Client abmelden für die BoundingBox
  client.on('unregister',function(){
      for (var i = 0; i < registration.length; i++) 
      {
        if (registration[i][4] === client )
        {
          registration.splice(i, i+1);
        }
      }
  });

  // neue Positionsmeldung (type 1,2,3) verteilen an Clients
  aisStream.on('vesselPosEvent', function(data) {
    // Emit this event to all clients in this area
    for (var i = 0; i < registration.length; i++) 
    {
      var r = registration[i];
      if(typeof data.pos !="undefined" && positionInBBOX(data.pos,r))
      {
        r[4].emit('vesselPosEvent', JSON.stringify(data));
      }
    }
  });

  // neue Registrierung mit Array von enthaltenen vesselStatusObjects beantworten
  aisStream.on('vesselStatusEvent', function(client_registration) {
    var data = new Array();
    for (var keys in vessels)
    {
    if (typeof vessels[keys] != "undefined" && typeof vessels[keys].pos != "undefined"  && positionInBBOX(vessels[keys].pos, client_registration))
      {
        data.push(vessels[keys]);
      }
    }
    client.emit('vesselStatusEvent', JSON.stringify(data));
  });
});

// when a client disconnects.. perform this
io.sockets.on('disconnect', function(client){
  console.log("client disconnected: "+registration.length);
  for (var i = 0; i < registration.length; i++) 
    {
      if (registration[i][4] === client )
        registration.splice(i, i+1);
    }
  });

// gibt zurück, ob eine Position in einer boundingBox enthalten ist

function positionInBBOX(pos,bbox){
  return (pos[0] > bbox[3] && pos[0] < bbox[1] && pos[1] > bbox[2] && pos[1] < bbox[0]);
}