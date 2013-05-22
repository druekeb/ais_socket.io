var io = require("socket.io-client");

// How many clients should we simulate?
var clients = 1000;

// What bounds should we use?

var bounds = {	_southWest: {lat:53.54279383653008, lng:9.946274757385254},
		_northEast: {lat:53.5472180724181, lng:9.973740577697754} 
	};
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
		socket.on('vesselsInBoundsEvent', function() {
		var endTime = new Date();
		console.log('Connected clients: ' + clientsConnected+ ' response within ' + (endTime - startTime) + 'ms');
		});
	}
}
