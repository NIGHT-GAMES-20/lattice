import handleHello   from "./helloHandler.js";
import handleMessage from "./messageHandler.js";

export default function dispatch(packet, rinfo) {
    switch (packet.type) {
        case "HELLO":
            handleHello(packet, rinfo);
            break;

        case "MESSAGE":
            handleMessage(packet, rinfo);
            break;

        default:
            console.warn(`[DISPATCH] Unknown packet type: "${packet.type}"`);
    }
}