import createPacket from "./createPackets.js";
import { encrypt }        from "../crypto/dh.js";
import { getSharedSecret } from "../peer/peerStore.js";

export default function createMessage(fromUserId, toUserId, text) {
    const sharedSecret = toUserId !== "*" ? getSharedSecret(toUserId) : null;

    if (sharedSecret) {
        const ciphertext = encrypt(text, sharedSecret);
        return createPacket("MESSAGE", fromUserId, toUserId, { ciphertext, encrypted: true });
    }

    // Broadcast — no single shared key, stays plaintext
    return createPacket("MESSAGE", fromUserId, toUserId, { text, encrypted: false });
}