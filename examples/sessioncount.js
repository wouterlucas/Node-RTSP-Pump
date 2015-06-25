//test client for pump.js
var net = require('net');

//RTSP messages
var msg = 'GET_PARAMETER rtsp://127.0.0.1:554/12345678 RTSP/1.0\n';
msg+='CSeq: 1\n';
msg+='Content-Length: 13\n';
msg+='\n';
msg+='session_count';

var socket = net.connect(5554, 'localhost', testClient);

function testClient(){
	//wait for conncetion
	console.log('Succesfully connected to Pump');
	socket.setEncoding('utf8');

	//send RTSP message
	socket.write(msg, function(){
		console.log('succesfull send: ' + msg);
	});

	socket.on('data', function(data){
		console.log('Got response:');
		console.log(data);
	});

	socket.end(function(){
		console.log('connection closed');
	});
}
