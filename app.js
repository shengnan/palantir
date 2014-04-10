var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');

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
app.get('/chat', chat.main);
app.get('/users', user.list);

var server = app.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
var io = socketio.listen(server, {log: false}); //reduce log

var rooms = {};
var typesOfRooms = {};

var clients = {};
var socketsOfClients = {};

io.sockets.on('connection', function(socket) {

	socket.on('set username', function(userName) {

		if (clients[userName] === undefined) {
			clients[userName] = socket.id;
			socketsOfClients[socket.id] = userName;

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
			socket.emit('initRoomList', io.sockets.manager.rooms, typesOfRooms);
		} else if (clients[userName] === socket.id) {
			// Ignore for now
		} else {
			userNameAlreadyInUse(socket.id, userName);
		}
	});
console.log('=========='+ JSON.stringify(clients));
console.log('???????????'+ JSON.stringify(rooms));
	socket.on('joinRoom', function(joiner, socketId) {
		var clientsList = {};
		var oldClientsList = {};
		var newClientsList = {};
		socket.leave(socket.room);
		socket.join(rooms[socketId]);

		var clients = io.sockets.clients(rooms[socketId]);
		clients.forEach(function(client) {
			clientsList[client.id] = client.username;
		});
		socket.emit('switchRoom', rooms[socketId], clientsList);

		var old_room_clients = io.sockets.clients(socket.room);
		old_room_clients.forEach(function(old_room_client) {
			oldClientsList[old_room_client.id] = old_room_client.username;
		});
		socket.broadcast.to(socket.room).emit('switchRoomBroadcast', joiner, 'left', oldClientsList);

		socket.room = rooms[socketId];
		var new_room_clients = io.sockets.clients(socket.room);
		new_room_clients.forEach(function(new_room_client) {
			newClientsList[new_room_client.id] = new_room_client.username;
		});
		socket.broadcast.to(socket.room).emit('switchRoomBroadcast', joiner, 'joined', newClientsList);

		//io.sockets.emit('roomListUpdateBroadcast', socket.room, socketId);
		io.sockets.emit('initRoomList', io.sockets.manager.rooms, typesOfRooms);
	});

	socket.on('createRoom', function(msg) {
		var user;
		var clientsList = {};
		var oldClientsList = {};
		var newClientsList = {};
		var roomName = msg.roomName;
		var roomType = msg.roomType;

		if (msg.inferSrcUser) {
			// user name based on the socket id
			user = socketsOfClients[socket.id];
			clientsList[socket.id] = user;
		} else {
			// user = msg.source;
		}

		rooms[socket.id] = roomName;
		typesOfRooms[roomName] = roomType;

		socket.leave(socket.room);

		socket.join(roomName);
console.log('create room' + JSON.stringify(io.sockets.manager.rooms));
		//update own status, clear chat area, update own client list
		var clients = io.sockets.clients(roomName);
		clients.forEach(function(client) {
			clientsList[client.id] = client.username;
		});
		socket.emit('switchRoom', roomName, clientsList);

		//say goodbye to the old room, update old room client list
		var old_room_clients = io.sockets.clients(socket.room);
		old_room_clients.forEach(function(old_room_client) {
			oldClientsList[old_room_client.id] = old_room_client.username;
		});
		socket.broadcast.to(socket.room).emit('switchRoomBroadcast', user, 'left', oldClientsList);

		//say hello to the new room, update new room client list
		socket.room = roomName;
		var new_room_clients = io.sockets.clients(socket.room);
		new_room_clients.forEach(function(new_room_client) {
			newClientsList[new_room_client.id] = new_room_client.username;
		});
		socket.broadcast.to(roomName).emit('switchRoomBroadcast', user, 'joined', newClientsList);

		//update all clients' roomList including sender
		io.sockets.emit('roomListUpdateBroadcast', roomName, socket.id, roomType);

		// console.log(io.sockets.manager.rooms);
	});

	socket.on('message', function(msg) {
		var srcUser;
		if (msg.inferSrcUser) {
			// Infer user name based on the socket id
			srcUser = socketsOfClients[socket.id];
		} else {
			srcUser = msg.source;
		}

		if (msg.target == "All") {
			// broadcast
			io.sockets.emit('message', {
							"source": srcUser,
							"message": msg.message,
							"target": msg.target
							});
		} else {
			// chat within current room
			var target = msg.target.toLowerCase();
			io.sockets.in(target).emit('message', {
										"source": srcUser,
										"message": msg.message,
										"target": target
								});
		}
	})

	socket.on('disconnect', function() {
		var uName = socketsOfClients[socket.id];
		delete socketsOfClients[socket.id];
		delete clients[uName];

		// relay this message to all the clients

		 userLeft(uName);
	})
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


function userLeft(uName) {
	io.sockets.emit('userLeft', { "userName": uName });
}

function userNameAvailable(sId, uName) {
	var clientsList = {};
	var lobby_clients = io.sockets.clients('lobby');
	lobby_clients.forEach(function(lobby_client) {
		clientsList[lobby_client.username] = lobby_client.id;
	});
	io.sockets.sockets[sId].emit('welcome', { "userName": uName, "currentUsers": JSON.stringify(Object.keys(clientsList))});
}

// function roomNameAvailable(sId, roomName) {
//  setTime(function() {
//    console.log('Room created' + roomName + ' at ' + sId);
//    io.sockets.sockets[sId].emit('room welcome', {"roomName" : roomName, "currentRooms": JSON.stringify(Object.keys(rooms)) });
//  }, 500);
// }

function userNameAlreadyInUse(sId, uName) {
	setTimeout(function() {
		io.sockets.sockets[sId].emit('error', { "userNameInUse" : true });
	}, 500);
}
