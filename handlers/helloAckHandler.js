import verifyPacket from "./verify.js";
import crypto from "crypto";
import { getPeer, touchPeer } from "../peer/peerStore.js";
import { handleHelloAck } from "../handshake/handshake.js";

/**
 * Handles incoming HELLO_ACK packet (Phase 3 of 3-way handshake)
 * This is called when we receive ACK as the responder
 * 
 * @param {object} packet - The incoming HELLO_ACK packet
 * @param {object} rinfo - Remote address info {address, port}
 * @param {string} type - Transport type ('udp' or 'lan')
 */
export default function handleHelloAck_MSG(packet, rinfo, type) {
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

    // ── Step 4: Process handshake (Phase 3) ──────────────────────────────────
    handleHelloAck(packet, rinfo);
    
    // ── Step 5: Update peer info if needed ───────────────────────────────────
    if (peer) {
        touchPeer(from, rinfo?.address, rinfo?.port, type);
    }
}
