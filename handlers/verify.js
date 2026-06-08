import crypto from "crypto";

/**
 * Verifies a packet's Ed25519 signature.
 *
 * The canonical signing payload is the full packet JSON with the signature
 * field zeroed out — so the signed bytes are deterministic and reproducible
 * by any peer without needing to strip fields.
 *
 * @param {object} packet      - The full packet object (must include .signature)
 * @param {string} publicKeyPem - PEM-encoded Ed25519 public key of the claimed sender
 * @returns {boolean}
 */
export default function verifyPacket(packet, publicKeyPem) {
    const { signature } = packet;
    if (!signature) return false;

    const canonical = Buffer.from(JSON.stringify({
        version:   packet.version,
        id:        packet.id,
        type:      packet.type,
        from:      packet.from,
        to:        packet.to,
        timestamp: packet.timestamp,
        payload:   packet.payload,
    }));

    try {
        return crypto.verify(
            null,
            canonical,
            publicKeyPem,
            Buffer.from(signature, "base64")
        );
    } catch {
        // Malformed key or signature bytes
        return false;
    }
}