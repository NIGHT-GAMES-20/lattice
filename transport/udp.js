import dgram, { Socket } from "dgram";
import dispatch from "../handlers/dispatch.js";
import { networkInterfaces } from "os";
import { getUserId } from "../core/utils.js"


let udp = null;
let selfId = getUserId();

/**
 * Starts the UDP socket for listening and broadcasting messages over the Internet.
 * 
 * @param {Socket} udpSocket - Socket for Communication over the Internet
 * @param {Set} seenPackets
 */
export function initUDP(udpSocket, seenPackets) {
    udp = udpSocket;

    udp.on("message", (msg, rinfo) => {
        let packet;
        try {
            packet = JSON.parse(msg.toString());
        } catch {
            return; // ignore STUN binary frames and punch noise
        }

        if (!packet.id || !packet.from) return; // not a Lattice packet
        if (packet.from === selfId) return;
        if (seenPackets.has(packet.id)) return;
        seenPackets.add(packet.id);
        if (typeof packet.ttl !== "number" || packet.ttl < 0) return;

        console.log(`[UDP] ← ${rinfo.address}:${rinfo.port}  type=${packet.type}  id=${packet.id?.slice(0, 8)}...`);
        dispatch(packet, rinfo, "udp");
    });

    console.log("[UDP] Transport ready");
}


/**
 * Direct message to a known IP (used once we store peer IPs)
 * 
 * @param {Packet} packet - The packet to broadcast
 * @param {string} host   - The destination IP address
 * @param {Number} port - The destination Port 
 */
export function sendUDP(packet, host, port) {
    const buf = Buffer.from(JSON.stringify(packet));
    udp.send(buf, port, host, (err) => {
        if (err) console.error(`[UDP] Send error to ${host}:${port}:`, err);
    });
}