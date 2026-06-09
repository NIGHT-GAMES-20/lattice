import verifyPacket from "./verify.js";
import crypto from "crypto";
import { computeShared } from "../crypto/dh.js";
import { addPeer, getPeer, touchPeer, setPeerSecret } from "../peer/peerStore.js";
import { latticeEvents } from "../core/events.js";
import relay from "../packets/relay.js";

export default function handleHello(packet, rinfo, type) {
    const { from, payload } = packet;

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

  
    // Reply directly to their observed address immediately — this is what keeps
    // the NAT hole open and lets the remote node hear back from us
    // ── Step 4: Commit to peerStore ──────────────────────────────────────────
    if (getPeer(from)) {
        touchPeer(from, rinfo?.address, rinfo?.port, type); // refresh lastSeen for a peer we already know
        console.log(`[HELLO] Refreshed: ${from.slice(0, 16)}...`);

    } else {
        addPeer(from, payload.publicKey, rinfo?.address, rinfo?.port, type);
        console.log(`[HELLO] New peer added: ${from.slice(0, 16)}...`);

        if (rinfo?.address && rinfo?.port) {
            latticeEvents.emit("punch_back", rinfo.address, rinfo.port);
        }
    }

    if (payload.x25519PublicKey) {
        const sharedSecret = computeShared(payload.x25519PublicKey);
        setPeerSecret(from, sharedSecret.toString("hex"));
        console.log(`[HELLO] Shared secret established with ${from.slice(0, 16)}...`);
    }

    // ── Step 5: Relay the HELLO to other peers ───────────────────────────────
    // We want everyone to know about this new peer, so we relay the HELLO packet as-is.
    relay(packet);

}