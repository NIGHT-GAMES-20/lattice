import crypto from "crypto";
import { readFileSync } from "fs"

const publicKey = readFileSync("keys/ed25519_public.pem", "utf8");

/**
 * Derives a unique user ID from a PEM-encoded Ed25519 public key.
 * 
 * @returns {string} A unique user ID derived from the public key, using SHA-256 hashing.
 */
export function getUserId() {
    const hash = crypto.createHash("sha256").update(publicKey).digest("hex");
    return hash;
}

export function getUserIdFromPublicKey(publicKey) {
    const hash = crypto.createHash("sha256").update(publicKey).digest("hex");
    return hash;
}

