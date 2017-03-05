from twisted.internet.defer import inlineCallbacks, returnValue
from twisted.logger import Logger

from autobahn.twisted.util import sleep
from autobahn.twisted.wamp import ApplicationSession
from autobahn.wamp.exception import ApplicationError


class AppSession(ApplicationSession):

    log = Logger()
    devices = {"input": {}, "output": {}}
    hostnames = {}
    routings = {}

    @inlineCallbacks
    def onJoin(self, details):
        self.log.info("Welcome to MIDI WEB ROUTER")

        @inlineCallbacks
        def device_update(host_id, device_id, device_type, device_name, device_status):
            if device_id not in self.devices[device_type][host_id].keys() and device_status:
                self.devices[device_type][host_id][device_id] = device_name
            elif device_id in self.devices[device_type][host_id].keys() and not device_status:
                del self.devices[device_type][host_id][device_id]
                routing_remove_input(host_id, device_id)
                routing_remove_output(host_id, device_id)
            self.log.info("Device Updated: [{}] {} @ {} = {}".format(device_type, device_name, host_id, device_status))
            yield self.publish(u"routings.refresh")
        yield self.subscribe(device_update, u"device.update")

        def device_list(device_type=None, host_id=None):
            if device_type is not None:
                if host_id is not None:
                    try:
                        return self.devices[device_type][host_id]
                    except:
                        return None
                else:
                    try:
                        return self.devices[device_type]
                    except:
                        return None
            else:
                return self.devices
        yield self.register(device_list, u"device.list")

        # Connection of a new host
        @inlineCallbacks
        def host_connect(host_id, host_name=None):
            if host_name is not None:
                host_update(host_id, host_name)
            else:
                host_update(host_id, "Unknown")

            self.devices["input"][host_id] = {}
            self.devices["output"][host_id] = {}

            self.log.info("{} connected".format(host_id))
            yield self.publish(u"hostlist.refresh")
        yield self.subscribe(host_connect, u"host.connect")

        # Disconnection of a host
        @inlineCallbacks
        def host_disconnect(host_id):
            if host_id in self.hostnames:
                self.log.info("{} [{}] disconnected".format(self.hostnames[host_id], host_id))

                if host_id in self.devices["input"].keys():
                    for device_id in self.devices["input"][host_id]:
                        routing_remove_input(host_id, device_id)
                    del self.devices["input"][host_id]

                if host_id in self.devices["output"].keys():
                    for device_id in self.devices["output"][host_id]:
                        routing_remove_output(host_id, device_id)
                    del self.devices["output"][host_id]

                if host_id in self.hostnames.keys():
                    del self.hostnames[host_id]

                yield self.publish(u"routings.refresh")
                yield self.publish(u"hostlist.refresh")
        yield self.subscribe(host_disconnect, u"host.disconnect")

        # Update host name for a host id
        @inlineCallbacks
        def host_update(host_id, host_name):
            self.hostnames[host_id] = host_name
            self.log.info("{} = {}".format(host_id, host_name))
            yield self.publish(u"routings.refresh")
            yield self.publish(u"hostlist.refresh")
        yield self.subscribe(host_update, u"host.update")

        # Get the list of all host names
        def host_list():
            return self.hostnames
        yield self.register(host_list, u"host.list")

        # Get the name from a host id
        def host_get_name(host_id):
            try:
                return self.hostnames[host_id]
            except:
                return host_id
        yield self.register(host_get_name, u"host.get.name")

        @inlineCallbacks
        def host_ping():
            for host in self.hostnames.keys():
                try:
                    ping = yield self.call(u"ping."+host)
                except:
                    ping = False
                finally:
                    if not ping:
                        self.console.warning("Couldn't ping host... Disconnecting "+host)
                        host_disconnect(host)
                        yield self.publish(u"routings.refresh")

        @inlineCallbacks
        def routing_set(routing):
            routing = routing.split("/")
            if routing[0] not in self.routings.keys():
                self.routings[routing[0]] = []

            if routing[1] not in [i for s in self.routings.values() for i in s]:
                self.routings[routing[0]].append(routing[1])
                yield self.publish(u"routings.refresh")
                returnValue(True)
            else:
                returnValue(False)
        yield self.register(routing_set, u"routing.set")

        @inlineCallbacks
        def routing_unset(routing):
            routing = routing.split("/")
            if routing[0] in self.routings.keys() and routing[1] in self.routings[routing[0]]:
                self.routings[routing[0]].pop(self.routings[routing[0]].index(routing[1]))
                yield self.publish(u"routings.refresh")
                returnValue(True)
            else:
                returnValue(False)
        yield self.register(routing_unset, u"routing.unset")

        # Get the list of all routings
        def routing_list():
            return self.routings
        yield self.register(routing_list, u"routing.list")

        # Remove all routings for specific input device
        def routing_remove_input(host_id, device_id):
            if host_id+"."+device_id in self.routings.keys():
                del self.routings[host_id+"."+device_id]

        # Remove all routings for specific output device
        def routing_remove_output(host_id, device_id):
            if host_id+"."+device_id in [i for s in self.routings.values() for i in s]:
                for i, o in self.routings.iteritems():
                    if host_id+"."+device_id in o:
                        self.routings[i].pop(o.index(host_id+"."+device_id))

        @inlineCallbacks
        def midi_broadcast(input_device, message):
            if input_device in self.routings.keys():
                for out in self.routings[input_device]:
                    output_id = out.split(".")[1]
                    yield self.publish("midi.listen."+out, message, output_id)
        yield self.subscribe(midi_broadcast, "midi.broadcast")

        while True:
            host_ping()
            yield sleep(5)
