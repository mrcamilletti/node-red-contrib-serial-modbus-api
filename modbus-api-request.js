module.exports = function(RED) {
    function modbusRequestNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

         // Retrieve the config node
         this.status({fill:"gray",shape:"ring",text:"disconnected"});
         this.server = RED.nodes.getNode(config.server);

        if (this.server) {
            this.status({fill:"green",shape:"dot",text:"connected"});
            this.queue = 0;
            // Do something with:
            //  this.server.host
            //  this.server.port
            node.on('input', function(msg) {
                if ( !("id" in msg.payload) || !msg.payload.id) {
                    msg.error = {"name": "NoIdSpecified"};
                } else if (!Array.isArray(msg.payload.id)) {
                    msg.payload.id = [msg.payload.id];
                }

                msg.payload.id.forEach((id) => {
                    var tele = {...msg.payload, id: id};
                    this.queue++;
                    this.status({fill:"green",shape:"dot",text:"q:"+this.queue});
                    this.server.pushTelegram(tele, 
                        (r) => {
                            msg.payload = r;
                            node.send(msg);
                            this.queue--;
                            this.status({fill:"green",shape:"dot",text:"q:"+this.queue});
                        },
                        (e) => {
                            msg.payload = e;
                            node.send(msg);
                            this.queue--;
                            this.status({fill:"red",shape:"dot",text:"q:"+this.queue});
                        }
                )});
            });
        } else {
            node.error('No config node configured');            
        }       
    }
    RED.nodes.registerType("modbus api request",modbusRequestNode);
}