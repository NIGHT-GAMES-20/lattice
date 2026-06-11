import crypto from "crypto";
import { readFileSync } from "fs";
import { addPeer, getPeer, touchPeer, setPeerSecret } from "../peer/peerStore.js";
import verifyPacket from "../handlers/verify.js";
import { computeShared } from "../crypto/dh.js";
import relay from "../packets/relay.js";
import { sendUDP } from "../transport/udp.js"
import { broadcastLAN, sendLAN } from "../transport/lan.js";
import { latticeEvents } from "../core/events.js";
import createHelloSynack from "../packets/createHelloSynack.js"
import createHelloAck from "../packets/createHelloAck.js"
import { createHelloSyn } from "../packets/createHello.js";
import { getUserId, getUserIdFromPublicKey } from "../core/utils.js";

// In-memory handshake state for each peer
const handshakeStatesLAN = new Map();
const handshakeStatesUDP = new Map();

// Nonce expiration time (5 minutes)
const NONCE_EXPIRY_MS = 5 * 60 * 1000;

const userId = getUserId()
/**
 * State machine for handshake protocol
 * @typedef {Object} HandshakeState
 * @property {'INITIATOR'|'RESPONDER'} role - Whether this node initiated or responded
 * @property {string} nonceA - Initiator's nonce
 * @property {string} nonceB - Responder's nonce
 * @property {number} createdAt - Timestamp when handshake started
 * @property {'pending'|'synack_received'|'completed'} phase - Current handshake phase
 */

/**
 * Generates a cryptographically secure random nonce
 * @returns {string} Base64-encoded random nonce
 */
export function generateNonce() {
    return crypto.randomBytes(16).toString("base64");
}

/**
 * Checks if a nonce is still valid (not expired)
 * @param {number} createdAt - Timestamp when nonce was created
 * @returns {boolean} True if nonce is still valid
 */
function isNonceValid(createdAt) {
    return Date.now() - createdAt < NONCE_EXPIRY_MS;
}

/**
 * Handles incoming HELLO packet (Phase 1 of handshake)
 * This is called when we receive a HELLO from another peer
 * 
 * @param {object} packet - The incoming HELLO packet
 * @param {object} rinfo - Remote address info {address, port}
 * @param {string} type - Transport type ('udp' or 'lan')
 */
export function handleHelloV2(packet, rinfo, type) {
    const { from, payload } = packet;
    
    // Extract nonces if present (for v2 handshake)
    const nonceA = payload.nonceA;
    
    // ── Step 1: Basic structure checks ──────────────────────────────────────
    if (!from || typeof from !== "string") {
        console.warn("[HELLO] Dropped: missing or invalid 'from' field");
        return;
    }

    if (!payload?.publicKey || typeof payload.publicKey !== "string") {
        console.warn("[HELLO] Dropped: missing 'publicKey' in payload");
        return;
    }

    // ── Step 2: Identity verification ────────────────────────────────────────
    // Hash the supplied public key and check it matches the claimed userId.
    // Prevents an attacker from announcing a stolen ID with their own key.
    const derivedId = crypto
        .createHash("sha256")
        .update(payload.publicKey)
        .digest("hex");

    if (from !== derivedId) {
        console.warn(`[HELLO] Dropped: userId mismatch for ${from.slice(0, 12)}...`);
        return;
    }

    // ── Step 3: Signature verification ───────────────────────────────────────
    // Proves the sender actually holds the private key — not just the public key.
    if (!verifyPacket(packet, payload.publicKey)) {
        console.warn(`[HELLO] Dropped: invalid signature from ${from.slice(0, 12)}...`);
        return;
    }
    
    
    // Check if we already know this peer
    const existingPeer = getPeer(from);
    
    if (existingPeer) {
        // Refresh existing peer
        touchPeer(from, rinfo?.address, rinfo?.port, type);
        console.log(`[HELLO] Refreshed: ${from.slice(0, 16)}...`);
    } else {
        // Add new peer
        addPeer(from, payload.publicKey, rinfo?.address, rinfo?.port, type);
        console.log(`[HELLO] New peer added: ${from.slice(0, 16)}...`);
        
        // Trigger punch back
        if (rinfo?.address && rinfo?.port) {
            latticeEvents.emit("punch_back", rinfo.address, rinfo.port);
        }
    }
    
    // If X25519 key is present, compute shared secret
    if (payload.x25519PublicKey) {
        const sharedSecret = computeShared(payload.x25519PublicKey);
        setPeerSecret(from, sharedSecret.toString("hex"));
        console.log(`[HELLO] Shared secret established with ${from.slice(0, 16)}...`);
    }

    // Send HELLO_SYNACK to the initiator
    if (type == "udp") 
      sendUDP(createHelloSynack(userId, nonceA, generateNonce() ), rinfo?.address, rinfo?.port );
    else if (type == "lan") 
      sendLAN(createHelloSynack(userId, nonceA, generateNonce() ), rinfo?.address, rinfo?.port )
    
    // Relay the HELLO to other peers
    relay(packet);
}

/**
 * Handles incoming HELLO_SYNACK packet (Phase 2 of handshake)
 * This is called when we receive SYNACK as the initiator
 * 
 * @param {object} packet - The incoming HELLO_SYNACK packet
 * @param {object} rinfo - Remote address info {address, port}
 */
export function handleHelloSynack(packet, rinfo) {
    const { from, payload } = packet;
    
    // ── Step 1: Basic structure checks ──────────────────────────────────────
    if (!from || typeof from !== "string") {
        console.warn("[HELLO_SYNACK] Dropped: missing or invalid 'from' field");
        return;
    }

    if (!payload?.nonceA || !payload?.nonceB) {
        console.warn("[HELLO_SYNACK] Dropped: missing nonce fields");
        return;
    }

    // ── Step 2: Identity verification ────────────────────────────────────────
    const derivedId = crypto
        .createHash("sha256")
        .update(payload.publicKey)
        .digest("hex");

    if (from !== derivedId) {
        console.warn(`[HELLO_SYNACK] Dropped: userId mismatch for ${from.slice(0, 12)}...`);
        return;
    }

    // ── Step 3: Signature verification ───────────────────────────────────────
    if (!verifyPacket(packet, payload.publicKey)) {
        console.warn(`[HELLO_SYNACK] Dropped: invalid signature from ${from.slice(0, 12)}...`);
        return;
    }

    const { nonceA, nonceB, publicKey, x25519PublicKey } = payload;
    
    // Verify this is for us (we should have sent nonceA)
    const myState = type == "udp" ? handshakeStatesUDP.get(from) : type == "lan"  ? handshakeStatesLAN.get(rinfo?.address) : null ;
    
    if (!myState || myState.role !== "INITIATOR") {
        console.warn(`[HELLO_SYNACK] Unexpected SYNACK from ${from.slice(0, 16)}...`);
        return;
    }
    
    // Verify nonceA is echoed correctly
    if (nonceA !== myState.nonceA) {
        console.warn(`[HELLO_SYNACK] Nonce A mismatch from ${from.slice(0, 16)}...`);
        return;
    }
    
    // Verify nonceB is present and fresh
    if (!nonceB || !isNonceValid(myState.createdAt)) {
        console.warn(`[HELLO_SYNACK] Invalid or expired nonce from ${from.slice(0, 16)}...`);
        return;
    }
    
    // Update state
    myState.nonceB = nonceB;
    myState.phase = "synack_received";
    
    // Store their public keys
    const existingPeer = getPeer(from);
    if (!existingPeer) {
        addPeer(from, publicKey, rinfo?.address, rinfo?.port, "udp");
    } else {
        touchPeer(from, rinfo?.address, rinfo?.port, "udp");
    }
    
    // Compute shared secret if X25519 key provided
    if (x25519PublicKey) {
        const sharedSecret = computeShared(x25519PublicKey);
        setPeerSecret(from, sharedSecret.toString("hex"));
        console.log(`[HELLO] Shared secret established with ${from.slice(0, 16)}...`);
    }
    
    console.log(`[HELLO] Phase 2 complete (SYNACK received) from ${from.slice(0, 16)}...`);
    
    // Send HELLO_ACK (Phase 3)
    if (type == "udp") 
      sendUDP(createHelloAck(userId, nonceB), rinfo?.address, rinfo?.port );
    else if (type == "lan") 
      sendLAN(createHelloAck(userId, nonceB ), rinfo?.address, rinfo?.port )

}

/**
 * Handles incoming HELLO_ACK packet (Phase 3 of handshake)
 * This is called when we receive ACK as the responder
 * 
 * @param {object} packet - The incoming HELLO_ACK packet
 * @param {object} rinfo - Remote address info {address, port}
 */
export function handleHelloAck(packet, rinfo) {
    const { from, payload } = packet;
    
    // ── Step 1: Basic structure checks ──────────────────────────────────────
    if (!from || typeof from !== "string") {
        console.warn("[HELLO_ACK] Dropped: missing or invalid 'from' field");
        return;
    }

    if (!payload?.nonceB) {
        console.warn("[HELLO_ACK] Dropped: missing nonceB field");
        return;
    }

    // ── Step 2: Identity verification ────────────────────────────────────────
    // For HELLO_ACK, we don't require publicKey in payload since we already know the peer
    // But if present, verify it
    if (payload.publicKey) {
        const derivedId = crypto
            .createHash("sha256")
            .update(payload.publicKey)
            .digest("hex");

        if (from !== derivedId) {
            console.warn(`[HELLO_ACK] Dropped: userId mismatch for ${from.slice(0, 12)}...`);
            return;
        }
    }

    // ── Step 3: Signature verification ───────────────────────────────────────
    // Get the public key from existing peer info if available
    const peer = getPeer(from);
    const publicKey = peer?.publicKey || (payload.publicKey || null);
    
    if (!publicKey) {
        console.warn(`[HELLO_ACK] Dropped: no public key available for ${from.slice(0, 12)}...`);
        return;
    }

    if (!verifyPacket(packet, publicKey)) {
        console.warn(`[HELLO_ACK] Dropped: invalid signature from ${from.slice(0, 12)}...`);
        return;
    }

    const { nonceB } = payload;
    
    // Verify this is for us (we should have sent nonceB)
    const myState = type == "udp" ? handshakeStatesUDP.get(from) : type == "lan"  ? handshakeStatesLAN.get(rinfo?.address) : null ;
    
    if (!myState || myState.role !== "RESPONDER") {
        console.warn(`[HELLO_ACK] Unexpected ACK from ${from.slice(0, 16)}...`);
        return;
    }
    
    // Verify nonceB is echoed correctly
    if (nonceB !== myState.nonceB) {
        console.warn(`[HELLO_ACK] Nonce B mismatch from ${from.slice(0, 16)}...`);
        return;
    }
    
    // Verify state is still valid
    if (!isNonceValid(myState.createdAt)) {
        console.warn(`[HELLO_ACK] Handshake expired from ${from.slice(0, 16)}...`);
        return;
    }
    
    // Update state to completed
    myState.phase = "completed";
    
    console.log(`[HELLO] Phase 3 complete (ACK received) from ${from.slice(0, 16)}...`);
    console.log(`[HELLO] Handshake complete with ${from.slice(0, 16)}...`);
    
    // Store peer info if not already present
    const existingPeer = getPeer(from);
    if (!existingPeer) {
        addPeer(from, myState.publicKey, rinfo?.address, rinfo?.port, "udp");
    } else {
        touchPeer(from, rinfo?.address, rinfo?.port, "udp");
    }
    
    // Clean up handshake state
    if (type == "udp") handshakeStatesUDP.delete(from);
    else if (type == "lan") handshakeStatesLAN.delete(rinfo?.address);
}

/**
 * Initiates a handshake as the initiator (Phase 1)
 * 
 * @param {string} targetIp - Target IP address
 * @param {number} targetPort - Target port
*/
export function initiateHandshakeLAN(targetIp, targetPort) {
    const nonceA = generateNonce();
    
    // Store state
    handshakeStatesLAN.set(targetIp, {
        role: "INITIATOR",
        nonceA,
        createdAt: Date.now(),
        phase: "pending"
    });
    
    // Send HELLO packet with nonce
    const packet = createHelloSyn(userId, nonceA);
    
    
    // Send the packet
    sendLAN(packet, targetIp, targetPort )
    
    console.log(`[HELLO] Phase 1 complete (HELLO sent) to ${targetIp.slice(0, 8)}...`);
}

export function initiateHandshakeUDP(publickey, targetIp, targetPort) {
    const nonceA = generateNonce();
    
    let target = getUserIdFromPublicKey(publickey);

    // Store state
    handshakeStatesUDP.set(target, {
        role: "INITIATOR",
        nonceA,
        createdAt: Date.now(),
        phase: "pending"
    });
    
    // Send HELLO packet with nonce
    const packet = createHelloSyn(userId, nonceA);
    
    
    // Send the packet
    sendUDP(packet, targetIp, targetPort);
    console.log(`[HELLO] Phase 1 complete (HELLO sent) to ${targetUserId.slice(0, 16)}...`);
}

/**
 * Cleans up expired handshake states
 */
export function cleanupExpiredHandshakes() {
    const now = Date.now();
    for (const [userId, state] of handshakeStatesLAN.entries()) {
        if (now - state.createdAt > NONCE_EXPIRY_MS) {
            handshakeStatesLAN.delete(userId);
            console.log(`[HELLO] Cleaned up expired handshake with ${userId.slice(0, 16)}...`);
        }
    }
    for (const [userId, state] of handshakeStatesUDP.entries()) {
        if (now - state.createdAt > NONCE_EXPIRY_MS) {
            handshakeStatesUDP.delete(userId);
            console.log(`[HELLO] Cleaned up expired handshake with ${userId.slice(0, 16)}...`);
        }
    }
}

/**
 * Gets the current handshake state for a peer
 * 
 * @param {string} userId - The peer's userId
 * @returns {HandshakeState|null} The handshake state or null
 */
export function getHandshakeState(ip = null, id = null) {
    return id ? handshakeStatesUDP.get(id) : ip ? handshakeStatesLAN.get(ip) : null;
}

/**
 * Gets all active handshake states
 * 
 * @returns {Array} Array of [userId, state] pairs
 */
export function getAllHandshakeStates(type) {
    return {lan: [...handshakeStatesLAN.entries()] , udp: [...handshakeStatesUDP.entries()]}
}
