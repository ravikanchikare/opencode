import { createPublicKey, verify } from "node:crypto"

const PUBLIC_KEY_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex")

export function decodePublicKey(raw: string) {
  const key = Buffer.from(raw.trim(), "base64")
  if (key.length !== 32) throw new Error("Ed25519 public key must be 32 bytes")
  return createPublicKey({
    key: Buffer.concat([PUBLIC_KEY_SPKI_PREFIX, key]),
    format: "der",
    type: "spki",
  })
}

export function verifyEd25519(publicKey: string, payload: Uint8Array, signature: string) {
  const sig = Buffer.from(signature.trim(), "base64")
  if (sig.length !== 64) throw new Error("Ed25519 signature must be 64 bytes")
  if (!verify(null, payload, decodePublicKey(publicKey), sig)) throw new Error("latest-mac.yml signature is invalid")
}
