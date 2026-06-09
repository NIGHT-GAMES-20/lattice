import handleHello   from "./helloHandler.js";
import handleMessage from "./messageHandler.js";

export default function dispatch(packet, rinfo, type) {
    switch (packet.type) {
        case "HELLO":
            handleHello(packet, rinfo, type);
            break;

        case "MESSAGE":
            handleMessage(packet, rinfo, type);
            break;

        default:
            console.warn(`[DISPATCH] Unknown packet type: "${packet.type}"`);
    }
}