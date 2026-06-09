import dgram from "dgram";
import dispatch from "../handlers/dispatch.js";
import { networkInterfaces } from "os";

const PORT           = 41234;
const BROADCAST_ADDR = "255.255.255.255";
const seenPackets = new Set(); // deduplication — prevents processing the same packet twice

let socket = null;
let selfId = null;

/**
 * Starts the UDP socket for listening and broadcasting messages.
 * 
 * @param {string} userId - sha256 encoded public key
 */
export function initTransport(udpSocket, userId) {
    socket = udpSocket;
    selfId = userId;

    socket.on("message", (msg, rinfo) => {
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
        if (typeof packet.ttl !== "number" || packet.ttl <= 0) return;

        console.log(`[UDP] ← ${rinfo.address}:${rinfo.port}  type=${packet.type}  id=${packet.id?.slice(0, 8)}...`);
        dispatch(packet, rinfo);
    });

    console.log("[UDP] Transport ready");
}

/**
 * Broadcasts a packet to all peers on the network.
 * 
 * @param {Packet} packet - The packet to broadcast
 */
export function broadcast(packet) {
    const buf = Buffer.from(JSON.stringify(packet));

    for (const addr of getSubnetBroadcasts()) {
        socket.send(buf, PORT, addr, (err) => {
            if (err) console.error(`[UDP] Broadcast error on ${addr}:`, err);
        });
    }

    console.log(`[UDP] → broadcast  type=${packet.type}  id=${packet.id?.slice(0, 8)}...`);
}
/**
 * Direct message to a known IP (used once we store peer IPs)
 * 
 * @param {Packet} packet - The packet to broadcast
 * @param {string} host   - The destination IP address
 * @param {Number} port - The destination Port 
 */
export function send(packet, host, port) {
    const buf = Buffer.from(JSON.stringify(packet));
    socket.send(buf, port, host, (err) => {
        if (err) console.error(`[UDP] Send error to ${host}:${port}:`, err);
    });
}

function getSubnetBroadcasts() {
    const addrs = [];
    for (const ifaces of Object.values(networkInterfaces())) {
        for (const iface of ifaces) {
            if (iface.family === "IPv4" && !iface.internal) {
                const ip    = iface.address.split(".").map(Number);
                const mask  = iface.netmask.split(".").map(Number);
                const bcast = ip.map((b, i) => (b | (~mask[i] & 255))).join(".");

                if (bcast === iface.address) continue; // ← skip /32 (Tailscale, VPN, etc.)

                addrs.push(bcast);
            }
        }
    }
    return addrs.length ? addrs : ["255.255.255.255"];
}