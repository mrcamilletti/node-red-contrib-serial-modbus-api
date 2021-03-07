module.exports = function (RED) {
    function modbusRequestNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        // Retrieve the config node
        node.status({ fill: "gray", shape: "ring", text: "disconnected" });
        node.server = RED.nodes.getNode(config.server);

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
                node.status({ fill: "green", shape: "dot", text: "connected" });
                node.queue = 0;
                // Do something with:
                //  this.server.host
                //  this.server.port
                node.on("input", function (msg) {
                    if (!("id" in msg.payload) || !msg.payload.id) {
                        msg.error = { name: "NoIdSpecified" };
                    } else if (!Array.isArray(msg.payload.id)) {
                        msg.payload.id = [msg.payload.id];
                    }

                    msg.payload.id.forEach((id) => {
                        var tele = { ...msg.payload, id: id };
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
