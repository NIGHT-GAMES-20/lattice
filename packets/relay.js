import { broadcast } from "../transport/udp.js";

/**
 * Relays a packet to other peers in the network.
 * @param {Packet} payload  
 */
export default function relay(packet) {
  if (!packet) {
    console.warn("[RELAY] No packet to relay");
    return;
  }
  // TTL == ZERO
  let ttl = packet.ttl || 0;
  if (ttl <= 0) {
    console.warn("[RELAY] TTL expired, dropping packet");
    return;
  }

  // Decrease TTL and re-broadcast
  const relayedPacket = {
    ...packet, 
    ttl: packet.ttl - 1
  };

  // Broadcast to all peers
  broadcast(relayedPacket);
}