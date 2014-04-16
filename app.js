var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');
var redis = require('redis');

var chat = require('./routes/chat');
var socketio = require('socket.io');


var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/single_chat', chat.main);
app.get('/users', user.list);

var red_cli = redis.createClient();
red_cli.on("error", function(err) {
	console.log("Error " + err); //redis error log
});


var server = app.listen(app.get('port'), function() {
	console.log("Express server listening on port " + app.get('port'));
});
var io = socketio.listen(server, {log: false}); //reduce log

var rooms = {};

var clients = {};
var socketsOfClients = {};

io.sockets.on('connection', function(socket) {

	socket.on('set username', function(userName) {

		if (clients[userName] === undefined) {
			clients[userName] = socket.id;
			socketsOfClients[socket.id] = userName;

			rooms['lobby'] = 'lobby';

			// store the username in the socket session for this client
			socket.username = userName;
			// store the room name in the socket session for this client
			socket.room = 'lobby';
			// send client to room 1
			socket.join('lobby');

			//http://stackoverflow.com/questions/10058226/send-response-to-all-clients-except-sender-socket-io
			//broadcast lobby except sender
			socket.broadcast.to('lobby').emit('lobbyBroadcast', userName);
			userNameAvailable(socket.id, userName);
			userJoined(userName);
			socket.emit('initRoomList', io.sockets.manager.rooms);
		} else if (clients[userName] === socket.id) {
			// Ignore for now
		} else {
			userNameAlreadyInUse(socket.id, userName);
		}
	});


	socket.on('createRoom', function(msg) {
		var user;
		var clientsList = {};
		var oldClientsList = {};
		var newClientsList = {};
		var roomName = msg.roomName;

		if (msg.inferSrcUser) {
			// user name based on the socket id
			user = socketsOfClients[socket.id];
			clientsList[socket.id] = user;
		} else {
			// user = msg.source;
		}
		rooms[roomName] = roomName;

		socket.leave(socket.room);

		socket.join(roomName);

		//update own status, clear chat area, update own client list
		var clients = io.sockets.clients(roomName);
		clients.forEach(function(client) {
			clientsList[client.id] = client.username;
		});
		socket.emit('switchRoom', roomName, clientsList);

		//say goodbye to the old room, update old room client list
		oldClientsList = getClientsListInRoom(socket.room);
		socket.broadcast.to(socket.room).emit('switchRoomBroadcast', user, 'left', oldClientsList);

		//say hello to the new room, update new room client list
		socket.room = roomName;
		newClientsList = getClientsListInRoom(socket.room);
		socket.broadcast.to(roomName).emit('switchRoomBroadcast', user, 'joined', newClientsList);

		//update all clients' roomList including sender
		io.sockets.emit('initRoomList', io.sockets.manager.rooms);

		// console.log(io.sockets.manager.rooms);
	});

	socket.on('joinRoom', function(joiner, rId) {
		var clientsList = {};
		var oldClientsList = {};
		var newClientsList = {};

		socket.leave(socket.room);
		socket.join(rooms[rId]);

		var clients = io.sockets.clients(rooms[rId]);
		clients.forEach(function(client) {
			clientsList[client.id] = client.username;
		});
		socket.emit('switchRoom', rooms[rId], clientsList);

		oldClientsList = getClientsListInRoom(socket.room);
		socket.broadcast.to(socket.room).emit('switchRoomBroadcast', joiner, 'left', oldClientsList);

		socket.room = rooms[rId];
		newClientsList = getClientsListInRoom(socket.room);
		socket.broadcast.to(socket.room).emit('switchRoomBroadcast', joiner, 'joined', newClientsList);

		//io.sockets.emit('roomListUpdateBroadcast', socket.room, rId);
		io.sockets.emit('initRoomList', io.sockets.manager.rooms);
	});

	socket.on('joinLobby', function(joiner) {
		joinLobby(socket, joiner);
	});

	socket.on('message', function(msg) {
		if (msg.inferSrcUser) {
			msg['source'] = socketsOfClients[socket.id]; //Infer user name based on the socket id
		} else {
			msg['source'] = 'A'; //from pretty little liar, anonymous sender, implement later...
		}
		
		// chat within current room, lobby is also a room!
		msg['target'] = msg.target.toLowerCase();
		io.sockets.in(msg.target).emit('message', {
									"source": msg.source,
									"message": msg.message,
									"target": msg.target
							});
		logChat(red_cli, msg);
	});

	socket.on('current room list', function() {
		socket.emit('return room list', JSON.stringify(Object.keys(io.sockets.manager.rooms)));
	});

	socket.on('exit', function(curRoom) {
		var uName = socketsOfClients[socket.id];

		delete socketsOfClients[socket.id];
		delete clients[uName];
		socket.leave(curRoom);
		closeRoom(socket, curRoom);
	});
})

function userJoined(uName) {
	var clientsList = {};
	var lobby_clients = io.sockets.clients('lobby');
	lobby_clients.forEach(function(lobby_client) {
		clientsList[lobby_client.id] = lobby_client.username;
	});
	Object.keys(clientsList).forEach(function(sId) {
		io.sockets.sockets[sId].emit('userJoined', { "userName": uName });
	})
}


function closeRoom(socket, curRoom) {
	// sending to all current clients except sender
	socket.broadcast.emit('roomClosed', curRoom);

}

function userNameAvailable(sId, uName) {
	var clientsList = {};
	var lobby_clients = io.sockets.clients('lobby');
	lobby_clients.forEach(function(lobby_client) {
		clientsList[lobby_client.username] = lobby_client.id;
	});
	io.sockets.sockets[sId].emit('welcome', { "userName": uName, "currentUsers": JSON.stringify(Object.keys(clientsList))});
}

function getClientsListInRoom(roomId) {
	var clientsInRoom = {};
	var room_clients = io.sockets.clients(roomId);
	room_clients.forEach(function(room_client) {
		clientsInRoom[room_client.id] = room_client.username;
	});
	return clientsInRoom;
}

function userNameAlreadyInUse(sId, uName) {
	setTimeout(function() {
		io.sockets.sockets[sId].emit('error', { "userNameInUse" : true });
	}, 500);
}

function joinLobby(socket, userName) {
	var clientsList = {};
	rooms['lobby'] = 'lobby';

	socket.join('lobby');
	socket.leave(socket.room);

	// store the room name in the socket session for this client
	socket.room = 'lobby';

	var clients = io.sockets.clients('lobby');
	clients.forEach(function(client) {
		clientsList[client.id] = client.username;
	});
	socket.emit('switchRoom', 'lobby', clientsList);

	//broadcast lobby except sender
	socket.broadcast.to('lobby').emit('lobbyBroadcast', userName);
	socket.emit('initRoomList', io.sockets.manager.rooms);
}

function logChat (red_cli, msg) {
	// console.log(red_cli.TIME);
	// var chatTranscript = new Object();
	// var msgList = {};

	//construct pool_id for sadd
	var sms_pool_id = '';	
	var res =	msg.target.split('_');
	if (res[1]) {
		sms_pool_id = res[1] + '_' + res[0]; //regular room
	}else{
		sms_pool_id = res[0] + '_';	//if it's lobby
	}

	var sms =	msg.source + ' : ' + msg.message;

	console.log(sms_pool_id);
	console.log(sms);

	red_cli.sadd(sms_pool_id, sms);
	// red_cli.smembers(sms_pool_id, function(err,res) {
	// 	res.forEach(function(reply, i){
	// 		console.log("number " + i + ": " + reply);
	// 		msgList[i] = reply;
	// 		console.log(msgList[i]);
	// 	});
	// 	chatTranscript.plain = msgList;
	// 	console.log(msgList);
	// 	console.log(chatTranscript);
	// 	red_cli.set("room idd", JSON.stringify(chatTranscript));
	// });

	red_cli.smembers(sms_pool_id, function (err, reply){
		console.log(reply);
	}); // for testing
}