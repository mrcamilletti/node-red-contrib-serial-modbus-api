# Serial Modbus API Server for NodeRED
[![npm version](https://badge.fury.io/js/%40mrcamilletti%2Fnode-red-contrib-serial-modbus-api.svg)](https://badge.fury.io/js/%40mrcamilletti%2Fnode-red-contrib-serial-modbus-api)

## Installation:
Requires NodeRED installed, check [here](https://nodered.org/docs/getting-started/).
```
$ cd ~/.node-red
$ npm i @mrcamilletti/node-red-contrib-serial-modbus-api
```

## Modbus request node
<b>Modbus Server</b>: Select configuration node (required) <br>
<b>msg.topic</b>: Select option to change message topic. Default: Keep </br>

## Modbus Server configuration node
<b>Port</b>: Serial device location. i.e.: /dev/ttyUSB0 <br>
<b>Settings: </b>: Baud rate, data bits, parity check and stop bits. <br>
<b>Timeout</b>: Response timeout from device request. Value in milliseconds.<br>
<b>Interval</b>: Sleep time between transactions. Value in milliseconds.<br>
<b>Queue capacity</b>: Máximum number of transactions in the queue.<br>

## Access to single and multiple devices through <modbus request> node

### Payload format for reading:
```
{ 
    "id": <number> | <Array>,
    "read" : <string> "coil" | "input" | "holding" | "discrete",
    "addr": <number>,
    "quantity": <number>
}
```
```
{ 
    "id": <number> | <Array>,
    "read" : <string> "coil" | "input" | "holding" | "discrete",
    "from": <number>,
    "to": <number>
}
```

### Payload format for writting:
```
{ 
    "id": <number> | <Array>,
    "write": <string> "coil" | "holding",
    "addr": <number>,
    "value": <Array>
}
```
### Read Coils from single device using address and quantity:
```
msg.payload = {
    id: 1,
    read: "coil",
    addr: 0,
    quantity: 5
}
```
### Read Coils from single device using from and to:
```
msg.payload = {
    id: 2,
    read: "coil",
    from: 1,
    to: 2
}
```
### Read Inputs and Holdings from single device:
```
msg.payload = {
    id: 1,
    read: "input",
    from: 0,
    to: 1
}
```
```
msg.payload = {
    id: 2,
    read: "holding",
    from: 0,
    to: 1
}
```
### Write Coils and Holdings to device 1:
```
msg.payload = {
    id: 1,
    write: "holding",
    addr: 0,
    value: [1,2,3,4]
}
```
```
msg.payload = {
    id: 1,
    write: "coil",
    addr: 0,
    value: [1,0,1,0]
}
```
### Read and Write Coils and Holdings to multiple devices:
```
msg.payload = {
    id: [1,2,5],
    write: "coil",
    addr: 0,
    value: [1,1,1,1]
}
```
```
msg.payload = {
    id: [1,2,5],
    read: "coil",
    addr: 0,
    quantity: 4
}
```
## Check responses from results and error objects

### Transaction success (first output)
```
msg.payload = {
    ...
    result: {
        "data":[ ... ],
        "buffer":[ ... ]
    }
}
```
### Transaction error (second output)
```
msg.payload = {
    ...
    error: {
        "name": "...",
        "message": "...",
        "errno": "..."
    }
}
```

## Add number of retries
In case of timeout error, the message can be pushed back to the queue a number of times specified by payload.retries

```
msg.payload = {
    ...
    retries: 5
}
```

