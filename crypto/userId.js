import crypto from "crypto";
/**
 * Derives a unique user ID from a PEM-encoded Ed25519 public key.
 * 
 * @param {string} publicKey  - The PEM-encoded Ed25519 public key of the user.
 * @returns {string} A unique user ID derived from the public key, using SHA-256 hashing.
 */
export default function getUserId(publicKey) {
    const hash = crypto.createHash("sha256").update(publicKey).digest("hex");
    return hash;
}
