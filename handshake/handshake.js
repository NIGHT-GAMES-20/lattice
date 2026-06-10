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
import { getUserId } from "../core/utils.js";

// In-memory handshake state for each peer
const handshakeStates = new Map();

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
export function handleHelloPhase1(packet, rinfo, type) {
    const { from, payload } = packet;
    
    // Extract nonces if present (for v2 handshake)
    const nonceA = payload.nonceA;
    
    // Verify the packet (signature check)
    // Signature Already Verified at helloHandler.js
    
    // Derive ID from public key to verify it matches
    // Identification Verified at helloHandler.js
    
    
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
    if (type == "udp") sendUDP(createHelloSynack(userId, nonceA, generateNonce() ), rinfo?.address, rinfo?.port );
    else if (type == "lan") broadcastLAN(createHelloSynack(userId, nonceA, generateNonce() ) )

    
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
    const { nonceA, nonceB, publicKey, x25519PublicKey } = payload;
    
    // Verify this is for us (we should have sent nonceA)
    const myState = handshakeStates.get(from);
    
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
    sendHelloAck(from, nonceB);
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
    const { nonceB } = payload;
    
    // Verify this is for us (we should have sent nonceB)
    const myState = handshakeStates.get(from);
    
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
    handshakeStates.delete(from);
}
/*
/**
 * Initiates a handshake as the initiator (Phase 1)
 * 
 * @param {string} targetUserId - The target peer's userId
 * @param {string} targetIp - Target IP address
 * @param {number} targetPort - Target port

export function initiateHandshake(targetUserId, targetIp, targetPort) {
    const nonceA = generateNonce();
    
    // Store state
    handshakeStates.set(targetUserId, {
        role: "INITIATOR",
        nonceA,
        createdAt: Date.now(),
        phase: "pending"
    });
    
    console.log(`[HELLO] Initiating handshake with ${targetUserId.slice(0, 16)}...`);
    
    // Send HELLO packet with nonce
    const createHello = (await import("./createHello.js")).default;
    const packet = createHello(targetUserId);
    
    // Add nonce to payload for v2 handshake
    packet.payload.nonceA = nonceA;
    
    // Re-sign with updated payload
    const signMessage = (await import("../crypto/sign.js")).default;
    packet.signature = signMessage(JSON.stringify({
        version: packet.version,
        id: packet.id,
        type: packet.type,
        from: packet.from,
        to: packet.to,
        timestamp: packet.timestamp,
        payload: packet.payload,
    }));
    
    // Send the packet
    const { sendUDP } = await import("../transport/udp.js");
    sendUDP(packet, targetIp, targetPort);
    
    console.log(`[HELLO] Phase 1 complete (HELLO sent) to ${targetUserId.slice(0, 16)}...`);
}


 * Responds to a handshake as the responder (Phase 2)
 * 
 * @param {string} initiatorId - The initiator's userId
 * @param {string} initiatorIp - Initiator IP address
 * @param {number} initiatorPort - Initiator port
 * @param {string} nonceA - The initiator's nonce (from HELLO)

export function respondToHandshake(initiatorId, initiatorIp, initiatorPort, nonceA) {
    const nonceB = generateNonce();
    
    // Store state
    handshakeStates.set(initiatorId, {
        role: "RESPONDER",
        nonceA,
        nonceB,
        createdAt: Date.now(),
        phase: "pending"
    });
    
    console.log(`[HELLO] Responding to handshake with ${initiatorId.slice(0, 16)}...`);
    
    // Send HELLO_SYNACK packet
    const createHelloSynack = (await import("./createHelloSynack.js")).default;
    const packet = createHelloSynack(initiatorId, nonceA, nonceB);
    
    // Re-sign with updated payload
    const signMessage = (await import("../crypto/sign.js")).default;
    packet.signature = signMessage(JSON.stringify({
        version: packet.version,
        id: packet.id,
        type: packet.type,
        from: packet.from,
        to: packet.to,
        timestamp: packet.timestamp,
        payload: packet.payload,
    }));
    
    // Send the packet
    const { sendUDP } = await import("../transport/udp.js");
    sendUDP(packet, initiatorIp, initiatorPort);
    
    console.log(`[HELLO] Phase 2 complete (HELLO_SYNACK sent) to ${initiatorId.slice(0, 16)}...`);
}


 * Sends HELLO_ACK as the initiator (Phase 3)
 * 
 * @param {string} targetUserId - The target peer's userId
 * @param {string} nonceB - The responder's nonce (from SYNACK)

function sendHelloAck(targetUserId, nonceB) {
    const createHelloAck = (await import("./createHelloAck.js")).default;
    const packet = createHelloAck(targetUserId, nonceB, "hello_done");
    
    // Re-sign with updated payload
    const signMessage = (await import("../crypto/sign.js")).default;
    packet.signature = signMessage(JSON.stringify({
        version: packet.version,
        id: packet.id,
        type: packet.type,
        from: packet.from,
        to: packet.to,
        timestamp: packet.timestamp,
        payload: packet.payload,
    }));
    
    // Send the packet
    const { sendUDP } = await import("../transport/udp.js");
    const { getPeerIp, getPeerPort } = await import("../peer/peerStore.js");
    
    const ip = getPeerIp(targetUserId);
    const port = getPeerPort(targetUserId);
    
    if (ip && port) {
        sendUDP(packet, ip, port);
        console.log(`[HELLO] Phase 3 complete (HELLO_ACK sent) to ${targetUserId.slice(0, 16)}...`);
    } else {
        console.warn(`[HELLO] Cannot send HELLO_ACK: no peer info for ${targetUserId.slice(0, 16)}...`);
    }
}
*/
/**
 * Cleans up expired handshake states
 */
export function cleanupExpiredHandshakes() {
    const now = Date.now();
    for (const [userId, state] of handshakeStates.entries()) {
        if (now - state.createdAt > NONCE_EXPIRY_MS) {
            handshakeStates.delete(userId);
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
export function getHandshakeState(userId) {
    return handshakeStates.get(userId) || null;
}

/**
 * Gets all active handshake states
 * 
 * @returns {Array} Array of [userId, state] pairs
 */
export function getAllHandshakeStates() {
    return [...handshakeStates.entries()];
}
