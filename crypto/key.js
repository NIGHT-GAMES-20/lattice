import { generateKeyPairSync } from "crypto";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { fileURLToPath } from "url";

if (!existsSync("keys")) {
    mkdirSync("keys");
}

function generateKeys() {
  const { publicKey: ed25519pub , privateKey: ed25519priv } = generateKeyPairSync("ed25519");
  const { publicKey: x25519Pub, privateKey: x25519Priv } = generateKeyPairSync("x25519");

  writeFileSync(
      "keys/ed25519_public.pem",  
      ed25519pub.export({
          type: "spki",
          format: "pem",
      })
  );

  writeFileSync(
      "keys/ed25519_private.pem",
      ed25519priv.export({
          type: "pkcs8",
          format: "pem",
      })
  );

  writeFileSync(
    "keys/x25519_public.pem",  
    x25519Pub.export({ 
      type: "spki",  
      format: "pem" 
    })
  );

  writeFileSync(
    "keys/x25519_private.pem", 
    x25519Priv.export({ 
      type: "pkcs8", 
      format: "pem" 
    })
  );

  console.log("Keys generated!");
}

function getPublicKey() {
  return readFileSync("keys/ed25519_public.pem", "utf-8");
}

function getPrivateKey() {
  return readFileSync("keys/ed25519_private.pem", "utf-8");
}

function getX25519PublicKey() {
    return readFileSync("keys/x25519_public.pem", "utf-8");
}


export { generateKeys, getPublicKey, getPrivateKey, getX25519PublicKey };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    generateKeys();
}