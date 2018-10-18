//test client for pump.js
var net = require('net');

//RTSP messages
var setup = 'SETUP rtsp://10.121.29.122/4e6616d9-df58-4fb4-ba32-0b784f903f6b?VODServingAreaId=1002&StbId=device1 RTSP/1.0\n';
setup+='CSeq: 1\n';
setup+='User-Agent: TNT\n';
setup+='Authorization: E62337FFC05C69F6\n';
setup+='Transport: MP2T/DVBC/QAM;unicast;client_port=00000;ServiceGroupId=1001\n';
setup+='\n';

var socket = net.connect(5554, '127.0.0.1', testClient);

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



	
