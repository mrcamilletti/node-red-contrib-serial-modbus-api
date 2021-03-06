module.exports = function (RED) {
    const ModbusRTU = require("modbus-serial");
    const TimerQueue = require("./timerQueue");
    const serialport = require("serialport");
    const modbusErrorCode = [
        { name: "OK", message: "No Error", errno: "OK" },
        { name: "IllegalFunction", message: "Modbus Error: Illegal Function", errno: "EMBUSILLEGALFUN" },
        { name: "IllegalDataAddr", message: "Modbus Error: Illegal Data Address", errno: "EMBUSILLEGALADD" },
        { name: "IllegalDataValue", message: "Modbus Error: Illegal Data Value", errno: "EMBUSILLEGALVAL" },
        { name: "SlaveDeviceFail", message: "Modbus Error: Slave Device Failure", errno: "EMBUSFAILSLADEV" },
        { name: "NoIdSpecified", message:"Device ID missing", errno:"ENOIDSPEC" },
        { name: "ErrorInvalidID", message: "Invalid ID",errno: "EINVALIDID" },
        { name: "AddrValueMissing", message: "Property <addr> is required", errno: "EADDRPARAM"},
        { name: "ReadFuncUnk", message: "Value of <read> property must be: coil, discrete, holding or input", errno: "EREADPARAM"},
        { name: "WriteValueMissing", message: "Property <value> is required", errno: "EWRITEPARAM"},
        { name: "WriteFuncUnk", message: "Property <write> values must be: coil | holding", errno: "EWRITEPARAM"},
        { name: "TransactionQueueError", message: "Queue capacity reached", errno: "EQUEUE"}
    ];

    function modbusServerNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.setMaxListeners(50);
        node.port = config.port;
        node.debug = config.debug || false;
        node.interval = config.interval || 5;
        node.timeout = config.timeout || 100;
        node.capacity = config.capacity || 64;
        // 'none' | 'even' | 'mark' | 'odd' | 'space';
        node.serial_options = {
            baudRate: Number(config.baudRate) || 19200,
            dataBits: Number(config.dataBits) || 8,
            stopBits: Number(config.stopBits) || 1,
            parity: config.parity || "none",
            rtscts: config.rtscts || false,
            xon: config.xon || false,
            xoff: config.xoff || false,
            bufferSize: config.bufferSize || 512,
        };

        node.connected = false;
        node.tasks = new TimerQueue(node.capacity);
        //node.tasks.debug_mode = true;   // Debug Tasks
        node.getQueueLength = () => {return node.tasks.length()};

        node.mbus = new ModbusRTU();

        sendTelegram = (service, telegram) => {
            p = new Promise(function (resolve, reject) {
                if (!("id" in telegram) || telegram.id===undefined) {
                    telegram.error = modbusErrorCode[5];
                    reject(telegram);
                    return;
                } 
                
                try {
                    service.setID(Number(telegram.id));
                } catch(error) {
                    telegram.error = modbusErrorCode[6];
                    telegram.error.details = error;
                    reject(telegram);
                }
                
                if ("read" in telegram) {
                    // --- READ --------------------------------------------------
                    if ("from" in telegram && "to" in telegram) {
                        // TODO: Check if diference is greater or equal to zero
                        telegram.addr = telegram.from;
                        telegram.quantity = telegram.to - telegram.from + 1;

                    } else if (!"addr" in telegram) {
                        telegram.error = modbusErrorCode[7];
                        reject(telegram);
                    }

                    service.actionParam = telegram.quantity || 1;

                    // Decode function and params
                    switch (telegram.read) {
                        case "coil":
                            service.actionFunction = service.readCoils;
                            break;
                        case "discrete":
                            service.actionFunction = service.readDiscreteInputs;
                            break;
                        case "holding":
                            service.actionFunction = service.readHoldingRegisters;
                            break;
                        case "input":
                            service.actionFunction = service.readInputRegisters;
                            break;
                        default:
                            telegram.error = modbusErrorCode[8];
                            reject(telegram);
                    }
                } else if ("write" in telegram) {
                    // --- WRITE -------------------------------------------------
                    if (!"value" in telegram) {
                        telegram.error = modbusErrorCode[9];
                        reject(telegram);
                    }
                    service.actionParam = telegram.value;
                    switch (telegram.write) {
                        case "coil":
                            service.actionFunction = Array.isArray(telegram.value) ? service.writeCoils : service.writeCoil;
                            break;
                        case "holding":
                            service.actionFunction = Array.isArray(telegram.value) ? service.writeRegisters : service.writeRegister;
                            break;
                        default:
                            telegram.error = modbusErrorCode[10];
                            reject(telegram);
                    }
                }

                // Execute action
                //retry(client.actionFunction(telegram.addr, client.actionParam), 3)
                service
                    .actionFunction(telegram.addr, service.actionParam)
                    .then(function (r) {
                        telegram.result = r;
                        resolve(telegram);
                    })
                    .catch(function (e) {
                        if ("modbusCode" in e) {
                            telegram.error = modbusErrorCode[e.modbusCode];
                        } else {
                            telegram.error = { ...e };
                        } 
                        reject(telegram);
                    });
            });

            return p;
        };

        node.pushTelegram = (tele, resp, error) => {
            var result = node.tasks.addTask( (done) => {
                    sendTelegram(node.mbus, tele)
                        .then((r) => {
                            resp(r);
                            done();
                        })
                        .catch((e) => {
                            error(e);
                            done();
                        });
                }, node.interval);
            if (result == false) {
                node.error("Queue capacity reached");
                error({
                    ...tele,
                    error: modbusErrorCode[11]
                });
            }
        };



        node._portConnectionReady = () => {
            if (node.reconnectTimer) {
                clearTimeout(node.reconnectTimer);
                node.reconnectTimer = null;
            }

            if (node.mbus.isOpen) {
                node.connected = true;
                node.mbus.setTimeout(node.timeout || 100);
                node.mbus._port._client.on('close', node._portClose);
                node.mbus._port._client.on('error', node._portError);
                node.log(`Modbus Server connected! (${node.port}:${node.serial_options.baudRate})`);
                node.emit('port-ready');
                return true;            
            } else {
                node._portConnectionRetry();
                return false;
            }
        }


        node._portConnectionRetry = () => {
            if (!node.connected || !node.mbus.isOpen) {
                node.warn(`Retrying connection (${node.port}:${node.serial_options.baudRate})...`);
                if (!node.reconnectTimer) node.reconnectTimer = setTimeout(node.connect, 3000);
            }
        }

        node._portClose = () => {
            node.connected = false;
            node.warn(`Serial port ${node.port} connection closed.`);
            node.emit('port-close');
            node._portConnectionRetry();
        };

        node._portError = (error) => {
            node.connected = false;
            node.error(`Serial port ${node.port} error: ${error}`);
            node.emit('port-error');
            node._portConnectionRetry();
        };

        node.connect = () => {
            node.mbus.connectRTUBuffered(
                node.port,
                node.serial_options,
                node._portConnectionReady
            );
        }

        try {
            node.connect();
        } catch (error) {
            node.error(`Error while starting the Modbus server: ${error}`);
        }

        node.on("close", (done) => {            
            if (node.reconnectTimer) {
                clearTimeout(node.reconnectTimer);
                node.reconnectTimer = null;
            }            

            node.connected = false;                        
            node.mbus._port._client.removeListener('close', node._portClose);
            node.mbus._port._client.removeListener('error', node._portError);
            
            node.tasks.clear();

            node.log("Modbus server closed.")

            node.mbus.close(() => done());
        });

        
    }
    RED.nodes.registerType("modbus api server", modbusServerNode);

    // List serial ports in node config:
    RED.httpAdmin.get("/serialports", RED.auth.needsPermission('serial.read'), function(req,res) {        
        serialport.list().then(
            ports => {
                const a = ports.map(p => p.path);
                res.json(a);
            },
            err => {
                res.json([RED._("serial.errors.list")]);
            }
        )
    });
};
