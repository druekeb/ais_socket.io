var path = require('path');
var fs = require('fs');
var child = require('child_process');

/* this is the starting point of the application */
forkAISClient();

 /* Logging */
function log(message) {
  var message = '['+new Date().toUTCString()+'] ' + '[Master] ' + message;
  fs.appendFile(__dirname + '/log/master.log', message + '\n', function(err) {});
  console.log(message);
}

/* AIS-Client - Process*/
function forkAISClient() {
  var errors;
  try {
    child.fork(path.join(__dirname, 'aisData-client.js'));
  }
  catch (err) {
    errors = true;
    log('Error forking AIS client process: ' + err);
    log('Exiting ...');
    process.exit(1);
  }
  if (errors == null) log('Forked AIS client process');

  forkWorker();
}

/*worker.js- Process*/
function forkWorker(){
  var errors;
  try
  {
    child.fork(path.join(__dirname, 'worker.js'));
  }
  catch (err) {
    errors = true;
    log('Error forking worker process: ' + err);
    log('Exiting ...');
    process.exit(1);
  }
  if (errors == null) log('Forked worker process');
}