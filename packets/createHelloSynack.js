import createPacket from "./createPackets.js";
import { readFileSync } from "fs";

/**
 * Builds a HELLO_SYNACK packet for the 3-way handshake.
 * 
 * This packet is sent by the responder (B) to the initiator (A) after receiving HELLO.
 * It contains:
 * - Responder's public keys (Ed25519 + X25519)
 * - Responder's nonce (nonceB)
 * - Echoed initiator's nonce (nonceA)
 * 
 * @typedef {import("../types.js").Packet} Packet
 * 
 * @param {string} userId - The sender's userId (SHA256 of their public key)
 * @param {string} nonceA - The initiator's nonce (to be echoed)
 * @param {string} nonceB - The responder's nonce
 * @return {Packet} - The complete HELLO_SYNACK packet object
 */
export default function createHelloSynack(userId, nonceA, nonceB) {
    const publicKey = readFileSync("keys/ed25519_public.pem", "utf8");
    const x25519PublicKey = readFileSync("keys/x25519_public.pem", "utf8");
    
    return createPacket("HELLO_SYNACK", userId, "*", { 
        publicKey,
        x25519PublicKey,
        nonceA,
        nonceB
    });
}
