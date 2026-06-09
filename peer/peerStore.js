// BUG FIX: added readFileSync to the import (was missing, caused runtime crash in loadPeers)
// BUG FIX: changed to named exports so helloHandler's { addPeer, getPeer } destructuring works
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

const PEERS_DIR  = "peer";
const PEERS_FILE = "peer/peers.json";
const STALE_MS   = 24 * 60 * 60 * 1000; // 24 hours

const peers = new Map();

// ─── Writes ───────────────────────────────────────────────────────────────────

export function addPeer(userId, publicKey, ip, port) {
    peers.set(userId, { publicKey, ip , port , lastSeen: Date.now() });
    _persist();
}

export function touchPeer(userId, ip, port) {
    const peer = peers.get(userId);
    if (peer) {
        peer.lastSeen = Date.now();
        if (ip) peer.ip = ip;
        if (port) peer.port = port;
        _persist();
    }
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export function getPeer(userId) {
    _hydrate();
    return peers.get(userId) ?? null;
}

export function getAllPeers() {
    _hydrate();
    return [...peers.entries()].map(([id, peer]) => ({ id, ...peer }));
}

export function getPeerIp(userId) {
    _hydrate();
    return peers.get(userId)?.ip ?? null;
}

export function getPeerPort(userId) {
    _hydrate();
    return peers.get(userId)?.port ?? null;
}

// ─── Maintenance ──────────────────────────────────────────────────────────────

export function cleanPeers() {
    const cutoff = Date.now() - STALE_MS;
    for (const [userId, peer] of peers.entries()) {
        if (peer.lastSeen < cutoff) peers.delete(userId);
    }
    _persist();
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _persist() {
    try {
        if (!existsSync(PEERS_DIR)) mkdirSync(PEERS_DIR, { recursive: true });
        const data = [...peers.entries()];
        writeFileSync(PEERS_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("[PeerStore] Failed to persist:", err.message);
    }
}

function _hydrate() {
    if (!existsSync(PEERS_FILE)) return;
    try {
        const raw = JSON.parse(readFileSync(PEERS_FILE, "utf8"));
        for (const [userId, peer] of raw) {
            if (!peers.has(userId)) peers.set(userId, peer);
        }
    } catch {
        // Corrupted file — start fresh in memory
    }
}

// ---- SharedSecret --------------------------------------------

export function setPeerSecret(userId, sharedSecretHex) {
    const peer = peers.get(userId);
    if (peer) {
        peer.sharedSecretHex = sharedSecretHex;
        _persist();
    }
}

export function getSharedSecret(userId) {
    _hydrate(); 
    const peer = peers.get(userId);
    if (!peer?.sharedSecretHex) return null;
    return Buffer.from(peer.sharedSecretHex, "hex");
}