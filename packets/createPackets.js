import { randomUUID } from "crypto";
import signMessage from "../crypto/sign.js";

/**
 * Creates a signed Lattice packet.
 *
 * Signing process:
 *   1. Build the packet object with signature: ""
 *   2. Sign JSON.stringify(packet) — the canonical form with a blank signature
 *   3. Store the real signature back in the object
 *
 * Verification mirrors this: zero out the signature field, re-stringify, verify.
 *
 * Packet schema (v1):
 * {
 *   version:   1,
 *   id:        "<uuid>",         // unique per packet — used for deduplication
 *   type:      "HELLO|MESSAGE",
 *   from:      "<userId>",       // SHA256(publicKey) of sender
 *   to:        "<userId>|*",     // recipient userId, or "*" for broadcast
 *   timestamp: <unix ms>,
 *   ttl:       <hops>,           // decremented on each relay; drop at 0
 *   payload:   { ... },
 *   signature: "<base64>"        // Ed25519 signature of the above
 * }
 * 
 * @typedef {import("../types.js").Packet} Packet
 *  
 * @param {string} type    - Packet type, e.g. "HELLO" or "MESSAGE"
 * @param {string} from    - Sender's userId (SHA256 of their public key)
 * @param {string} to      - Recipient's userId, or "*" for a broadcast message
 * @param {object} payload - Packet-specific data, e.g. { publicKey } for HELLO or { text } for MESSAGE
 * @return {Packet}        - The complete packet object, ready to be sent over the network
 * 
 */

export default function createPacket(type, from, to, payload) {
    const packet = {
        version:   1,
        id:        randomUUID(),
        type,
        from,
        to,
        timestamp: Date.now(),
        ttl:       10,
        payload,
        signature: "",
    };

    packet.signature = signMessage(JSON.stringify({
        version:   packet.version,
        id:        packet.id,
        type:      packet.type,
        from:      packet.from,
        to:        packet.to,
        timestamp: packet.timestamp,
        payload:   packet.payload,
    }));

    return packet;
}