import { readFileSync } from "fs";
import { sign } from "crypto";

const BOOTSTRAP_URL = "https://lattice-bootstrap-server.onrender.com";

// Sign the announce payload — must match the server's canonical form exactly
function signAnnounce(userid, ip, port) {
    const privateKey = readFileSync("keys/ed25519_private.pem");
    const canonical  = Buffer.from(JSON.stringify({ userid, ip, port }));
    return sign(null, canonical, privateKey).toString("base64");
}

export async function announce(userId, ip, port) {
    try {
        const publicKey = readFileSync("keys/ed25519_public.pem", "utf8");
        const signature = signAnnounce(userId, ip, port);

        const res = await fetch(`${BOOTSTRAP_URL}/announce`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ userid: userId, ip, port, publicKey, signature }),
        });

        const data = await res.json();
        if (data.success) {
            console.log(`[Bootstrap] Announced → ${ip}:${port}`);
        } else {
            console.warn("[Bootstrap] Rejected:", data.error);
        }
    } catch (err) {
        console.error("[Bootstrap] Announce failed:", err.message);
    }
}

// Get the list of known peers from bootstrap
export async function fetchPeers() {
    try {
        const res   = await fetch(`${BOOTSTRAP_URL}/peers`);
        const peers = await res.json();
        console.log(`[Bootstrap] Got ${peers.length} peer(s) from bootstrap`);
        return peers; // [{ userid, ip, port, publicKey }, ...]
    } catch (err) {
        console.error("[Bootstrap] Fetch peers failed:", err.message);
        return [];
    }
}