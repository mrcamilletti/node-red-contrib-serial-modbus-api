module.exports = function (RED) {
    function modbusRequestNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        // Retrieve the config node
        node.server = RED.nodes.getNode(config.server);        
        node.status({ fill: "gray", shape: "ring", text: "no server" });

        // Topic function
        node.topicfc = (msg) => {};
        switch (config.setTopic || "0") {
            case "1":
                node.topicfc = (msg) => {
                    msg.topic = "" + msg.payload.id;
                };
                break;
            case "2":
                node.topicfc = (msg) => {
                    if ("write" in msg.payload) {
                        msg.topic = "write/" + msg.payload.id;
                    } else if ("read" in msg.payload) {
                        msg.topic = "read/" + msg.payload.id;
                    }
                };
                break;
            case "3":
                node.topicfc = (msg) => {
                    if ("write" in msg.payload) {
                        msg.topic =
                            "write/" + msg.payload.id + "/" + msg.payload.write;
                    } else if ("read" in msg.payload) {
                        msg.topic =
                            "read/" + msg.payload.id + "/" + msg.payload.read;
                    }
                };
                break;
            case "4":
                node.topicfc = (msg) => {
                    if ("write" in msg.payload) {
                        msg.topic =
                            "" + msg.payload.id + "/" + msg.payload.write;
                    } else if ("read" in msg.payload) {
                        msg.topic =
                            "" + msg.payload.id + "/" + msg.payload.read;
                    }
                };
                break;
        }

        try {
            if (node.server) {
                node.server.on('port-ready', function() {
                    node.status({ fill: "green", shape: "dot", text: "connected" });
                });
                node.server.on('port-close', function() {
                    node.status({ fill: "gray", shape: "ring", text: "disconnected" });
                });
                node.server.on('port-error', function() {
                    node.status({ fill: "red", shape: "ring", text: "error" });
                });
                
                node.queue = 0;

                node.on("input", function (msg) {
                    if (!node.server.connected) {
                        msg.payload.error = {"name":"PortNotOpenError","message":"Port Not Open","errno":"ECONNREFUSED"};
                        node.send([null, msg]);
                        return;
                    }

                    if (!Array.isArray(msg.payload.id)) {
                        msg.payload.id = [msg.payload.id];
                    }

                    msg.payload.id.forEach((idx) => {
                        var tele = { ...msg.payload, id: idx };
                        node.queue++;
                        node.status({
                            fill: "green",
                            shape: "dot",
                            text: "q:" + node.queue,
                        });
                        node.server.pushTelegram(
                            tele,
                            (r) => {
                                msg.payload = r;
                                node.topicfc(msg);
                                node.send([msg, null]);
                                node.queue--;
                                node.status({
                                    fill: "green",
                                    shape: "dot",
                                    text: "q:" + node.queue,
                                });
                            },
                            (e) => {
                                msg.payload = e;
                                node.topicfc(msg);
                                node.send([null, msg]);
                                node.queue--;
                                node.status({
                                    fill: "red",
                                    shape: "dot",
                                    text: "q:" + node.queue,
                                });
                            }
                        );
                    });
                });
            } else {
                node.error("No config node selected");
            }
        } catch (e) {
            node.error(`Error: ${error}`);
        }
    }
    RED.nodes.registerType("modbus api request", modbusRequestNode);
};
