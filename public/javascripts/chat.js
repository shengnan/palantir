var socket;
var myUserName;

function enableMsgInput(enable) {
	$('input#msg').prop('disabled', !enable);
}

function enableUsernameField(enable) {
  $('input#userName').prop('disabled', !enable);
}

function lobbyBroadcast() {
	socket.on('lobbyBroadcast', function(uName) {
		var msg = 'Attention everyone, '+uName+' is onboard!';
		setFeedback(msg);
	});
}

function appendNewMessage(msg) {
	// It is a private message to certain room
	//var html = "<span class='privMsg'>" + msg.source + " : " + msg.message + "</span><br/>";
	var html = "<li class='left clearfix'><span class='chat-img pull-left'></span><div class='chat-body clearfix'></div><div class='header'><strong class='primary-font'>" + msg.source + "</strong><small class='pull-right text-muted'></small></div><p>" + msg.message + "</p>";
	$('#msgWindow').append(html);
}

function appendNewUser(uName, notify) {
	$('#userWindow').append('<a class="user">' + uName + '</a><br />');
	if (notify && (myUserName !== uName) && (myUserName !== 'All')){
		$('span#msgWindow').append("<span class='adminMsg'>==>" + uName + " just entered the Lobby <==<br/>")
	}
	$(".user").click(function(e){
		e.preventDefault(); // prevent the default action of anchor tag
		return false;
	})
}

function appendNewRoom(rName, rId, numOfCls) {
	var arr = rName.split("_");
	var show_rName = arr[1];
	var room_label = 'Accept';

	if (typeof(show_rName) === 'undefined') {
		// the room is lobby, don't allow lobby in the queue.
		return;
	}
	if (typeof(numOfCls) === 'undefined') {
	}

	if (numOfCls == 2) {
		room_label = 'Locked';
	}

	var html = '<div class="room" id="' + show_rName + '">' +
				'<span class="name">' + show_rName + '</span>' + '  ' +
				'<span class="'+room_label.toLowerCase()+'"><input type="hidden" socket="' + rId + '"/>' + room_label + '</span>' + '  ' +
				'<span class="busy">Busy</span>' + '  ' +
				'</div>';
	$('#roomWindow').append(html);
	$(".accept").click(function(e) {
		e.stopPropagation();

		var joiner = $('#userName').val();
		var destRId = $(this).children('input').attr('socket');
		changeRoomName(rName);
		socket.emit('joinRoom', joiner, destRId);
		var notification = $('input#userName').val() + " has entered the room.";
		var userName = $('input#userName').val();
		socket.emit('notify', rId, userName, notification);

	    e.stopImmediatePropagation()
	});
}

function handleRoomClosed(rName) {
	var arr = rName.split("_");
	var show_rName = arr[1];
	$( ".room" ).remove( "#" + show_rName + "" );
}

function setFeedback(fb, color) {
	$('#feedback').css( "color", color );
	$('#feedback').text(fb).show().fadeOut(3000);
}

function reloadClients(clsList) {
	$('#userWindow').text('');
	for (var sId in clsList) {
		$('#userWindow').append('<a class="user" href="lalala/sid='+sId+'">' + clsList[sId] + '</a><br />');
	}
}

function clearChatArea() {
	$('#msgWindow').text('');
}

function setUsername() {
	myUserName = $('input#userName').val();
	socket.emit('set username', myUserName);
}

function sendMessage(roomName) {
	var trgtRoom;
	if (typeof(roomName) === 'undefined') {
		trgtRoom = $('#curRoom').text().toLowerCase();
	} else {
		trgtRoom = roomName;
	}
	socket.emit('message',
				{
					"inferSrcUser": true,
					"source": "",
					"message": $('input#msg').val(),
					"target": trgtRoom
				});
	$('input#msg').val("");
}

function setCurrentUsers(curUser, usersStr) {
	JSON.parse(usersStr).forEach(function(name) {
		if (curUser != name) {
			appendNewUser(name, false);
		}
	});
}

function changeRoomName(roomName) {
	$('#curRoom').text(roomName);
	hideBackButtonForLobby();
}

function getQueryVariable(variable) {
	var query = window.location.search.substring(1);
	var vars = query.split("&");
	for (var i=0;i<vars.length;i++) {
		var pair = vars[i].split("=");
		if (pair[0] == variable) {
			return pair[1];
		}
	}
}

function disableAllForRequester(disable) {
	if (disable == true) {
		$('#userName').css('display', 'none');
		$('#viewTranscripts').css('display', 'none');
		$('#roomWindow').css('display', 'none');
		$('#curRoom').hide();
		$('#userNameLabel').css('display', 'none');
		$('#backToLobby').css('display', 'none');
	}
}

function hideBackButtonForLobby() {
	var curRoom = $('#curRoom').text().toLowerCase();
	if (curRoom == 'lobby' || role == 'requester') {
		$('#backToLobby').css('display', 'none');
	} else {
		$('#backToLobby').show();
	}
}

function receiveMessage() {
	socket.on('message', function(msg) {
		appendNewMessage(msg);
	});
}

function keyPressSendMessage(roomName) {
	$('input#msg').keypress(function(e) {
		if (e.keyCode == 13 && $('input#msg').val() != '') {
			if (typeof(roomName) === 'undefined') {
				sendMessage();
			} else {
				sendMessage(roomName);
			}
			e.stopPropagation();
			e.stopped = true;
			e.preventDefault();
		}
	});
}

function buttonSendMessage(roomName) {
	$( "#send" ).click(function() {
		if ($('input#msg').val() != '') {
			if (typeof(roomName) === 'undefined') {
				sendMessage();
			} else {
				sendMessage(roomName);
			}
		}
	});
}

function operatorBackToLobby() {
	$('#backToLobby').click(function(e) {
		var rName = 'Lobby';
		var joiner = $('#userName').val();
		var lobby_exists = false;
		// check if Lobby exists
		socket.emit('current room list');
		socket.on('return room list', function(roomStr) {
			JSON.parse(roomStr).forEach(function(room) {
				if (room.substring(1).indexOf('lobby') >= 0) {
					lobby_exists = true;
				}
			});
			var notification = $('input#userName').val() + " has left the room.";
			var rId = $('#curRoom').text();
			var userName = $('input#userName').val();
			socket.emit('notify', rId, userName, notification);
			if (lobby_exists == true) {
				// situation 1: Lobby is still existing, just join the Lobby
				changeRoomName(rName);
				socket.emit('joinRoom', joiner, 'lobby');
			} else {
				// situation 2: Lobby is not existing, create a room Lobby
				changeRoomName(rName);
				socket.emit('joinLobby', joiner);
			}
			clearChatArea();
		});
	});
}

socket = io.connect("http://10.120.100.71:3000");

// from here functions only belong to requester
function createRoomForRequester(roomName) {
	socket.emit('createRoom', {
			"inferSrcUser": true,
			"roomName": roomName,
		});
	changeRoomName(roomName);
	$('#msgWindow').append("<strong>Please hold while one of available representatives will talk to you soon.</strong></br>");
}

function requesterCloseChatWindow() {
	$('#close').click(function(e) {
		var curRoom = $('#curRoom').text().toLowerCase();
		socket.emit('exit', curRoom);

		// close current window????????
		$('#chat').remove();
	});
}

function getNotificationWhenOperatorJoined () {
	socket.on('sendNotification', function(userName, notification, clsList) {
		$('#msgWindow').append('<strong>' + notification + '</strong><br>');
		socket.emit('set operator', userName);
	});
}

var role = getQueryVariable("role");
var username = getQueryVariable("username");

$(function() {
	if (role == 'requester') {
		enableMsgInput(true);
		disableAllForRequester(true);
		roomName = (new Date).getTime() + '_' + username;
		socket.emit('set username', username, role);
		createRoomForRequester(roomName);
		receiveMessage();
		keyPressSendMessage(roomName);
		buttonSendMessage(roomName);
		requesterCloseChatWindow();
		getNotificationWhenOperatorJoined();

	} else {
		enableMsgInput(false);
		$('#close').css('display', 'none');
		$('#backToLobby').css('display', 'none');
		lobbyBroadcast();

		socket.on('initRoomList', function(rsList, message) {
			var rId;
			$('#roomWindow').text('');
			for (var room in rsList) {
				if (room != '' && room != null) {
					var roomName = room.substring(1);
					rId = roomName;
					appendNewRoom(roomName, rId, rsList[room].length, message);
				}
			}
		});

		socket.on('switchRoom', function(rName, clsList) {
			var msg = 'you have entered room: '+rName+' !';
			setFeedback(msg);
			reloadClients(clsList);
			enableMsgInput(true);
			enableUsernameField(false);
		});

		socket.on('switchRoomBroadcast', function(uName, action, clsList) {
			var msg = uName + ' has ' + action + ' this room.';
			setFeedback(msg, 'green');
			reloadClients(clsList);
		});

		socket.on('userJoined', function(msg) {
			appendNewUser(msg.userName, true);
		});

		socket.on('roomClosed', function(rName) {
			handleRoomClosed(rName);
		});

		receiveMessage();

		socket.on('welcome', function(msg) {
			setFeedback("Username available. You can begin chatting.", "green");
			setCurrentUsers(msg.userName, msg.currentUsers)
			changeRoomName('Lobby');
			enableMsgInput(true);
			enableUsernameField(false);
		});

		socket.on('error', function(msg) {
			if (msg.userNameInUse) {
				setFeedback("Username already in use. Try another name.", "red");
			}
		});

		$('input#userName').keypress(function(e) {
			if (e.keyCode == 13) {
				setUsername();
				e.stopPropagation();
				e.stopped = true;
				e.preventDefault();
			}
		});
		keyPressSendMessage();
		buttonSendMessage();
		operatorBackToLobby();

		socket.on('getCurrentMessages', function(reply) {
			var html = html = "<span class='allMsg'>" + reply + "</span><br/>";
			$('#msgWindow').append(html);
		});

	}
});
