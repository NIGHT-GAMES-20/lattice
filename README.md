# Lattice - Decentralized P2P Messaging Network

A peer-to-peer messaging application that enables direct communication between nodes without requiring a central server. Built with Node.js, featuring NAT traversal, encrypted messaging, and decentralized peer discovery.

## Features

- **Decentralized Architecture**: No central server required for peer-to-peer communication
- **NAT Traversal**: Uses STUN protocol for public endpoint discovery and UDP hole punching
- **LAN Discovery**: Broadcast-based peer discovery on local networks
- **End-to-End Encryption**: ChaCha20-Poly1305 encryption with X25519 ECDH shared secrets
- **Identity Verification**: Ed25519 signatures for secure identity verification
- **Decentralized Peer Discovery**: Bootstrap server for internet-wide peer registry
- **TTL-based Relaying**: Flood routing with TTL expiration for network propagation

## Architecture

### Core Components

| Module | Purpose |
|--------|---------|
| `index.js` | Main entry point - initializes sockets, STUN, bootstrap, REPL |
| `core/events.js` | Event emitter for internal events |
| `core/utils.js` | Utility functions (user ID derivation) |
| `crypto/key.js` | Key generation (Ed25519 + X25519) |
| `crypto/dh.js` | ECDH shared secret, ChaCha20 encryption |
| `crypto/sign.js` | Ed25519 message signing |
| `packets/` | Packet creation and formatting |
| `transport/` | UDP and LAN transport layers |
| `network/` | STUN and bootstrap integration |
| `peer/` | Peer storage and management |
| `handlers/` | Packet dispatch and handling |

### Packet Types

**HELLO Packet**
- Broadcasts your public key to establish identity
- Triggers shared secret derivation (X25519)
- Initiates NAT hole punching
- Relayed to other peers via TTL-based flooding

**MESSAGE Packet**
- Encrypted (ChaCha20-Poly1305) or plaintext broadcast
- Contains ciphertext or plaintext in payload
- Encrypted messages relayed if not intended for recipient

## Quick Start

### Prerequisites

- Node.js (v16+)
- npm

### Installation

```bash
npm install
```

### Usage

1. **Start the node**:
   ```bash
   npm start
   ```

2. **Generate keys** (if needed):
   ```bash
   npm run keygen
   ```

3. **Interactive Commands** (in REPL):
   - `/peers` - List all known peers
   - `@<peer_id> <message>` - Send encrypted message to specific peer
   - `<message>` - Broadcast message to all peers

### Configuration

Keys are automatically generated on first run:
- `keys/ed25519_private.pem` - Identity signing key
- `keys/ed25519_public.pem` - Public key for identity
- `keys/x25519_private.pem` - Encryption private key
- `keys/x25519_public.pem` - Encryption public key

## Protocol Details

### Packet Schema (v1)

```json
{
  "version": 1,
  "id": "<uuid>",
  "type": "HELLO|MESSAGE",
  "from": "<userId>",
  "to": "<userId>|*",
  "timestamp": <unix_ms>,
  "ttl": 10,
  "payload": { ... },
  "signature": "<base64>"
}
```

### Security

1. **Identity Verification**: `userId = SHA256(publicKey)`
2. **Signature Verification**: Ed25519 signature of canonical JSON
3. **Encryption**: X25519 ECDH → ChaCha20-Poly1305
4. **Wire Format**: Base64-encoded nonce + ciphertext + authTag

### NAT Traversal

1. STUN query to Google's STUN servers
2. Announce public endpoint to bootstrap server
3. Send HELLO packets to known peers (hole punching)
4. LAN broadcast for local discovery

## Bootstrap Server

The project uses a public bootstrap server at:
- URL: `https://lattice-bootstrap-server.onrender.com`
- Endpoints:
  - `POST /announce` - Register your node
  - `GET /peers` - Fetch known peers

## License

GNU GPL v3.0

## Author

NIGHT-GAMES-20
