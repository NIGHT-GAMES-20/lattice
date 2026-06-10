import verifyPacket from "./verify.js";
import crypto from "crypto";
import { getPeer, touchPeer, setPeerSecret } from "../peer/peerStore.js";
import { computeShared } from "../crypto/dh.js";
import { handleHelloSynack } from "../handshake/handshake.js";

/**
 * Handles incoming HELLO_SYNACK packet (Phase 2 of 3-way handshake)
 * This is called when we receive SYNACK as the initiator
 * 
 * @param {object} packet - The incoming HELLO_SYNACK packet
 * @param {object} rinfo - Remote address info {address, port}
 * @param {string} type - Transport type ('udp' or 'lan')
 */
export default function handleHelloSynack_MSG(packet, rinfo, type) {
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

    // ── Step 4: Process handshake (Phase 2) ──────────────────────────────────
    handleHelloSynack(packet, rinfo);
    
    // ── Step 5: Store peer info if not already present ───────────────────────
    const existingPeer = getPeer(from);
    if (!existingPeer) {
        touchPeer(from, rinfo?.address, rinfo?.port, type);
    }
    
    // ── Step 6: Compute shared secret if X25519 key provided ────────────────
    if (payload.x25519PublicKey) {
        const sharedSecret = computeShared(payload.x25519PublicKey);
        setPeerSecret(from, sharedSecret.toString("hex"));
        console.log(`[HELLO_SYNACK] Shared secret established with ${from.slice(0, 16)}...`);
    }
}
