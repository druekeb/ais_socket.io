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
httpServer.listen(8080);
console.log('Server listening on http://localhost:8080/');

/**
 * AIS TCP stream
 */

// Create a new socket that connects to our AIS TCP stream
var aisStream = net.connect({port: 44444, host: "aisstaging.vesseltracker.com"}, function() {
  // Set encoding for the socket
  // (this makes the data event emit a string instead of a buffer)
  aisStream.setEncoding('utf8');
  
  console.log('[AIS] Connection to AIS data stream established. Receiving data ...');

  // We will use this string to store our data chunks
  var data = "";

  // When we receive new data from our AIS stream
  aisStream.on('data', function(chunk) {
    // Because we receive data in buffered chunks, we have to find some way
    // to get the full json message from our AIS stream
    data += chunk;
    var messageSeperatorIndex = data.indexOf('\r\n');
    if (messageSeperatorIndex != -1) {
      var message = data.slice(0, messageSeperatorIndex);
      parseStreamMessage(message);
      data = data.slice(messageSeperatorIndex + 1);
    }
  });

  // Parse and process our json message
  var parseStreamMessage = function(message) {
    // Try to parse json
    try {
      var json = JSON.parse(message);
    }
    catch (err) {
      console.log('[AIS] Received invalid JSON from AIS data stream: ' + err + ' ' + data);
      return;
    }
    // If the received message includes a userid and position we create a new vesselPosEvent
    // and emit it to our aisStream
    if (json.userid && json.pos) {
      var vesselPosEvent = {userid: json.userid, pos: json.pos};
      aisStream.emit('vesselPosEvent', JSON.stringify(vesselPosEvent));
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
});
