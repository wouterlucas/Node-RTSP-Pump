# Node-RTSP-Pump

Node.JS based RTSP Pump using VLC. 

This pump is to be used with a Session Resource Manager, or can be used to setup sessions directly. It will parse RTSP messages and initiate a VLC UDP stream to be either consumed directly or modulated onto a RF network by a QAM.


It only uses 1 video file and is obviously for testing purposes. Maybe one day I`ll add support for multiple video files and online ingest. 

The pump requires VLC to be installed.

## Setup

1. Install node
2. Put this somewhere and run npm install
3. Point `var videofile = '/Users/wouter/Desktop/test.ts';` to a mpeg2ts file on your filesystem
4. Point `var streamerBin = '/Applications/VLC.app/Contents/MacOS/VLC';` to VLC on your filesystem

## RTSP Usage

### Setup

`SETUP rtsp://192.168.1.3:8554/bipbop-gear1-all.ts RTSP/1.0\n`
`CSeq: 1\n`
`Transport: RTP/AVP/UDP;unicast;destination=192.168.1.3;client_port=1234;mode=PLAY`
`\r\n`
`\r\n`

### Play

`PLAY rtsp://192.168.1.2:8554/bipbop-gear1-all.ts RTSP/1.0\n`
`CSeq: 3\n`
`Session: 144E3A20\n`
`\r\n`
`\r\n`

### Teardown

`TEARDOWN rtsp://192.168.1.3/test_2.ts RTSP/1.0\n`
`CSeq: 3\n`
`Session: A014FC4E\n`
`\r\n`
`\r\n`


For more example see the examples folder.

