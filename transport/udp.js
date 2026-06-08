import dgram from "dgram";
import dispatch from "../handlers/dispatch.js";
import { networkInterfaces } from "os";

const PORT           = 41234;
const BROADCAST_ADDR = "255.255.255.255";

const socket      = dgram.createSocket({ type: "udp4", reuseAddr: true });
const seenPackets = new Set(); // deduplication — prevents processing the same packet twice

let selfId = null;

/**
 * Starts the UDP socket for listening and broadcasting messages.
 * 
 * @param {string} userId - sha256 encoded public key
 */
export function startUDP(userId) {
    selfId = userId;

    socket.on("error", (err) => {
        console.error("[UDP] Socket error:", err);
        socket.close();
    });

    socket.on("message", (msg, rinfo) => {
        let packet;

        try {
            packet = JSON.parse(msg.toString());
        } catch {
            console.warn(`[UDP] Malformed packet from ${rinfo.address} — dropping`);
            return;
        }

        // Ignore our own broadcasts (we hear ourselves on 255.255.255.255)
        if (packet.from === selfId) return;

        // Drop already-seen packets (loop prevention)
        if (seenPackets.has(packet.id)) return;
        seenPackets.add(packet.id);

        // TTL gate
        if (typeof packet.ttl !== "number" || packet.ttl <= 0) {
            console.warn(`[UDP] Packet ${packet.id?.slice(0, 8)} TTL exhausted — dropping`);
            return;
        }

        console.log(`[UDP] ← ${rinfo.address}  type=${packet.type}  id=${packet.id?.slice(0, 8)}...`);
        dispatch(packet, rinfo);
    });

    socket.on("listening", () => {
        socket.setBroadcast(true);
        console.log(`[UDP] Listening on port ${PORT}`);
    });

    socket.bind(PORT);
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
 */
export function send(packet, host) {
    const buf = Buffer.from(JSON.stringify(packet));
    socket.send(buf, PORT, host, (err) => {
        if (err) console.error(`[UDP] Send error to ${host}:`, err);
    });
}

function getSubnetBroadcasts() {
    const addrs = [];
    for (const ifaces of Object.values(networkInterfaces())) {
        for (const iface of ifaces) {
            if (iface.family === "IPv4" && !iface.internal) {
                const ip   = iface.address.split(".").map(Number);
                const mask = iface.netmask.split(".").map(Number);
                const bcast = ip.map((b, i) => (b | (~mask[i] & 255))).join(".");
                addrs.push(bcast);
            }
        }
    }
    return addrs.length ? addrs : ["255.255.255.255"]; // fallback
}