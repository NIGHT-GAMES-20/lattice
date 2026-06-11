import dgram from "dgram";
import { readFileSync, existsSync } from "fs";
import { getUserId } from "./core/utils.js";
import { createHello, createHelloSyn } from "./packets/createHello.js";
import { sendUDP, initUDP } from "./transport/udp.js";
import { announce, fetchPeers } from "./network/bootstrap.js";
import StunManager from "./network/stun.js";
import readline from "readline";
import createMessage from "./packets/createMessage.js";
import { getAllPeers, getPeerIp, getPeerPort, getPeerType } from "./peer/peerStore.js";
import { latticeEvents } from "./core/events.js";
import { generateKeys } from "./crypto/key.js";
import { initLAN, sendLAN, broadcastLAN, getSubnetBroadcasts } from "./transport/lan.js";
import { initiateHandshakeLAN } from "./handlers/handshake.js";

if (!existsSync("keys/ed25519_private.pem")) {
    console.warn("[Lattice] Keys missing. Creating New Pairs");
    generateKeys()
}

const userId    = getUserId();
const udpSocket    = dgram.createSocket({ type: "udp4", reuseAddr: true });
const lanSocket    = dgram.createSocket({ type: "udp4", reuseAddr: true });
const seenPackets = new Set()

console.log("[Lattice] Node starting...");
console.log(`[Lattice] ID: ${userId.slice(0, 16)}...`);

udpSocket.bind(0, async () => {
    console.log(`[UDP] Socket bound on port ${udpSocket.address().port}`);

    // 1 — discover public endpoint via STUN
    const stun = new StunManager(udpSocket);
    const endpoint = await stun.start();
    console.log(`[STUN] Public endpoint: ${endpoint.ip}:${endpoint.port}`);
    if (endpoint.symmetricNat) {
        console.warn("[STUN] Symmetric NAT detected — direct punch may fail, will rely on relay");
    }

    // 2 — wire up Lattice transport on this socket
    initUDP(udpSocket, seenPackets);

    latticeEvents.on("punch_back", (ip, port) => {
        sendUDP(createHello(userId), ip, port);
    });

    // 3 — announce to bootstrap + greet known peers
    await announce(userId, endpoint.ip, endpoint.port);
    const peers = await fetchPeers();

    for (const peer of peers) {
        if (peer.userid === userId) continue;
        console.log(`[Punch] → ${peer.ip}:${peer.port}`);
        // Send several HELLOs rapidly — the HELLO itself punches the hole
        for (let i = 0; i < 6; i++) {
            setTimeout(() => sendUDP(createHello(userId), peer.ip, peer.port), i * 300);
        }
    }

    // 4 — re-announce every 20 min to stay in bootstrap registry
    setInterval(async () => {
        const fresh = await stun.discover(); // re-check endpoint hasn't changed
        await announce(userId, fresh.ip, fresh.port);
    }, 20 * 60 * 1000);
});

lanSocket.bind(41234, async () => {
    console.log(`[LAN] Socket bound on port ${lanSocket.address().port}`);

    lanSocket.setBroadcast(true);

    // 1 — wire up Lattice transport on this socket
    initLAN(lanSocket, seenPackets);
    
    // v1
    //broadcastLAN(createHello(userId));

    //v2
    for (const addr of getSubnetBroadcasts())
      initiateHandshakeLAN(addr, 41234);

    // 2 — LAN broadcast
    setInterval (()=>{
      // v1
      //broadcastLAN(createHello(userId));

      //v2
      for (const addr of getSubnetBroadcasts())
        initiateHandshakeLAN(addr, 41234)
    }, 30_000)

});


// REPL (same as before)

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
        if (ip && port){
          if (getPeerType(peer.id) == "lan") sendLAN(msg, ip, port);
          else if (getPeerType(peer.id) == "udp") sendUDP(msg, ip, port);
        }
        else {
          if (getPeerType(peer.id) == "lan") broadcast(msg);
        }
    } else {
        broadcastLAN(createMessage(userId, "*", line));
    }
});