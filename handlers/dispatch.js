import handleHello   from "./helloHandler.js";
import handleHelloSynack_MSG from "./helloSynackHandler.js";
import handleHelloAck_MSG from "./helloAckHandler.js";
import handleMessage from "./messageHandler.js";

export default function dispatch(packet, rinfo, type) {

    console.log(`[DISPATCH] Recived Packed from ${(packet.from).slice(0,16)} on ${type} with msg Type ${packet.type}`)
    switch (packet.type) {
        case "HELLO":
            handleHello(packet, rinfo, type);
            break;

        case "HELLO_SYNACK":
            handleHelloSynack_MSG(packet, rinfo, type);
            break;

        case "HELLO_ACK":
            handleHelloAck_MSG(packet, rinfo, type);
            break;

        case "MESSAGE":
            handleMessage(packet, rinfo, type);
            break;

        default:
            console.warn(`[DISPATCH] Unknown packet type: "${packet.type}"`);
    }
}