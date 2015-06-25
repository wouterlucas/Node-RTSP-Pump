//test client for pump.js
var net = require('net');

//RTSP messages
var setup = 'SETUP rtsp://192.168.1.3:8554/bipbop-gear1-all.ts RTSP/1.0\n';
setup+='CSeq: 1\n';
//setup+='Transport: MP2T/DVBC/UDP;unicast;client=1234;source=127.0.0.1;destination=192.168.1.3;client_port=1234';
//setup+='Transport: MP2T;unicast;destination=192.168.1.3;client_port=1234';
//setup+='RTP/AVP;unicast;client_port=4588'
setup+='Transport: RTP/AVP/UDP;unicast;destination=192.168.1.3;client_port=1234;mode=PLAY';
setup+='\r\n';
setup+='\r\n';

var socket = net.connect(8554, '192.168.1.3', testClient);

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
	socket.write(setup, function(){
		console.log('succesfull send: ' + setup);
		setTimeout(end, 10*1000);
	});

	socket.on('data', function(data){
		console.log('Got response:');
		console.log(data.toString());
	});
	

}