/** 
 * @fileoverview Defines custom JSDoc types for Lattice packets and related data structures.
 * 
 * This file is purely for documentation and type hinting purposes. It does not contain any executable code.
 * 
 * Lattice Packet Schema (v1):
 * 
 * @typedef {Object} Packet
 * @property {number} version     - Protocol version, currently 1
 * @property {string} id          - Unique packet ID (UUID)
 * @property {string} type        - Packet type, e.g. "HELLO" or "MESSAGE"
 * @property {string} from        - Sender's userId (SHA256 of their public key)
 * @property {string} to          - Recipient's userId, or "*" for a broadcast message
 * @property {number} timestamp   - Unix timestamp in milliseconds
 * @property {number} ttl         - Time-to-live in hops; decremented on each relay
 * @property {object} payload     - Packet-specific data, e.g. { publicKey } for HELLO or { text } for MESSAGE
 * @property {string} signature   - Base64-encoded Ed25519 signature of the packet (excluding the signature field itself)
 */

export {};