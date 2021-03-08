module.exports = function (RED) {
    const ModbusRTU = require("modbus-serial");
    const TaskQueue = require("./taskQueue");
    const serialport = require("serialport");
    const util = require('util')

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
            dataBits: config.dataBits || 8,
            stopBits: config.stopBits || 1,
            parity: config.parity || "none",
            rtscts: config.rtscts || false,
            xon: config.xon || false,
            xoff: config.xoff || false,
            bufferSize: config.bufferSize || 512,
        };

        node.connected = false;
        node.tasks = new TaskQueue(node.capacity, node.interval);
        node.mbus = new ModbusRTU();

        sendTelegram = (service, telegram) => {
            p = new Promise(function (resolve, reject) {
                if (!("id" in telegram) || telegram.id===undefined) {
                    telegram.error = {"name":"NoIdSpecified","message":"Device ID missing","errno":"ENOIDSPEC"};
                    reject(telegram);
                    return;
                } 
                
                try {
                    service.setID(Number(telegram.id));
                } catch(error) {
                    telegram.error = {
                        name: "ErrorInvalidID",
                        message: "Invalid ID",
                        errno: "EINVALIDID",
                        details: error
                    }
                    reject(telegram);
                }
                
                if ("read" in telegram) {
                    // --- READ --------------------------------------------------
                    if ("from" in telegram && "to" in telegram) {
                        // TODO: Check if diference is greater or equal to zero
                        telegram.addr = telegram.from;
                        telegram.quantity = telegram.to - telegram.from + 1;
                    } else if (!"addr" in telegram) {
                        telegram.error = {
                            name: "AddrValueMissing",
                            message: "Property <addr> is required",
                            errno: "EADDRPARAM",
                        }
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
                            service.actionFunction =
                                service.readHoldingRegisters;
                            break;
                        case "input":
                            service.actionFunction = service.readInputRegisters;
                            break;
                        default:
                            telegram.error = {
                                name: "ReadFuncUnk",
                                message: "Property <read> values must be: coil | discrete | holding | input",
                                errno: "EREADPARAM",
                            }
                            reject(telegram);
                    }
                } else if ("write" in telegram) {
                    // --- WRITE -------------------------------------------------
                    if (!"value" in telegram) {
                        telegram.error = {
                            name: "WriteValueMissing",
                            message: "property <value> is required",
                            errno: "EWRITEPARAM",
                        }
                        reject(telegram);
                    }
                    service.actionParam = telegram.value;
                    switch (telegram.write) {
                        case "coil":
                            service.actionFunction = Array.isArray(
                                telegram.value
                            )
                                ? service.writeCoils
                                : service.writeCoil;
                            break;
                        case "holding":
                            service.actionFunction = Array.isArray(
                                telegram.value
                            )
                                ? service.writeRegisters
                                : service.writeRegister;
                            break;
                        default:
                            telegram.error = {
                                name: "WriteFuncUnk",
                                message: "Property <write> values must be: coil | holding",
                                errno: "EWRITEPARAM",
                            }
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
                        telegram.error = { ...e };
                        reject(telegram);
                    });
            });

            return p;
        };

        node.pushTelegram = (tele, resp, error) => {
            node.tasks.pushTask(
                (done) => {
                    sendTelegram(node.mbus, tele)
                        .then((r) => {
                            resp(r);
                            done();
                        })
                        .catch((e) => {
                            error(e);
                            done();
                        });
                },
                () => {
                    node.error("Queue capacity reached");
                    error({
                        ...tele,
                        error: {
                            name: "TransactionQueueError",
                            message: "Queue capacity reached",
                            errno: "EQUEUE",
                        },
                    });
                }
            );
        };

        try {
            node.connect = () => {
                node.mbus.connectRTUBuffered(
                    node.port,
                    node.serial_options,
                    () => {
                        node.log(`Modbus Server listening on ${node.port}:${node.serial_options.baudRate}.`);                    
                        
                        //node.log(util.inspect(node.mbus, {showHidden: false, depth: null}));

                        node.mbus.setTimeout(node.timeout || 100);
                        
                        if (node.connected || node.mbus.isOpen) {
                            node.connected = true;
                            node.emit('port-ready');
                        } else {
                            node.connected = false;
                            //node.mbus.close();
                            node.emit('port-close');
                            setTimeout(node.connect, 3000);
                        }

                        node.mbus._port._client.on('close', function() {
                            //node.error(`Serial port ${node.port} closed.`);
                            node.connected = false;
                            node.emit('port-close');
                            setTimeout(node.connect, 3000);
                        });

                        node.mbus._port._client.on('error', function(error) {
                            node.connected = false;
                            node.error(`Serial port ${node.port} error: ${error}`);
                            node.emit('port-error');
                            setTimeout(node.connect, 3000);
                        });            
                    }
                );                
            }            
            
            node.connect();

        } catch (error) {
            node.error(`Error while starting the Modbus server: ${error}`);
        }

        node.on("close", (done) => {
            node.mbus.close(() => done());
            node.connected = false;
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
