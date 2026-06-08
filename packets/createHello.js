import createPacket from "./createPackets.js";
import { readFileSync } from "fs";

/**
 * Builds a signed HELLO broadcast packet.
 * The payload carries our public key so recipients can verify our identity
 * and add us to their peerStore.
 * 
 * @typedef {import("../types.js").Packet} Packet
 * 
 * @param {string} userId - The sender's userId (SHA256 of their public key)
 * @return {Packet}      - The complete HELLO packet object, ready to be sent over the network
 * 
 */
export default function createHello(userId) {
    const publicKey = readFileSync("keys/ed25519_public.pem", "utf8");
    const x25519PublicKey = readFileSync("keys/x25519_public.pem", "utf8");
    return createPacket("HELLO", userId, "*", { publicKey, x25519PublicKey });
}