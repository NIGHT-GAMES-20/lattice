import dgram from "dgram";
import { readFileSync, existsSync } from "fs";
import getUserId    from "./crypto/userId.js";
import createHello  from "./packets/createHello.js";
import { initTransport, send, broadcast } from "./transport/udp.js";
import { announce, fetchPeers } from "./network/bootstrap.js";
import StunManager from "./network/stun.js";
import readline from "readline";
import createMessage from "./packets/createMessage.js";
import { getAllPeers, getPeerIp, getPeerPort } from "./peer/peerStore.js";
import { latticeEvents } from "./core/events.js";

if (!existsSync("keys/ed25519_private.pem")) {
    console.error("[Lattice] Keys missing. Run: node crypto/key.js");
    process.exit(1);
}

const publicKey = readFileSync("keys/ed25519_public.pem", "utf8");
const userId    = getUserId(publicKey);
const socket    = dgram.createSocket({ type: "udp4", reuseAddr: true });

console.log("[Lattice] Node starting...");
console.log(`[Lattice] ID: ${userId.slice(0, 16)}...`);

socket.bind(0, async () => {
    console.log(`[UDP] Socket bound on port ${socket.address().port}`);

    // 1 — discover public endpoint via STUN
    const stun = new StunManager(socket);
    const endpoint = await stun.start();
    console.log(`[STUN] Public endpoint: ${endpoint.ip}:${endpoint.port}`);
    if (endpoint.symmetricNat) {
        console.warn("[STUN] Symmetric NAT detected — direct punch may fail, will rely on relay");
    }

    // 2 — wire up Lattice transport on this socket
    initTransport(socket, userId);

    latticeEvents.on("punch_back", (ip, port) => {
        send(createHello(userId), ip, port);
    });

    // 3 — announce to bootstrap + greet known peers
    await announce(userId, endpoint.ip, endpoint.port);
    const peers = await fetchPeers();

    for (const peer of peers) {
        if (peer.userid === userId) continue;
        console.log(`[Punch] → ${peer.ip}:${peer.port}`);
        // Send several HELLOs rapidly — the HELLO itself punches the hole
        for (let i = 0; i < 6; i++) {
            setTimeout(() => send(createHello(userId), peer.ip, peer.port), i * 300);
        }
    }

    // 4 — LAN broadcast
    setInterval (()=>{
      broadcast(createHello(userId));
    }, 30_000)

    // 5 — re-announce every 20 min to stay in bootstrap registry
    setInterval(async () => {
        const fresh = await stun.discover(); // re-check endpoint hasn't changed
        await announce(userId, fresh.ip, fresh.port);
        broadcast(createHello(userId));
    }, 20 * 60 * 1000);
});

// REPL (same as before)
latticeEvents.on("request_hello", () => broadcast(createHello(userId)));

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (input) => {
    const line = input.trim();
    if (!line) return;

    if (line === "/peers") {
        getAllPeers().forEach(p => console.log(` • ${p.id.slice(0, 16)}...  ${p.ip}:${p.port ?? "??"}`));
        return;
    }

    if (line.startsWith("@")) {
        const [target, ...rest] = line.slice(1).split(" ");
        const text = rest.join(" ");
        const peer = getAllPeers().find(p => p.id.startsWith(target));
        if (!peer) return console.log(`[Lattice] Unknown peer: ${target}`);
        const msg = createMessage(userId, peer.id, text);
        const ip   = getPeerIp(peer.id);
        const port = getPeerPort(peer.id);
        if (ip && port) send(msg, ip, port);
        else broadcast(msg);
    } else {
        broadcast(createMessage(userId, "*", line));
    }
});