var io = require("socket.io-client");

// How many clients should we simulate?
var clients = 1000;

// What bounds should we use?
var bounds = { left: -20, bottom: 9, right: 12, top: 36.2 };

// What zoomLevel should we use?
var zoomLevel = 13;

// Where should we connect to?
var serverUrl = "http://localhost:8090/"


var clientsConnected = 0;

setInterval(connectClient, 500);

function connectClient() {
	if(clientsConnected < clients)
	{
		var startTime = new Date();
		var socket = io.connect(serverUrl, {'force new connection': true});
		socket.emit('register', bounds, zoomLevel);
		clientsConnected++;
		console.log('Connected clients: ' + clientsConnected);
		socket.on('vesselsInBoundsEvent', function() {
		var endTime = new Date();
		console.log('Client received response within ' + (endTime - startTime) + 'ms');
		});
	}
}