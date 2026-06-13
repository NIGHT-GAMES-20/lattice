# Bootstrap Server

The official Lattice bootstrap server is used only for peer discovery and initial network bootstrapping.

## Data Stored
The bootstrap server stores only the minimum information required for peer discovery:

- Public Key
- User ID (SHA-256 hash of the public key)
- IP Address
- Port
- Last Seen Timestamp

## Data Not Stored

The bootstrap server does not store or touch:

- Messages
- Files
- Images
- Videos
- Chat history
- Content metadata
- Search history
- User profiles
- Email addresses
- Phone numbers
- Passwords

## Server Responsibilities

#### The bootstrap server:

- Registers active nodes
- Maintains a list of reachable peers
- Returns peer information to clients for network discovery
- Helps new nodes join the network

#### The bootstrap server does not:

- Relay peer traffic
- Participate in conversations
- Inspect message contents
- Store user-generated content
- Perform content indexing
- Act as a central authority over the network

## Privacy Notice

Lattice is a peer-to-peer network. To enable direct peer connections, a node's IP address and port may be shared with other peers participating in the network.

The bootstrap server only stores the information necessary for peer discovery and network operation.

## Open Source

The Lattice protocol, clients, and official bootstrap server are open source. Anyone may inspect the implementation, run their own bootstrap server, or build alternative clients compatible with the protocol.

## Abuse and Illegal Activity

Lattice is intended for lawful use. The official bootstrap server functions solely as a peer discovery service and does not host, store, relay, or inspect user content.

Users are solely responsible for the content they create, transmit, or receive through the network.