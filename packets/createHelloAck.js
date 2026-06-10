import createPacket from "./createPackets.js";
import { encrypt } from "../crypto/dh.js";
import { getSharedSecret } from "../peer/peerStore.js";

/**
 * Builds a HELLO_ACK packet for the 3-way handshake finalization.
 * 
 * This packet is sent by the initiator (A) to confirm the handshake.
 * It contains:
 * - Echoed responder's nonce (nonceB)
 * - Optional encrypted "hello_done" payload (using shared secret)
 * 
 * @typedef {import("../types.js").Packet} Packet
 * 
 * @param {string} userId - The sender's userId (SHA256 of their public key)
 * @param {string} nonceB - The responder's nonce (to be echoed back)
 * @param {string} [encryptedPayload] - Optional encrypted payload (e.g., "hello_done")
 * @return {Packet} - The complete HELLO_ACK packet object
 */
export default function createHelloAck(userId, nonceB, encryptedPayload = null) {
    const payload = { nonceB };
    
    if (encryptedPayload) {
        const sharedSecret = getSharedSecret(userId);
        if (sharedSecret) {
            const ciphertext = encrypt(encryptedPayload, sharedSecret);
            payload.encryptedPayload = ciphertext;
        }
    }
    
    return createPacket("HELLO_ACK", userId, "*", payload);
}
