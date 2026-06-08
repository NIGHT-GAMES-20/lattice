import handleHello   from "./helloHandler.js";
import handleMessage from "./messageHandler.js";

export default function dispatch(packet) {
    switch (packet.type) {
        case "HELLO":
            handleHello(packet);
            break;

        case "MESSAGE":
            handleMessage(packet);
            break;

        default:
            console.warn(`[DISPATCH] Unknown packet type: "${packet.type}"`);
    }
}