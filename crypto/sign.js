import { sign } from "crypto";
import { readFileSync } from "fs";

const privateKey = readFileSync("keys/ed25519_private.pem");

export default function signMessage(message) {
    return sign(null, Buffer.from(message), privateKey).toString("base64");
}