//test client for pump.js
var net = require('net');

//RTSP messages
var teardown = 'TEARDOWN rtsp://192.168.1.3/test_2.ts RTSP/1.0\n';
teardown+='CSeq: 3\n';
teardown+='Session: A014FC4E\n';
teardown+='\r\n';
teardown+='\r\n';


var socket = net.connect(8554, '127.0.0.1', testClient);

function testClient(){
	//wait for conncetion
	console.log('Succesfully connected to Pump');

	function end(){
		console.log('stopping...')
		socket.end(function(){
			console.log('connection closed');
		});
	}

	//send RTSP message
	socket.write(teardown, function(){
		console.log('succesfull send: ' + teardown);
		setTimeout(end, 10*1000);
	});

	socket.on('data', function(data){
		console.log('Got response:');
		console.log(data.toString());
	});
	

}