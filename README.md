# node-red-contrib-simple-modbus-api
Modbus Serial based API nodes made simple for NodeRED

# Access to single and multiple devices

## Payload format for reading:
{ 
    "id": <number> | <Array>,
    "read" : <string> "coil" | "input" | "holding" | "discrete",
    "addr": <number>,
    "quantity": <number>
}

{ 
    "id": <number> | <Array>,
    "read" : <string> "coil" | "input" | "holding" | "discrete",
    "from": <number>,
    "to": <number>
}

## Payload format for writting:
{ 
    "id": <number> | <Array>,
    "write": <string> "coil" | "holding",
    "addr": <number>,
    "value": <Array>
}

## Read Coils from single device using address and quantity:
msg.payload = {
    id: 1,
    read: "coil",
    addr: 0,
    quantity: 5
}

## Read Coils from single device using from and to:
msg.payload = {
    id: 2,
    read: "coil",
    from: 1,
    to: 2
}

## Read Inputs and Holdings from single device:
msg.payload = {
    id: 1,
    read: "input",
    from: 0,
    to: 1
}

msg.payload = {
    id: 2,
    read: "holding",
    from: 0,
    to: 1
}

## Write Coils and Holdings to device 1:
msg.payload = {
    id: 1,
    write: "holding",
    addr: 0,
    value: [1,2,3,4]
}

msg.payload = {
    id: 1,
    write: "coil",
    addr: 0,
    value: [1,0,1,0]
}

## Read and Write Coils and Holdings to multiple devices:
msg.payload = {
    id: [1,2,5],
    write: "coil",
    addr: 0,
    value: [1,1,1,1]
}

msg.payload = {
    id: [1,2,5],
    read: "coil",
    addr: 0,
    quantity: 4
}

# Check responses from results and error objects

## Transaction success (first output)
msg.payload = {
    ...
    result: {
        "data":[ ... ],
        "buffer":[ ... ]
    }
}

# Transaction error (second output)
msg.payload = {
    ...
    error: {
        "name": "...",
        "message": "...",
        "errno": "..."
    }
}