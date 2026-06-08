import crypto from "crypto";
import { readFileSync } from "fs";

// Load our X25519 private key once at startup
const x25519Private = crypto.createPrivateKey(readFileSync("keys/x25519_private.pem"));

/**
 * ECDH — compute shared secret from our private key + their X25519 public key PEM.
 * Returns a 32-byte Buffer. Never transmitted — both sides derive it independently.
 */
export function computeShared(theirX25519PubPem) {
    const theirPublicKey = crypto.createPublicKey(theirX25519PubPem);
    return crypto.diffieHellman({ privateKey: x25519Private, publicKey: theirPublicKey });
}

/**
 * Encrypt plaintext with ChaCha20-Poly1305.
 * Wire format (base64): [ nonce:12 | ciphertext | authTag:16 ]
 */
export function encrypt(plaintext, sharedSecret) {
    const nonce  = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("chacha20-poly1305", sharedSecret, nonce, { authTagLength: 16 });

    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag    = cipher.getAuthTag();

    return Buffer.concat([nonce, ciphertext, authTag]).toString("base64");
}

/**
 * Decrypt. Throws if the authTag doesn't match (tampered or wrong key).
 */
export function decrypt(b64, sharedSecret) {
    const buf        = Buffer.from(b64, "base64");
    const nonce      = buf.subarray(0, 12);
    const authTag    = buf.subarray(buf.length - 16);
    const ciphertext = buf.subarray(12, buf.length - 16);

    const decipher = crypto.createDecipheriv("chacha20-poly1305", sharedSecret, nonce, { authTagLength: 16 });
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}