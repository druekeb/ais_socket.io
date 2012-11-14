var path = require('path');
var fs = require('fs');
var child = require('child_process');
var cluster = require('cluster');
var worker = require('./worker');

/**
 * Logging
 */

function log(message) {
  var message = '['+new Date().toUTCString()+'] ' + '[Master] ' + message;
  fs.appendFile(__dirname + '/log/master.log', message + '\n', function(err) {});
  console.log(message);
}

/**
 * Cluster
 */

// Master process
if (cluster.isMaster) {
  // Do not fork more than 1 process for now!
  for (var i = 0; i < 1; i++) {
    cluster.fork();
  }

  cluster.on('online', function(worker) {
    log('New worker with pid ' + worker.process.pid + ' started');
  });
  cluster.on('exit', function(worker, code, signal) {
    log('Worker with pid ' + worker.process.pid + ' died');
  });

  forkAISClient();
}
// Worker process
else {
  worker.init();
}

/**
 * AIS Client
 */

function forkAISClient() {
  var errors;
  try {
    aisClient = child.fork(path.join(__dirname, 'ais_client.js'));
  }
  catch (err) {
    errors = true;
    log('Error forking AIS client process: ' + err);
    log('Exiting ...');
    process.exit(1);
  }
  if (errors == null) log('Forked AIS client process');
}