import stun from "stun";

const STUN_SERVERS = [
    { host: "stun.l.google.com", port: 19302 },
    { host: "stun1.l.google.com", port: 19302 },
    { host: "stun2.l.google.com", port: 19302 },
    { host: "stun3.l.google.com", port: 19302 },
    { host: "stun4.l.google.com", port: 19302 },
];

export default class StunManager {
    constructor(socket) {
        this.socket = socket;

        this.publicIP = null;
        this.publicPort = null;
        this.lastServer = null;
        this.isSymmetricNat = false;

        this.keepAliveTimer = null;
        this.refreshTimer = null;
    }

    shuffle(array) {
        return [...array].sort(() => Math.random() - 0.5);
    }

    async query(server) {
        const response = await stun.request(
            `${server.host}:${server.port}`,
            { socket: this.socket }
        );

        const addr = response.getXorAddress();

        return {
            ip: addr.address,
            port: addr.port,
            server
        };
    }

    async discover() {
        const servers = this.shuffle(STUN_SERVERS);

        const results = [];

        for (const server of servers) {
            try {
                const result = await this.query(server);

                console.log(
                    `[STUN] ${server.host} -> ${result.ip}:${result.port}`
                );

                results.push(result);

                if (results.length >= 2)
                    break;

            } catch (err) {
                console.log(
                    `[STUN] Failed ${server.host}`
                );
            }
        }

        if (results.length === 0)
            throw new Error("No STUN server responded");

        const first = results[0];

        this.publicIP = first.ip;
        this.publicPort = first.port;
        this.lastServer = first.server;

        if (results.length >= 2) {
            const second = results[1];

            this.isSymmetricNat =
                first.port !== second.port ||
                first.ip !== second.ip;
        }

        return {
            ip: this.publicIP,
            port: this.publicPort,
            symmetricNat: this.isSymmetricNat
        };
    }

    startKeepAlive(interval = 20000) {
        if (this.keepAliveTimer)
            clearInterval(this.keepAliveTimer);

        this.keepAliveTimer = setInterval(() => {

            if (!this.lastServer)
                return;

            try {
                this.socket.send(
                    Buffer.from("lattice-keepalive"),
                    this.lastServer.port,
                    this.lastServer.host
                );
            } catch {}
        }, interval);
    }

    startAutoRefresh(interval = 300000) {
        if (this.refreshTimer)
            clearInterval(this.refreshTimer);

        this.refreshTimer = setInterval(async () => {

            try {
                const result = await this.discover();

                console.log(
                    `[STUN] Refreshed ${result.ip}:${result.port}`
                );

            } catch (err) {
                console.error(
                    "[STUN] Refresh failed:",
                    err.message
                );
            }

        }, interval);
    }

    getAddress() {
        return {
            ip: this.publicIP,
            port: this.publicPort,
            symmetricNat: this.isSymmetricNat
        };
    }

    async start() {
        await this.discover();

        this.startKeepAlive();
        this.startAutoRefresh();

        return this.getAddress();
    }

    stop() {
        clearInterval(this.keepAliveTimer);
        clearInterval(this.refreshTimer);
    }
}