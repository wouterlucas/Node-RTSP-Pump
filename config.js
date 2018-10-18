var config = {};

//the video file that this pump uses
config.videofile = '/Users/wouter/Desktop/SPTS2280.ts';

//location of the streamer
config.streamerBin = '/Applications/VLC.app/Contents/MacOS/VLC';

//network topology in case we have to be the SRM too
config.topology = {
    '1001' : {
        'ip'                : '192.168.2.200',
        'startPort'         : 1000,
        'frequency'         : '5620000', // Hz /1000
        'startProgramId'    : 1,
        'modulation'        : '256',
        'symbolRate'        : '6952000'
    }
};

module.exports = config;
