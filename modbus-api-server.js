module.exports = function (RED) {
    const ModbusRTU = require("modbus-serial");
    const TaskQueue = require("./taskQueue");
    const serialport = require("serialport");
    
    function modbusServerNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        this.port = config.port;
        this.debug = config.debug || false;
        this.interval = config.interval || 5;
        this.timeout = config.timeout || 100;
        this.capacity = config.capacity || 64;
        // 'none' | 'even' | 'mark' | 'odd' | 'space';
        this.serial_options = {
            baudRate: Number(config.baudRate) || 19200,
            dataBits: config.dataBits || 8,
            stopBits: config.stopBits || 1,
            parity: config.parity || "none",
            rtscts: config.rtscts || false,
            xon: config.xon || false,
            xoff: config.xoff || false,
            bufferSize: config.bufferSize || 512,
        };

        this.tasks = new TaskQueue(this.capacity, this.interval);
        this.mbus = new ModbusRTU();

        sendTelegram = (service, telegram) => {
            p = new Promise(function (resolve, reject) {
                service.setID(telegram.id || 1);

                if ("read" in telegram) {
                    // Check all the vars...
                    if ("from" in telegram && "to" in telegram) {
                        // TODO: Check if diference is greater or equal to zero
                        telegram.addr = telegram.from;
                        telegram.quantity = telegram.to - telegram.from + 1;
                    }

                    // Decode function and params
                    service.actionParam = telegram.quantity || 1;
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
                    }
                } else if ("write" in telegram) {
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
                        // if ((e.name == 'TransactionTimedOutError') && (telegram.retries || 0 > 0)) {
                        //   telegram.retries--;
                        //   setImmediate( () => {
                        //     sendTelegram(telegram)
                        //   });
                        // } else {
                        //   telegram.error = {...e};
                        // }
                        telegram.error = { ...e };
                        reject(telegram);
                    });
            });

            return p;
        };

        this.pushTelegram = (tele, resp, error) => {
            this.tasks.pushTask(
                (done) => {
                    sendTelegram(this.mbus, tele)
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
            this.mbus.connectRTUBuffered(
                node.port,
                node.serial_options,
                () => {
                    node.log(
                        `Modbus Server listening on ${node.port}:${node.serial_options.baudRate}.`
                    );
                    this.mbus.setTimeout(node.timeout || 100);
                }
            );
        } catch (error) {
            node.error(`Error while starting the Modbus server: ${error}`);
        }

        node.on("close", (done) => {
            this.mbus.close(() => done());
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
