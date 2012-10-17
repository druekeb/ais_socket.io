/**
 * Dependencies
 */

var http = require('http');
var fs = require('fs');
var net = require('net');
var sio = require('socket.io');

/**
 * HTTP server
 */

var httpServer = http.createServer();

var messageTypes = new Array(25);

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
for (var i = 0; i<messageTypes.length;i++)
{
  messageTypes[i] = 0;
}
  // Set encoding for the socket
  // (this makes the data event emit a string instead of a buffer)
  aisStream.setEncoding('utf8');
  
  console.log('[AIS] Connection to AIS data stream established. Receiving data ...');

  // We will use this string to store our data chunks
  var data = "";

  // When we receive new data from our AIS stream 
  aisStream.on('data', function(chunk) {
    // We receive data in buffered chunks
    // A chunk contains 1 -4 sometimes AIS-Messages, that are sometimes incomplete
    // so we combine the end of an unterminated chunk with the beginning of the next one

    data += chunk;
    var messageSeperatorIndex = data.indexOf('\r\n');
    var anzahlMessages = 0;
    while(messageSeperatorIndex  != -1) 
    {
      //send every complete Message in the chunk to the client
      var message = data.slice(0, messageSeperatorIndex);
      parseStreamMessage(message);
      //cut every send Message out of the chunk
      data = data.slice(messageSeperatorIndex +1);
      messageSeperatorIndex = data.indexOf('\r\n');
      anzahlMessages++;
    }
    data = data.slice(messageSeperatorIndex + 1);

    for(var i = 0; i < messageTypes.length; i++)
    {
//     console.log ("messageType "  +[i]+" : " +messageTypes[i]);
    }
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
     //save statistic information about messageTypes
      messageTypes[json.msgid] = messageTypes[json.msgid]+1;
    // If the received message is a type1 message, we create a new vesselPosEvent
    if (json.msgid == 1 ||json.msgid ==3) {
      var vesselPosEvent ={
        "msgid": json.msgid,
        "userid": json.userid,
        "pos": json.pos,
        "cog":json.cog,
        "sog":json.sog,
        "true_heading":json.true_heading,
        "nav_status": json.nav_status,
        "time_captured":json.time_captured 
      };
      aisStream.emit('vesselPosEvent', JSON.stringify(vesselPosEvent));
    }

    // If the received message is a type5 message, we create a new vesselStatusEvent
    if (json.msgid == 5) {
      var vesselStatusEvent ={
        "msgid": json.msgid,
        "userid": json.userid,
        "imo" : json.imo,
        "left" : json.dim_port,
        "front" : json.dim_bow,
        "width" : json.dim_port + json.dim_starboard,
        "length" : json.dim_bow + json.dim_stern,
        "name" : json.name,
        "dest" : json.dest,
        "callsign":json.callsign,
        "draught": json.draught,
        "ship_type": json.ship_type,
        "time_captured":json.time_captured 
        //TODO:eta_month,eta_day,eta_hour,eta_minute einbauen
      };
      aisStream.emit('vesselStatusEvent', JSON.stringify(vesselStatusEvent));
  }
}
});
/**
 * Socket.IO Server
 */

var io = sio.listen(httpServer);
// Set logging level to "info"
io.set('log level', 2);

// When a client connects to our websocket
io.sockets.on('connection', function(client) {
  console.log('New client connected to websocket');
  // When we are getting a new vesselPosEvent from our aisStream socket
  aisStream.on('vesselPosEvent', function(data) {
    // Emit this event to our connected client
    client.emit('vesselPosEvent', data);
  });
  aisStream.on('vesselStatusEvent', function(data) {
    // Emit this event to our connected client
    client.emit('vesselStatusEvent', data);
  });
});