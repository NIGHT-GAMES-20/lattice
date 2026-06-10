/** 
 * @fileoverview Defines custom JSDoc types for Lattice packets and related data structures.
 * 
 * This file is purely for documentation and type hinting purposes. It does not contain any executable code.
 * 
 * Lattice Packet Schema (v2):
 * 
 * @typedef {Object} Packet
 * @property {number} version     - Protocol version, currently 2
 * @property {string} id          - Unique packet ID (UUID)
 * @property {string} type        - Packet type: "HELLO", "HELLO_SYNACK", "HELLO_ACK", or "MESSAGE"
 * @property {string} from        - Sender's userId (SHA256 of their public key)
 * @property {string} to          - Recipient's userId, or "*" for a broadcast message
 * @property {number} timestamp   - Unix timestamp in milliseconds
 * @property {number} ttl         - Time-to-live in hops; decremented on each relay
 * @property {object} payload     - Packet-specific data
 * @property {string} signature   - Base64-encoded Ed25519 signature of the packet (excluding the signature field itself)
 * 
 * Packet Payload Types:
 * 
 * HELLO: { publicKey, x25519PublicKey, nonceA? }
 * - publicKey: Ed25519 public key (PEM format)
 * - x25519PublicKey: X25519 public key for ECDH (PEM format)
 * - nonceA: (optional) Initiator's nonce for v2 handshake
 * 
 * HELLO_SYNACK: { publicKey, x25519PublicKey, nonceA, nonceB }
 * - publicKey: Ed25519 public key (PEM format)
 * - x25519PublicKey: X25519 public key for ECDH (PEM format)
 * - nonceA: Echoed initiator's nonce
 * - nonceB: Responder's nonce
 * 
 * HELLO_ACK: { nonceB, encryptedPayload? }
 * - nonceB: Echoed responder's nonce
 * - encryptedPayload: (optional) Encrypted payload using shared secret
 * 
 * MESSAGE: { text, encrypted? } or { ciphertext, encrypted: true }
 * - text: Plaintext message (for broadcast)
 * - ciphertext: Encrypted message (for direct messages)
 * - encrypted: Boolean indicating if message is encrypted
 */

export {};