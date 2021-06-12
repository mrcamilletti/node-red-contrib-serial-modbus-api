module.exports = function (RED) {
    function modbusRequestNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        // Retrieve the config node
        node.server = RED.nodes.getNode(config.server);

        // Retry?
        node.retries = config.retries || 1;

        // Topic function        
        switch (config.setTopic || "0") {
            case "1":
                node.setTopic = (msg) => {
                    msg.topic = `${msg.payload.id}`;
                };
                break;
            case "2":
                node.setTopic = (msg) => {
                    if ("write" in msg.payload) {
                        msg.topic = `write/${msg.payload.id}`;
                    } else if ("read" in msg.payload) {
                        msg.topic = `read/${msg.payload.id}`;
                    }
                };
                break;
            case "3":
                node.setTopic = (msg) => {
                    if ("write" in msg.payload) {
                        msg.topic = `write/${msg.payload.id}/${msg.payload.write}`;
                    } else if ("read" in msg.payload) {
                        msg.topic = `read/${msg.payload.id}/${msg.payload.read}`;
                    }
                };
                break;
            case "4":
                node.setTopic = (msg) => {
                    if ("write" in msg.payload) {
                        msg.topic = `${msg.payload.id}/${msg.payload.write}`;
                    } else if ("read" in msg.payload) {
                        msg.topic = `${msg.payload.id}/${msg.payload.read}`;
                    }
                };
                break;
            default:
                node.setTopic = (msg) => {};
        }

        node.setStatus = (message, color) => {
            this.status({
                fill: color,
                shape: "dot",
                text: (this.queue > 0) ? `in queue: ${this.queue}` : "done",
                message: message
            });
        }

        node.buildMessage = (msg, value) => {
            var resultError = "error" in value;
                        
            if ("retries" in value) {
                value.retries--;
                if (resultError) {
                    // Retry only on ETIMEDOUT 
                    if ((value.error.errno == "ETIMEDOUT") && (value.retries > 0)) {
                        delete value.error;
                        node.setStatus("Retry","yellow");
                        node.server.pushTelegram(
                            value,
                            (r) => {node.buildMessage(msg, r)},
                            (e) => {node.buildMessage(msg, e)}
                        );
                        return;
                    }
                }
            }

            msg.payload = value;
            node.setTopic(msg);

            node.send(resultError ? [null, msg] : [msg, null]);
            
            node.queue--;
            resultError ? node.setStatus("Error","red") : node.setStatus("Ok","green");
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
                        if (node.retries > 0) msg.payload.retries = node.retries;
                        var tele = { ...msg.payload, id: idx };
                        node.queue++;
                        node.setStatus("Sent","green");                        
                        node.server.pushTelegram(
                            tele,
                            (r) => {node.buildMessage(msg, r)},
                            (e) => {node.buildMessage(msg, e)}
                        );
                    });
                });
            } else {
                node.error("No config node selected");
                node.status({ fill: "gray", shape: "ring", text: "no server" });
            }
        } catch (e) {
            node.error(`Error: ${error}`);
        }
    }
    RED.nodes.registerType("modbus api request", modbusRequestNode);
};
