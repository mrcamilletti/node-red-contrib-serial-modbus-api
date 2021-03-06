module.exports = function (RED) {
    const ModbusRTU = require("modbus-serial");
    const TaskQueue = require("./taskQueue");

    function modbusServerNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        this.serial = config.serial || "/dev/ttyUSB0";
        this.debug = config.debug || false;
        // 'none' | 'even' | 'mark' | 'odd' | 'space';
        this.serial_options = {
            baudRate: config.baudRate || 19200,
            dataBits: config.dataBits || 8,
            stopBits: config.stopBits || 1,
            parity: config.parity || "none", 
            rtscts: config.rtscts || false,
            xon: config.xon || false,
            xoff: config.xoff || false,
            bufferSize: config.bufferSize || 512
        };

        this.tasks = new TaskQueue(1);
        this.mbus = new ModbusRTU();

        sendTelegram = (service, telegram) => {
            p = new Promise(function (resolve, reject) {
                service.setTimeout(telegram.timeout || 100);
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
                            service.actionFunction = service.readHoldingRegisters;
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
            this.tasks.pushTask((done) => {
                sendTelegram(this.mbus,tele)
                    .then((r) => {
                        resp(r);
                        done();
                    })
                    .catch((e) => {
                        error(e);
                        done();
                    });
            });
        };

        try {
            node.serial_options.baudRate = 19200; //test
            this.mbus.connectRTUBuffered(node.serial, node.serial_options, () => {
                node.log(
                    `Modbus Server listening on ${node.serial}:${node.serial_options.baudRate}.`
                );
            });
        } catch (error) {
            node.error(`Error while starting the Modbus server: ${error}`);
        }

        node.on("close", (done) => {
            this.mbus.close(() => done());
        });
    }
    RED.nodes.registerType("modbus api server", modbusServerNode);
};
