// the URL of the WAMP Router (Crossbar.io)
//
var wsuri;
if (document.location.origin == "file://") {
   wsuri = "ws://127.0.0.1:8080/ws";

} else {
   wsuri = (document.location.protocol === "http:" ? "ws:" : "wss:") + "//" +
               document.location.host + "/ws";
}

// the WAMP connection to the Router
//
var connection = new autobahn.Connection({
   url: wsuri,
   realm: "realm1"
});

// fired when connection is established and session attached
//
connection.onopen = function (session, details) {
   console.log("Connected to the router");
   session.publish("host.connect", [host_id]);
   session.publish("host.update", [host_id , host_name]);

   function ping(args) {
      return true;
   }
   session.register('ping.'+host_id, ping).then(
      function (sub) {
         console.log('register to topic ping.'+host_id);
      },
      function (err) {
         console.log('failed to register to topic ping.'+host_id, err);
      }
   );
   session.subscribe('routings.refresh', routingTable);
   session.subscribe('hostlist.refresh', hostList);
   routingTable();
}

// fired when connection was lost (or could not be established)
//
connection.onclose = function (reason, details) {
   console.log("Connection lost: " + reason);
}

// now actually open the connection
//
connection.open();

// Creation of the routing table
//
function routingTable(){
  var inputs = [];
  var host_list;
  var routing_list;
  connection.session.call("host.list").then( function(res){
    host_list = res;
  });

  connection.session.call("routing.list").then( function(res){
    routing_list = res;
  });

  // Input Devices
  connection.session.call("device.list", ["input"]).then( function(res){
    $("#remote-inputs").html("<td><div class='col-md-6'><span class='glyphicon glyphicon-arrow-down'></span> Outputs</div><div class='col-md-6 text-right'>Inputs <span class='glyphicon glyphicon-arrow-right'></span></div></td>");
    $.each(res, function(host_id, input){
        $.each(input, function(id, name){
          $("#remote-inputs").append("<th>"+ name +"<br/>@ "+ host_list[host_id] +"</th>");
          inputs.push(host_id+"."+id);
        });
    });
  });

  // Output devices
  connection.session.call("device.list", ["output"]).then( function(res){
    $("#remote-outputs").html("");
    $.each(res, function(host_id, output){
        $.each(output, function(id, name){
          $("#remote-outputs").append("<tr id='"+ host_id +"-"+ id +"'><th>"+ name +"<br/>@ "+ host_list[host_id] +"</th></tr>");
          $.each(inputs, function(i, n){
            checked = "";
            td_class = "";
            if( n in routing_list ){
              if ($.inArray(host_id +"."+ id, routing_list[n]) != -1){
                checked = " checked";
                td_class = "success";
              }
            }

            $("#"+host_id+"-"+id).append("<td class='"+td_class+"'><input type='checkbox' id='"+ id +"-"+ i +"' value='"+ n +"/"+host_id+"."+id+"'"+checked+"/></td>")

            $("#"+ id +"-"+ i).change( function() {
              td = $(this).closest('td');
              checkbox = $(this);

              if ($(this).is(':checked')) {
                connection.session.call("routing.set", [$(this).val()]).then(
                  function(res){
                    if(res){ td.addClass('success'); td.removeClass('danger'); }
                    else{ td.removeClass('success'); td.addClass('danger'); checkbox.prop('checked', false); }
                  }
                );
              } else {
                connection.session.call("routing.unset", [$(this).val()]).then(
                  function(res){
                    if(res){ td.removeClass('success'); td.removeClass('danger'); }
                    else{ td.removeClass('success'); td.removeClass('danger'); td.addClass('warning'); checkbox.prop('checked', true); }
                  }
                );
              }
            });
          });
        });
    });
  });
}

// Web MIDI Access
//
var midi = null;  // global MIDIAccess object

function onMIDISuccess( midiAccess ) {
  console.log( "MIDI ready!" );
  midi = midiAccess;  // store in the global (in real usage, would probably keep in an object instance)
  listInputsAndOutputs(midi);
}

function onMIDIFailure(msg) {
  console.log( "Failed to get MIDI access - " + msg );
}

function MIDIsend(message){
  msg = [message[0][0], message[0][1], message[0][2]];
  var output = midi.outputs.get(message[1]);
  output.send(msg);
}

navigator.requestMIDIAccess().then( onMIDISuccess, onMIDIFailure );


// Creation of the list of local MIDI Devices
//
function listInputsAndOutputs( midiAccess ) {
  $("#local-inputs").html("");
  $("#local-outputs").html("");

  var MIDIDevices = {}

  for (var entry of midiAccess.inputs) {
   var input = entry[1];
   MIDIDevices[input.id] = input;

   // Display Inputs in Local Input Devices
   $("#local-inputs").append($('<div class="checkbox"><label><input type="checkbox" value="' + input.id +'" id="input' + input.id + '">' + input.name +'</label></div>'))

   // Onclick behaviour
   $("#input" + input.id).click( function() {
     id = $(this).val();
     connection.session.publish("device.update", [host_id, id, "input", MIDIDevices[$(this).val()].name, $(this).is(':checked')]);
     if ($(this).is(':checked')) {
       $(this).parent().addClass('text-success');
       MIDIDevices[id].onmidimessage = function(event){
         connection.session.publish("midi.broadcast", [host_id + "." + event.srcElement.id, event.data]);
       }
     }
     else{
       $(this).parent().removeClass('text-success');
       midi.inputs.get(id).onmidimessage = null;
     }
   })
  }
  for (var entry of midiAccess.outputs) {
   var output = entry[1];
   MIDIDevices[output.id] = output;

   // Display Outputs in Local Output Devices
   $("#local-outputs").append($('<div class="checkbox"><label><input type="checkbox" value="' + output.id +'" id="output' + output.id + '">' + output.name +'</label></div>'))

   // Output behaviour
   $("#output" + output.id).click( function() {
     id = $(this).val();
     connection.session.publish("device.update", [host_id, id, "output", MIDIDevices[$(this).val()].name, $(this).is(':checked')]);
     if ($(this).is(':checked')) {
       connection.session.subscribe("midi.listen."+host_id+"."+id, MIDIsend);
       $(this).parent().addClass('text-success');
     }
     else{
       $(this).parent().removeClass('text-success');
     }
   })
  }
}

// Refresh the list of connected hosts
function hostList(){
  connection.session.call("host.list", []).then( function(res){
    $("#hostlist").html("");
    $.each(res, function(host_id, user){
      $("#hostlist").append("<li>"+user+"</li>");
    });
  });
}
