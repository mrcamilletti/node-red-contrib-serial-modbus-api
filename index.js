
modbusServer = require('modbus-api-server');
modbusRequest = require('modbus-api-request');

module.exports = function (RED) {
    RED.nodes.registerType('modbus api server', modbusServer.modbusServerNode);
    RED.nodes.registerType('modbus api request', modbusRequest.modbusRequestNode);
};