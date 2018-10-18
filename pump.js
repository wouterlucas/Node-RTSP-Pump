/* 
 * RTSP Video pump in Node.JS
 * Author: Wouter van Boesschoten
 *
 */

//js hint relaxers
/*jshint sub:true */

//includes
var net = require('net');
var spawn = require('child_process').spawn;
var fs = require('fs');
var config = require('./config');

var videofile = config.videofile;
var streamerBin = config.streamerBin;
var topology = config.topology

//runtime variables
var sessionIdList = []; //flat array of session id's that are active
var sessions = {}; //associative array of session objects

//create our server
var server = net.createServer(connectionHandler);

//prevent our process from exiting
process.on('uncaughtException', function(err) {
    console.error(err.stack);
    console.log("Node NOT Exiting...");
});

function connectionHandler(conn) {
    var msg = ''; // Current message, per connection.
    conn.setEncoding('utf8');
    conn.setTimeout(0);
    conn.setNoDelay(true);
    console.log('Connection established: ' + conn.remoteAddress + ':' + conn.remotePort);

    conn.on('data', function(data) {
        console.log('Recieved: ' + data);

        if (data === '') {
            console.log('Empty input received, ignoring it');
        } else {
            //normalize our input
            var input = inputNormalizer(data);

            //process our normalized input
            for (var i = 0; i < input.length; i++) {
                rtspParser(data, function(response) {
                    //console.log('Responding: ' + response);
                    conn.write(response, 'utf8', function() {
                        //console.log('data written to socket');
                    });
                });
            }
        }
    });

    conn.on('end', function() {
        //console.log('Connection closed');
    });

    conn.on('error', function(error) {
        console.log('Socket error: ' + error);
    });

    conn.on('timeout', function() {
        console.log('Socket timeout');
    });
}

server.listen(5554);
console.log('Server listening on port 5554');

function inputNormalizer(input) {
    //function that takes a buffer of input and tries to extract the RTSP message(s)

    //variables
    var lines = input.split(/\n/);
    var rtspMessageFound = false;
    var contentLengthFound = false;
    var contentLength = 0;
    var responseArray = [];
    var processedData = '';

    for (var i = 0; i < lines.length; i++) {
        lines[i] = lines[i].replace('\r', '');

        //check if first line has RTSP at the end:
        if (lines[i].slice(lines[i].length - 8, lines[i].length) == 'RTSP/1.0') {
            //console.log('Found RTSP/1.0, adding it to input buffer');
            rtspMessageFound = true;
            processedData += lines[i];
            continue;
        }

        //we've already found a correct first line, lets continue
        if (rtspMessageFound === true) {
            //lets add this line
            processedData += lines[i];

            //check if we've got an empty line, it means we've finished parsing the headers/the message
            if (lines[i] === '') {
                //console.log('Found empty line, finishing up');
                if (contentLengthFound === true) {
                    //console.log('Previous content-length was found, grabbing the body with content-length: ' + contentLength);
                    //grap the next one with the content length as provided in the header and only this data
                    processedData += lines[i + 1].slice(0, contentLength);
                }

                //console.log('Done processing adding it to response array, found: ' + processedData);

                //we're done, add our buffer to the results and see if there is more
                responseArray.push(processedData);
                //reset our variables
                rtspMessageFound = false;
                contentLengthFound = false;
                contentLength = 0;
            }

            //check if this line happens to be a content-length header
            if (lines[i].slice(0, 15) == 'Content-Length:') {
                //console.log('Found content length, lets see');
                //we've got a content-length header, lets parse it
                var splittedContentLength = lines[i].split(':');

                //check if it is has a valid number
                if (isNaN(splittedContentLength[1]) === false) {
                    //it has a valid number, set our boolean to true
                    //contentLengthFound=true;
                    //set the length
                    contentLength = parseInt(splittedContentLength[1], 10);
                    //console.log('Found Content-Length header: ' + contentLength);
                }
            }
        }
    }

    //done, return response array
    return responseArray;
}

function rtspParser(message, callback) {
    var self = this;
    self.callback = callback;

    var request = {};
    var messageLines = message.split(/\n/);

    //parse first line, get the first argument this is the method
    //'SETUP rtsp://127.0.0.1:554/12345678 RTSP/1.0\n';
    request['method'] = messageLines[0].split(' ')[0];

    //header object
    request['headers'] = {};
    request['transport'] = {};

    //parse the headers, from the 2nd line in the message
    for (var i = 1; i < messageLines.length; i++) {

        //if it is empty, continue
        if (messageLines[i] === '') continue;
        //check for body lines
        if (messageLines[i] == 'session_count') request['session_count'] = true;
        if (messageLines[i] == 'session_list') request['session_list'] = true;

        var splittedHeaders = messageLines[i].split(':');

        if ((splittedHeaders[0] === '') || (splittedHeaders[1] === '')) continue;
        if ((splittedHeaders[0] === undefined) || (splittedHeaders[1] === undefined)) continue;

        //generate headers object
        request['headers'][splittedHeaders[0].replace(' ', '')] = splittedHeaders[1].replace(' ', '').replace('\r', '');

        //check if there is a transport header, ifso parse it
        if (splittedHeaders[0] == 'Transport') {
            //split the transport header by ;
            //'Transport: MP2T/DVBC/UDP;unicast;client=1234;source=127.0.0.1;destination=192.168.11.20;client_port=1444';
            var splittedTransport = splittedHeaders[1].split(';');

            //parse it
            for (var k = 0; k < splittedTransport.length; k++) {
                var splittedTransport2 = splittedTransport[k].split('=');
                if ((splittedTransport2[0] === '') || (splittedTransport2[1] === '') || (splittedTransport2[0] === undefined) || splittedTransport2[1] === undefined) continue;

                //add it to the request object
                request['transport'][splittedTransport2[0].replace(' ', '')] = splittedTransport2[1].replace(' ', '').replace('\r', '');
            }
        }
    }

    //log our request object for debug
    //console.log('Request object: ' + JSON.stringify(request));

    //vars
    var response;
    var reqsession;
    var index;

    //check the method of our request object
    switch (request['method']) {
        case ('SETUP'):
            //Setup create session
            var newSession = new session();
            newSession.create(request, function(response, id) {

                //add it to our state
                sessionIdList.push('' + id);
                sessions[id] = newSession;
                self.callback(response);
            });

            break;
        case ('TEARDOWN'):
            reqsession = request['headers']['Session'];
            index = sessionIdList.indexOf(reqsession);

            if (index > -1) {
                console.log('Deleting session...');
                sessions[request['headers']['Session']].destroy(request, function(response) {
                    //remove it from the session list
                    sessionIdList.splice(index, 1);
                    delete sessions[request['headers']['Session']];
                    self.callback(response);
                });
            } else {
                //item is not in our list
                response = rtspGenerator(request, 454, 'Session Not Found', {});
                self.callback(response);
            }

            break;
        case ('GET_PARAMETER'):
            //check if it has a session header
            if (request['headers']['Session']) {
                reqsession = request['headers']['Session'];
                index = sessionIdList.indexOf(reqsession);

                if (index > -1) {
                    sessions[request['headers']['Session']].getInfo(request, function(response) {
                        self.callback(response);
                    });
                } else {
                    //item is not in our list
                    response = rtspGenerator(request, 454, 'Session Not Found', {});
                    self.callback(response);
                }
            } else {
                //it does not have a session header, must be the SRM
                if (request['session_count'] === true) {
                    //return amount of sessions
                    response = rtspGenerator(request, 200, 'OK', {}, 'session_count: ' + sessionIdList.length);
                } else if (request['session_list'] === true) {
                    //generate a list of sessions
                    var sessionlist = '';

                    for (var l = 0; l < sessionIdList.length; l++) {
                        sessionlist = sessionlist + sessionIdList[l] + ' ';
                    }

                    response = rtspGenerator(request, 200, 'OK', {}, 'session_list: ' + sessionlist);
                } else {
                    response = rtspGenerator(request, 200, 'OK', {});
                }

                self.callback(response);
            }

            break;
        case ('PLAY'):
            reqsession = request['headers']['Session'];
            index = sessionIdList.indexOf(reqsession);

            if (index > -1) {
                sessions[request['headers']['Session']].play(request, function(response) {
                    //callback
                    self.callback(response);
                });
            } else {
                //item is not in our list
                response = rtspGenerator(request, 454, 'Session Not Found', {});
                self.callback(response);
            }
            break;
        case ('PAUSE'):
            reqsession = request['headers']['Session'];
            index = sessionIdList.indexOf(reqsession);

            if (index > -1) {
                sessions[request['headers']['Session']].pause(request, function(response) {
                    //callback
                    self.callback(response);
                });
            } else {
                //item is not in our list
                response = rtspGenerator(request, 454, 'Session Not Found', {});
                self.callback(response);
            }
            break;
    }

}

function rtspGenerator(request, code, method, headers, body) {
    //console.log(JSON.stringify(request));
    var cseq = parseInt(request['headers']['CSeq'], 10);

    //generate RTSP
    var response = 'RTSP/1.0 ' + code + ' ' + method + '\r\n';
    response += 'CSeq: ' + cseq + '\r\n';

    for (var propt in headers) {
        response += propt + ': ' + headers[propt] + '\r\n';
    }

    //set the content headers
    if (body) {
        var length = Buffer.byteLength(body, 'utf8');
        response += 'Content-Type: text/parameters \r\n';
        response += 'Content-Length: ' + length + '\r\n';
    }

    response += '\r\n';

    //add the body
    if (body) {
        response += body;
        response += '\r\n';
    }

    //response+='\r\n';

    return response;
}


session = function() {
    var that = this;
    that.assetLength = 60; //seconds
    that.curPosition = undefined;
    that.destination = '';
    that.offset = undefined;
    that.speed = 1.00;
    that.sessionId = '';
    that.serviceGroupId = null;
    that.streamer = undefined; //streamer handle
    that.useInternalSRM = false;


    //CREATED -> PLAYING -> PAUSED -> STOP -> DESTROY
    that.state = undefined;

    that.convertSecondsToTime = function(inputseconds) {
        var hours = parseInt(inputseconds / 3600) % 24;
        var minutes = parseInt(inputseconds / 60) % 60;
        var seconds = inputseconds % 60;
        var result = (hours < 10 ? "0" + hours : hours) + ":" + (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds);
        return result;
    };

    that.parseFfmpegOut = function(line) {
        var response;

        //cast the buffer to string
        line = line.toString();

        //frame=  620 fps= 30 q=31.0 size=    8826kB time=00:00:20.62 bitrate=3506.4kbits/s
        if (line.slice(0, 5) === 'frame') {
            //its a frame update line, parse it
            response = line.slice(48, 59);
        }

        return response;
    };

    that.getInfo = function(request, callback) {
        //get our current position
        that.streamer.stdout.write('get_time\n');

        //generate response
        var body = 'npt=' + that.curPosition + '\n';
        body += 'Scale=' + that.speed + '\n';
        var response = rtspGenerator(request, 200, 'OK', {
            'Session': that.sessionId
        }, body);

        //log it
        console.log('[SESSION]: ' + that.sessionId + ' [STATE]: ' + that.state + ' [POS]: ' + that.curPosition + ' [SPEED]: ' + that.speed);

        //return our response + sessionId
        callback(response, that.sessionId);
    };

    that.create = function(request, callback) {
        //set initialization for creation of session

        //generate ID
        that.sessionId = new Date().getTime();

        //check if SRM or Pump setup
        // Setups to an SRM have a ServiceGroupId that denotes which QAM the client is connected too
        // we need to generate the streaming address based on our own topology
        if (request['transport'] !== undefined && request['transport']['ServiceGroupId'] !== undefined) {
            that.useInternalSRM = true;
            that.serviceGroupId = request['transport']['ServiceGroupId'];

            if (topology[ that.serviceGroupId ] === undefined) {
                //generate response
                var errorResponse = rtspGenerator(request, 400, 'Bad request',{
                    'Session': that.sessionId
                });
                console.log('[SESSION]: ' + that.sessionId + ' [STATE]: FAILED, ServiceGroupId not found in Topology');
                callback(errorResponse, that.sessionId);
                return;
            }

            // increase the port for every session that is active
            var _ip = topology[ that.serviceGroupId ].ip;
            var _port = topology[ that.serviceGroupId ].startPort + sessionIdList.length - 1;
            that.destination = _ip + ':' + _port;
        } else {
            // SETUP is coming form an external SRM OR this is a UDP IPTV stream
            // generate destination from request
            that.destination = request['transport']['destination'] + ':' + request['transport']['client_port'];
        }

        console.log('Method CREATE: State is ' + that.state + ', got create. Spawning VLC');
        
        //init state, start the streamer
        if (that.streamer !== undefined) {
            console.log('Previous streamer running, killing it....');
            that.streamer.kill();
            that.streamer = undefined;
        }

        var args = [];

        //static arguments
        args.push(videofile);

        //vlc variables
        args.push('--sout');
        var vlcdest = '#standard{mux=ts,dst=' + that.destination + ',access=udp,file-caching=300}';
        args.push(vlcdest);
        args.push('-I');
        args.push('rc');

        console.log('Launching vlc with the following arguments: ' + args);

        //launch new process of streamer
        that.streamer = spawn(streamerBin, args);
        that.streamer.stdin.setEncoding('utf8');
        that.streamer.stdout.setEncoding('utf8');
        that.streamer.stderr.setEncoding('utf8');
        that.curPosition = 1;

        that.streamer.stdout.on('data', function(data) {
            console.log('stdout: ' + data);

            //see if we get a position back
            var splittedData = data.split(/\n/);
            if (isNaN(splittedData[0]) === false) {
                //its a number, must be our position!
                that.curPosition = parseFloat(data);
                console.log('Got position: ' + that.curPosition);
            }
        });

        that.streamer.stderr.on('data', function(data) {
            console.log('stderr: ' + data);
        });

        //Pause it until we get a PLAY, send pause request to stdout
        that.streamer.stdin.write('pause\n');
        that.state = 'PAUSED';

        var headers = {
            'Session': that.sessionId
        };

        // if we are playing SRM, generate proper response with tuning parameters
        if (that.useInternalSRM === true) {
            var _frequency  = topology[ that.serviceGroupId ].frequency;
            var _symbolRate = topology[ that.serviceGroupId ].symbolRate;
            var _modulation = topology[ that.serviceGroupId ].modulation;
            var _programId  = topology[ that.serviceGroupId ].startProgramId + sessionIdList.length - 1;

            headers = {
                'Session'   : that.sessionId + ';timeout=60',
                'Tuning'    : 'frequency=' + _frequency + ';modulation=' + _modulation + ';symbol_rate=' + _symbolRate,
                'Channel'   : 'Svcid=' + _programId
            };
        }

        //generate response
        var response = rtspGenerator(request, 200, 'OK', headers);

        //log it
        console.log('[SESSION]: ' + that.sessionId + ' [STATE]: CREATED [POS]: ' + that.curPosition + ' [SPEED]: ' + that.speed);

        //return our response + sessionId
        callback(response, that.sessionId);
    };

    that.play = function(request, callback) {
        var response;

        switch (that.state) {
            case ('INIT'):
                console.log('Method PLAY INIT: State is ' + that.state + ', got play. Sending OK');
                //init state, start the streamer
                if (that.streamer !== undefined) {
                    //there is a previous streamer alive, kill it first.
                    console.log('Previous streamer running, killing it....');
                    that.streamer.kill();
                    that.streamer = undefined;
                }

                var args = [];

                //static arguments
                args.push(videofile);

                //check for range header
                if (request['headers']['Range']) {} //tbd

                //check for scale header
                if (request['headers']['Scale']) {
                    //speed=speed/parseFloat(request['headers']['Scale']);
                }

                //vlc variables
                args.push('--sout');
                var vlcdest = '#standard{mux=ts,dst=' + that.destination + ',access=udp,file-caching=300}';
                args.push(vlcdest);
                args.push('-I');
                args.push('rc');

                console.log('Launching vlc with the following arguments: ' + args);

                //launch new process of streamer
                that.streamer = spawn(streamerBin, args);
                //set it to utf8
                that.streamer.stdin.setEncoding('utf8');
                that.streamer.stdout.setEncoding('utf8');
                that.streamer.stderr.setEncoding('utf8');
                //set our position to 1
                that.curPosition = 1;

                that.streamer.stdout.on('data', function(data) {
                    console.log('stdout: ' + data);

                    //see if we get a position back
                    var splittedData = data.split(/\n/);
                    if (isNaN(splittedData[0]) === false) {
                        //its a number, must be our position!
                        that.curPosition = parseFloat(data);
                        console.log('Got position: ' + that.curPosition);
                    }
                });

                that.streamer.stderr.on('data', function(data) {
                    console.log('stderr: ' + data);
                });

                //generate response
                response = rtspGenerator(request, 200, 'OK', {
                    'Session': that.sessionId
                });

                //set the state
                that.state = 'PLAYING';

                //log it
                console.log('[SESSION]: ' + that.sessionId + ' [STATE]: ' + that.state + ' [POS]: ' + that.curPosition + ' [SPEED]: ' + that.speed);

                //return our response + sessionId
                callback(response);
                break;
            case ('PLAYING'):
                console.log('Method PLAY PLAYING: State is ' + that.state + ', got play. Sending OK');

                //check for scale header
                if (request['headers']['Scale']) {
                    that.speed = parseFloat(request['headers']['Scale']);
                    console.log('Got Scale: ' + that.speed);


                    if (that.speed === 1) {
                        console.log('Sending VLC normal command');
                        that.streamer.stdin.write('normal\n');
                    } else if (that.speed > 1) {
                        console.log('Sending VLC fastforward command');
                        that.streamer.stdin.write('fastforward\n');
                    } else if (that.speed < 1) {
                        console.log('Sending VLC rewind command');
                        that.streamer.stdin.write('rewind\n');
                    }
                }


                if (request['headers']['Range']) {
                    var range = request['Headers']['Range'].split('=')[1];
                    var start = range.split(':')[0];

                    if (start != 'now') {
                        that.curPostion = parseFloat(request['headers']['Range']);
                        console.log('Sending seek to VLC');
                        that.streamer.stdin.write('seek ' + that.curPosition + '\n');
                    }
                }

                response = rtspGenerator(request, 200, 'OK', {
                    'Session': that.sessionId
                }, 'Scale: ' + that.speed + '\n');

                //log it
                console.log('[SESSION]: ' + that.sessionId + ' [STATE]: ' + that.state + ' [POS]: ' + that.curPosition + ' [SPEED]: ' + that.speed);

                callback(response);

                break;
            case ('PAUSED'):
                //we are paused, resume play
                console.log('Method PLAY PAUSED: State is ' + that.state + ', got play. Resuming');
                that.streamer.stdin.write('play\n');

                response = rtspGenerator(request, 200, 'OK', {
                    'Session': that.sessionId
                }, 'npt: ' + that.curPosition + '\n');

                //set the state
                that.state = 'PLAYING';

                //log it
                console.log('[SESSION]: ' + that.sessionId + ' [STATE]: ' + that.state + ' [POS]: ' + that.curPosition + ' [SPEED]: ' + that.speed);

                //return our response + sessionId
                callback(response);
                break;
        }
    };

    that.pause = function(request, callback) {
        var response;

        switch (that.state) {
            case ('INIT'):
                console.log('Method PAUSE INIT: State is ' + that.state + ', got pause. Sending method not allowed');
                //return error
                response = rtspGenerator(request, 405, 'Method not allowed', {
                    'Session': that.sessionId
                });

                //log it
                console.log('[SESSION]: ' + that.sessionId + ' [STATE]: ' + that.state + ' [POS]: ' + that.curPosition + ' [SPEED]: ' + that.speed);

                //return our response + sessionId
                callback(response);
                break;
            case ('PAUSED'):
                console.log('Method PAUSE PAUSED: State is ' + that.state + ', got pause. Falling trough');
                //fall through
            case ('PLAYING'):
                console.log('Method PAUSE PLAYING: State is ' + that.state + ', got pause. Pausing');
                //check if there is a streamer
                if (that.streamer !== undefined) {
                    //get our current position
                    that.streamer.stdin.write('get_time\n');
                    //send pause request to stdout
                    that.streamer.stdin.write('pause\n');

                    //generate response
                    response = rtspGenerator(request, 200, 'OK', {
                        'Session': that.sessionId
                    }, 'npt: ' + that.curPosition + '\n');

                    //set the state
                    that.state = 'PAUSED';

                    //log it
                    console.log('[SESSION]: ' + that.sessionId + ' [STATE]: ' + that.state + ' [POS]: ' + that.curPosition + ' [SPEED]: ' + that.speed);

                    //return our response + sessionId
                    callback(response);
                } else {
                    //no streamer, return an error
                    response = rtspGenerator(request, 500, 'Internal Server Error', {
                        'Session': that.sessionId
                    });

                    //log it
                    console.log('[SESSION]: ' + that.sessionId + ' [STATE]: PLAY ERROR');

                    //return our response + sessionId
                    callback(response);
                }
        }
    };

    that.destroy = function(request, callback) {
        //clean up streamer process
        if (that.streamer !== undefined) {
            //there is a previous streamer alive, kill it first
            that.streamer.kill();
            that.streamer = undefined;
        }

        //generate response
        var response = rtspGenerator(request, 200, 'OK', {});

        //log it
        console.log('[SESSION]: ' + that.sessionId + ' [STATE]: destoyed');

        //call back
        callback(response);
    };

};
