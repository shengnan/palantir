var redis = require('redis');
var red_cli = redis.createClient('6379', '10.120.100.42');

exports.main = function(req, res){
	res.render('chat', { "title" : "Chat Sample" });
};

var transcripts = (function(callback) {
	var trans = {};
	red_cli.zrevrangebyscore('chat_transcript', 2397848394243, 0, function(err, replies) {
		replies.forEach(function(reply, i) {
			red_cli.get(reply, function(err, content) {
				trans[reply] = JSON.parse(content);
				if (replies.length-1 == i) {
					callback(err, trans);
				}
			});
		});
	});
});

exports.showTranscripts = function(req, res) {
	transcripts(function(err, trans) {
		res.render('transcripts', {"title" : 'Chat Transcripts: ', "transcripts" : trans});
	});
};

exports.singleTranscript = function(req, res) {
	var room_id = req.route.params.room_id;
	red_cli.get(room_id, function(err, content) {
		res.render('single_transcript', {"title" : 'Chat Transcript', "transcript" : JSON.parse(content), "room_id" : room_id});
	});
};

