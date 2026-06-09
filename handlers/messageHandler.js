import { getPeer, getSharedSecret } from "../peer/peerStore.js";
import { getPublicKey } from "../crypto/key.js";
import { getUserId } from "../core/utils.js";
import verifyPacket from "./verify.js";
import { decrypt } from "../crypto/dh.js";
import relay from "../packets/relay.js";

const MY_USER_ID = getUserId()

export default function handleMessage(packet, rinfo, type) {
    const { from, to, payload } = packet;

    if (!from || !payload) {
        console.warn("[MESSAGE] Dropped: missing fields");
        return;
    }

    const peer = getPeer(from);
    if (!peer) {
        console.warn(`[MESSAGE] Dropped: unknown sender ${from.slice(0, 12)}...`);
        return;
    }

    if (!verifyPacket(packet, peer.publicKey)) {
        console.warn(`[MESSAGE] Dropped: bad signature from ${from.slice(0, 12)}...`);
        return;
    }

    let text;
    if (payload.encrypted) {
      if (to !== MY_USER_ID) {
        console.warn(`[MESSAGE] Relayed: encrypted message not intended for us (to ${to.slice(0, 12)}...)`);
        relay(packet)
        return;
      }

        const sharedSecret = getSharedSecret(from);
        if (!sharedSecret) {
            console.warn(`[MESSAGE] No shared secret for ${from.slice(0, 12)}... — drop`);
            return;
        }
        try {
            text = decrypt(payload.ciphertext, sharedSecret);
        } catch {
            console.warn(`[MESSAGE] Decryption failed — tampered packet from ${from.slice(0, 12)}...`);
            return;
        }
    } else {
        text = payload.text;
    }

    const shortFrom = from.slice(0, 12) + "...";
    const dest      = to === "*" ? "everyone" : to.slice(0, 12) + "...";
    console.log(`\n  💬 [${shortFrom}] → [${dest}]: ${text}\n`);
}