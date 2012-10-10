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
    response.writeHead(200, {'Content-Type': 'text/html'});
    response.write(contents);
    response.end();
  });
});

// Make HTTP server listen on port 8000 and log some console message on startup
httpServer.listen(8000);
console.log('Server listening on http://localhost:8000/features.html');

/**
 * AIS TCP stream
 */

// Create a new socket that connects to our AIS TCP stream
var aisStream = net.connect({port: 44444, host: "aisstaging.vesseltracker.com"}, function() {
  console.log('[AIS] Connection to AIS data stream established. Receiving data ...');

  // When we receive new data from our AIS stream
  aisStream.on('data', function(data) {
    // Parse json
    try {
      var json = JSON.parse(data);
      if(json.msgid == 5)
    	  {console.log("bow: "+json.dim_bow+", stern: "+json.dim_stern+", starboard: "+json.dim_starboard+", port: "+json.dim_port);}
    }
    catch (err) {
      console.log('[AIS] Received invalid JSON from AIS data stream');
      
      console.log(err);
      
      console.log(data);
      return;
    }
    // If the received data includes a userid and position we create a new vesselPosEvent
    // and emit it to our aisStream
    if (json.userid && json.pos) {
      var vesselPosEvent ={"msgid": json.msgid, "userid": json.userid, "pos": json.pos,
    		  				"cog":json.cog, "sog":json.sog,
    		  				"true_heading":json.true_heading, "nav_status": json.nav_status,
    		  				"time_captured":json.time_captured };
      aisStream.emit('vesselPosEvent', JSON.stringify(vesselPosEvent));
    }
  });
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