import createPacket from "./createPackets.js";
import { readFileSync } from "fs";
import { generateNonce } from "../handshake/handshake.js"


  const publicKey = readFileSync("keys/ed25519_public.pem", "utf8");
  const x25519PublicKey = readFileSync("keys/x25519_public.pem", "utf8");

/**
 * Builds a signed HELLO broadcast packet.
 * The payload carries our public key so recipients can verify our identity
 * and add us to their peerStore.
 * 
 * **Uses the v1 system**
 * i.e. No 3 way handshake, no Nonce
 * 
 * @typedef {import("../types.js").Packet} Packet
 * 
 * @param {string} userId - The sender's userId (SHA256 of their public key)
 * @return {Packet}      - The complete v1 HELLO packet object, ready to be sent over the network
 * 
 */
export function createHello(userId) {
  return createPacket("HELLO", userId, "*", { publicKey:publicKey, x25519PublicKey:x25519PublicKey });
}


/**
 * Builds a signed HELLO broadcast packet.
 * The payload carries our public key so recipients can verify our identity
 * and add us to their peerStore.
 * 
 * **Uses the v2 System**
 * i.e, 3 way handshake using HELLO, HELLO_SYNACK, HELLO_ACK
 * 
 * @typedef {import("../types.js").Packet} Packet
 * 
 * @param {string} userId - The sender's userId (SHA256 of their public key)
 * @return {Packet}      - The complete v2 HELLO packet object, ready to be sent over the network
 * 
 */
export function createHelloSyn(userId){
  return createPacket("HELLO", userId, "*", { publicKey:publicKey, x25519PublicKey:x25519PublicKey, nonceA: generateNonce() });
}