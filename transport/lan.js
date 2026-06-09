import dispatch from "../handlers/dispatch.js";
import { networkInterfaces } from "os";
import { getUserId } from "../core/utils.js" ;
import { Socket } from "dgram";

const PORT           = 41234;
const BROADCAST_ADDR = "255.255.255.255";

/**
 * Socket for communication for Local net
 * @type {Socket}
 */
let lan = null;

/**
 * The User Id of the client (SHA-256 Encoded Public Key)
 * @type {String}
 */
let selfId = getUserId();

/**
 * 
 * @param {Socket} lanSocket 
 * @param {Set} seenPackets 
 */
export function initLAN(lanSocket, seenPackets){

  lan = lanSocket
  
  // Second socket purely for receiving LAN broadcasts on the known port.
  // The main socket can't listen on 41234 (it's floating)
  // subnet:41234. This socket picks those packets up.

  lan.on("message", (msg, rinfo) => {
      let packet;
      try { packet = JSON.parse(msg.toString()); }
      catch { return; }

      if (!packet.id || !packet.from) return;
      if (packet.from === selfId) return;
      if (seenPackets.has(packet.id)) return;    // shared dedup set — no double processing
      seenPackets.add(packet.id);
      if (typeof packet.ttl !== "number" || packet.ttl <= 0) return;

      console.log(`[LAN] ← ${rinfo.address}:${rinfo.port}  type=${packet.type}  id=${packet.id?.slice(0, 8)}...`);
      dispatch(packet, rinfo, "lan");
  });

}

/**
 * Direct message to a known IP (used once we store peer IPs)
 * 
 * @param {Packet} packet - The packet to broadcast
 * @param {string} host   - The destination IP address
 * @param {Number} port - The destination Port 
 */
export function sendLAN(packet, host, port) {
    const buf = Buffer.from(JSON.stringify(packet));
    lan.send(buf, port, host, (err) => {
        if (err) console.error(`[UDP] Send error to ${host}:${port}:`, err);
    });
}

/**
 * Broadcasts a packet to all peers on the network.
 * 
 * @param {Packet} packet - The packet to broadcast
 */
export function broadcastLAN(packet) {
    const buf = Buffer.from(JSON.stringify(packet));
    
    for (const addr of getSubnetBroadcasts()) {
      try{
        lan.send(buf, PORT, addr, (err) => {
            if (err) console.error(`[UDP] Broadcast error on ${addr}:`, err);
        });
      } catch {
      console.log(`[BROADCAST] Failed To send to ${addr}`)
      }
    }

    console.log(`[UDP] → broadcast  type=${packet.type}  id=${packet.id?.slice(0, 8)}...`);
}


function getSubnetBroadcasts() {
  const addrs = [];
  try{
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
  } catch {
    console.log("[BROADCAST] Failed to get subnet")
  }
    return addrs.length ? addrs : ["255.255.255.255"];
}