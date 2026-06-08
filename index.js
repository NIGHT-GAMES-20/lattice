import { readFileSync, existsSync } from "fs";
import getUserId    from "./crypto/userId.js";
import createHello  from "./packets/createHello.js";
import { startUDP, broadcast } from "./transport/udp.js";
import readline from "readline";
import createMessage from "./packets/createMessage.js";
import { getAllPeers } from "./peer/peerStore.js";

const rl = readline.createInterface({ input: process.stdin });

// Keys must exist before anything runs
if (!existsSync("keys/ed25519_private.pem") || !existsSync("keys/ed25519_public.pem") || !existsSync("keys/x25519_private.pem") || !existsSync("keys/x25519_public.pem")) {
    console.error("[Lattice] No keys found. Run: node crypto/key.js");
    process.exit(1);
}

const publicKey = readFileSync("keys/ed25519_public.pem", "utf8");
const userId    = getUserId(publicKey);

console.log("[Lattice] Node starting...");
console.log(`[Lattice] ID: ${userId.slice(0, 16)}...`);

startUDP(userId);

// Give the socket time to bind before we shout
setTimeout(() => broadcast(createHello(userId)), 500);

// Re-announce periodically so late-joining nodes can find us
setInterval(() => broadcast(createHello(userId)), 30_000);


rl.on("line", (input) => {
    const line = input.trim();
    if (!line) return;

    if (line === "/peers") {
        const peers = getAllPeers();
        if (peers.length === 0) return console.log("[Lattice] No peers yet");
        peers.forEach(p => console.log(` • ${p.id.slice(0, 16)}...`));
        return;
    }

    if (line.startsWith("@")) {
        // Direct encrypted: @<id-prefix> <message>
        const [target, ...rest] = line.slice(1).split(" ");
        const text = rest.join(" ");
        const peer = getAllPeers().find(p => p.id.startsWith(target));
        if (!peer) return console.log(`[Lattice] Unknown peer prefix: ${target}`);
        broadcast(createMessage(userId, peer.id, text));
    } else {
        // Plaintext broadcast to all
        broadcast(createMessage(userId, "*", line));
    }
});