import {
  getPublicKeyFromDidController,
  getPublicKeyFromDidController,
  P256PublicKey,
  Secp256k1PublicKey,
  type PublicKey,
} from "@atcute/crypto";
import { getAtprotoVerificationMaterial } from "@atcute/identity";
import { WebDidDocumentResolver } from "@atcute/identity-resolver";
import type { AtprotoDid } from "@atcute/lexicons/syntax";
import { getAtprotoVerificationMaterial } from "@atcute/identity";
import { WebDidDocumentResolver } from "@atcute/identity-resolver";
import type { AtprotoDid, Did } from "@atcute/lexicons/syntax";
import { verifyRecord } from "@atcute/repo";

export type VerificationLevel = "service-signature" | "cid-integrity";

export interface StratosVerificationResult {
  level: VerificationLevel;
}

// signing key cache keyed by service DID
const signingKeyCache = new Map<string, PublicKey>();

/**
 * resolves a Stratos service's signing public key from its did:web document.
 * uses WebDidDocumentResolver for validated DID document fetching and
 * getPublicKeyFromDidController for key type dispatch.
 * results are cached — the key doesn't change unless the service rotates it.
 */
export const resolveServiceSigningKey = async (serviceDid: string): Promise<PublicKey> => {
  const cached = signingKeyCache.get(serviceDid);
  if (cached) return cached;

  if (!serviceDid.startsWith("did:web:")) {
    throw new Error(`expected did:web, got: ${serviceDid}`);
  }

  const resolver = new WebDidDocumentResolver();
  const doc = await resolver.resolve(serviceDid as `did:web:${string}`);

  const material = getAtprotoVerificationMaterial(doc);
  if (!material) {
    throw new Error("DID document has no #atproto verificationMethod");
  }

  const found = getPublicKeyFromDidController(material);
  const found = getPublicKeyFromDidController(material);

  let key: PublicKey;
  switch (found.type) {
    case "secp256k1":
      key = await Secp256k1PublicKey.importRaw(found.publicKeyBytes);
      break;
    case "p256":
      key = await P256PublicKey.importRaw(found.publicKeyBytes);
      break;
  }

  signingKeyCache.set(serviceDid, key);
  return key;
};

/**
 * verifies a Stratos record with signature verification when possible,
 * falling back to CID integrity if the signing key can't be resolved.
 */
export const verifyStratosRecord = async (
  carBytes: Uint8Array,
  did: string,
  collection: string,
  rkey: string,
  serviceDid: string | undefined,
): Promise<StratosVerificationResult> => {
  let signingKey: PublicKey | undefined;
  if (serviceDid) {
    try {
      signingKey = await resolveServiceSigningKey(serviceDid);
    } catch {
      // key resolution failed — fall through to CID-only
    }
  }

  if (signingKey) {
    await verifyRecord({
      carBytes,
      collection,
      rkey,
      did: did as AtprotoDid,
      publicKey: signingKey,
    });
    return { level: "service-signature" };
  }

  await verifyRecord({
    carBytes,
    collection,
    rkey,
    did: did as AtprotoDid,
  });
  return { level: "cid-integrity" };
};
