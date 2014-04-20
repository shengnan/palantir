exports.main = function(req, res){
	res.render('chat', { "title" : "Chat Sample" });
};

var transcripts = (function(callback) {
	var redis = require('redis');
	var red_cli = redis.createClient('6379', '10.120.100.42');
	var trans = {};
	red_cli.zrangebyscore('chat_transcript', 0, 2397848394243, function(err, replies) {
		replies.forEach(function(reply, i) {
			red_cli.get(reply, function(err, content) {
				trans[reply] = JSON.parse(content);
				callback(err, trans);
			});
		});
	});
});

exports.showTranscripts = function(req, res) {
	transcripts(function(err, trans) {
		console.log(trans);
		res.render('transcripts', {"title" : 'Chat Transcripts: ', "transcripts" : trans});
	});
};

