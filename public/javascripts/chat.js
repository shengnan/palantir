var socket;
var myUserName;

function enableCreateRoom(enable) {
	$('button#createRoom').prop('disabled', !enable);
}

function enableMsgInput(enable) {
	$('input#msg').prop('disabled', !enable);
}

function enableUsernameField(enable) {
  $('input#userName').prop('disabled', !enable);
}

function appendNewMessage(msg) {
	var html;
	if (msg.target == "All") {
		html = "<span class='allMsg'>" + msg.source + " : " + msg.message + "</span><br/>"
	} else {
		// It is a private message to certain room
		html = "<span class='privMsg'>" + msg.source + " : " + msg.message + "</span><br/>"
	}
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

function updateClientList(uName, action, clsList) {
	if (action == 'left') {
		$('a.user').each(function(index) {
			if (uName == $(this).text()) {
				// display none for now, it should have been deleted from the clientList
				$(this).css('display', 'none');
			}
		});
	} else if (action == 'joined') {
		$('#userWindow').append('<a class="user">' + uName + '</a><br />');
	}
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

// set username, meanwhile enter the lobby 
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
					"inferSrcUser": true, //false to allow anonymous sender
					"source":'', //source is detected on server side
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

function createRoom(roomName, roomType) {
	var user = $('#userName').val();
	if (roomName == ''){
		setFeedback("Please name your room first", "red");
	}else if (user == ''){
		setFeedback("Please pick up a name first", "red");
	}else{
		changeRoomName(roomName);
		socket.emit('createRoom',
				{
					"inferSrcUser": true,
					"roomName": roomName,
				});
	}
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
		$('button#createRoom').css('display', 'none');
		$('#userName').css('display', 'none');
		$('#roomWindow').css('display', 'none');
		$('#curRoom').hide();
		$('#userNameLabel').css('display', 'none');
		$('#backToLobby').css('display', 'none');
	}
}

function hideBackButtonForLobby() {
	var curRoom = $('#curRoom').text().toLowerCase();
	if (curRoom == 'lobby') {
		$('#backToLobby').css('display', 'none');
	} else {
		$('#backToLobby').show();
	}
}

socket = io.connect("http://localhost:3000");

$(function() {

	var requester_button_clicked = getQueryVariable("start_chat");
	var role = getQueryVariable("role");
	var username = getQueryVariable("username");

	if (role == 'requester') {
		enableMsgInput(true);
		disableAllForRequester(true);
		roomName = (new Date).getTime() + '_' + username;
		socket.emit('set username', username);
		socket.emit('createRoom', {
			"inferSrcUser": true,
			"roomName": roomName,
		});
		changeRoomName(roomName);
		socket.on('message', function(msg) {
			appendNewMessage(msg);
		});
		$('input#msg').keypress(function(e) {
			if (e.keyCode == 13 && $('input#msg').val() != '') {
				sendMessage(roomName);
				e.stopPropagation();
				e.stopped = true;
				e.preventDefault();
			}
		});

		$( "#send" ).click(function() {
			if ($('input#msg').val() != '') {
				sendMessage(roomName);
			}
		});

		$('#close').click(function(e) {
			var curRoom = $('#curRoom').text().toLowerCase();
			socket.emit('exit', curRoom);
			
			// close current window
		});

	} else {
		enableMsgInput(false);
		$('#close').css('display', 'none');

		socket.on('lobbyBroadcast', function(uName) {
			var msg = 'Attention everyone, '+uName+' is onboard!';
			setFeedback(msg);
		});

		socket.on('initRoomList', function(rsList) {
			var rId;
			$('#roomWindow').text('');
			for (var room in rsList) {
				if (room != '' && room != null) {
					var roomName = room.substring(1);
					rId = roomName;
					appendNewRoom(roomName, rId, rsList[room].length);
				}
			}
		});

		socket.on('switchRoom', function(rName, clsList) {
			var msg = 'you have entered room: '+rName+' !';
			setFeedback(msg);
			reloadClients(clsList);
			clearChatArea();
			enableMsgInput(true);
			enableUsernameField(false);
		});

		socket.on('switchRoomBroadcast', function(uName, action, clsList) {
			var msg = uName + ' has ' + action + 'this room.';
			setFeedback(msg, 'green');
			//updateClientList(uName, action, clsList);
			reloadClients(clsList);
		});

		// deprecated, use initRoomList instead ???
		socket.on('roomListUpdateBroadcast', function(rName, socketId) {
			appendNewRoom(rName, socketId);
		});

		socket.on('userJoined', function(msg) {
			appendNewUser(msg.userName, true);
		});

		// listener, whenever the server emits 'updatechat', this updates the chat body
		socket.on('updatechat', function(userName) {
			appendNewUser(userName, true);
			enableMsgInput(true);
			enableUsernameField(false);
		});

		socket.on('roomClosed', function(rName) {
			handleRoomClosed(rName);
		});

		socket.on('message', function(msg) {
			appendNewMessage(msg);
		});

		socket.on('welcome', function(msg) {
			setFeedback("Username available. You can begin chatting.", "green");
			setCurrentUsers(msg.userName, msg.currentUsers)
			changeRoomName('Lobby');
			enableCreateRoom(true);
			enableMsgInput(true);
			enableUsernameField(false);
		});

		socket.on('error', function(msg) {
			if (msg.userNameInUse) {
				setFeedback("Username already in use. Try another name.", "red");
			}
		});

		$('#createRoom').click(function() {
			$('#roomName').show();
			$('#roomType').show();
		});

		$('input#userName').keypress(function(e) {
			if (e.keyCode == 13) {
				setUsername();
				e.stopPropagation();
				e.stopped = true;
				e.preventDefault();
			}
		});

		$('input#msg').keypress(function(e) {
			if (e.keyCode == 13 && $('input#msg').val() != '') {
				sendMessage();
				e.stopPropagation();
				e.stopped = true;
				e.preventDefault();
			}
		});

		$( "#send" ).click(function() {
			if ($('input#msg').val() != '') {
				sendMessage();
			}
		});

		$('input#roomName').keypress(function(e) {
			var roomType = $('#roomType :selected').val();
			var roomName = $('input#roomName').val();
			if (e.keyCode == 13) {
				createRoom(roomName, roomType);
				e.stopPropagation();
				e.stopped = true;
				e.preventDefault();
				$('select#roomType').toggle();
				$('input#roomName').toggle();
			}
		});

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
				if (lobby_exists == true) {
					// situation 1: Lobby is still existing, just join the Lobby
					changeRoomName(rName);
					socket.emit('joinRoom', joiner, 'lobby');
				} else {
					// situation 2: Lobby is not existing, create a room Lobby
					changeRoomName(rName);
					socket.emit('joinLobby', joiner);
				}
			});
		});

		/*$('#close').click(function(e) {
			var curRoom = $('#curRoom').text().toLowerCase();
			socket.emit('exit', curRoom);

			// close current window
		});*/
	}
});
