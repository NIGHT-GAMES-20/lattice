import { readFileSync, existsSync } from "fs";
import getUserId    from "./crypto/userId.js";
import createHello  from "./packets/createHello.js";
import { startUDP, broadcast } from "./transport/udp.js";
import readline from "readline";
import createMessage from "./packets/createMessage.js";
import { getAllPeers } from "./peer/peerStore.js";
import { announce, fetchPeers } from "./network/bootstrap.js";

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
setTimeout(async () => {
  
  //LAN
  broadcast(createHello(userId));

  // Internet — announce ourselves, then greet every known peer directly
  await announce(userId);

  const peers = await fetchPeers();
  for (const peer of peers) {
      if (peer.userid === userId) continue; // don't hello ourselves
      console.log(`[Bootstrap] Sending HELLO → ${peer.ip}:${peer.port}`);
      send(createHello(userId), peer.ip);
  }
}, 500);

// Re-announce periodically so late-joining nodes can find us
setInterval(() => broadcast(createHello(userId)), 30_000);
setInterval(async () => await announce(userId), 20 * 60 * 1000);


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
        msg = createMessage(userId, peer.id, text);
        const peerIp = getPeerIp(peer.id);
        if (peerIp) {
            send(msg, peerIp);
            console.log(`[Lattice] → direct to ${peer.id.slice(0, 12)}... @ ${peerIp}`);
        } else {
            broadcast(msg);
        }
    } else {
        // Plaintext broadcast to all
        broadcast(createMessage(userId, "*", line));
    }
});