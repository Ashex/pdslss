import {
  getPublicKeyFromDidController,
  P256PublicKey,
  parseDidKey,
  Secp256k1PublicKey,
  type PublicKey,
} from "@atcute/crypto";
import { getAtprotoVerificationMaterial } from "@atcute/identity";
import { WebDidDocumentResolver } from "@atcute/identity-resolver";
import type { AtprotoDid } from "@atcute/lexicons/syntax";
import { verifyRecord } from "@atcute/repo";
import { serviceDIDToRkey } from "./client";
import { discoverEnrollments } from "./discovery";

export type VerificationLevel = "user-signature" | "service-signature" | "cid-integrity";

export interface VerifiedRecord {
  cid: string;
  record: unknown;
  level: VerificationLevel;
}

export interface FetchAndVerifyOptions {
  userSigningKey?: PublicKey;
  serviceSigningKey?: PublicKey;
  fetchFn?: typeof fetch;
}

export interface ResolveSigningKeyOptions {
  fetchFn?: typeof fetch;
}

export interface StratosVerificationResult {
  level: VerificationLevel;
}

// signing key cache keyed by service DID
const signingKeyCache = new Map<string, PublicKey>();

const verifyRecordCar = async (
  carBytes: Uint8Array,
  collection: string,
  rkey: string,
  did?: string,
  publicKey?: PublicKey,
  level?: VerificationLevel,
): Promise<VerifiedRecord> => {
  const result = await verifyRecord({
    carBytes,
    collection,
    rkey,
    did: did as AtprotoDid | undefined,
    publicKey,
  });
  const resolvedLevel: VerificationLevel =
    level ?? (publicKey ? "service-signature" : "cid-integrity");
  return { cid: result.cid, record: result.record, level: resolvedLevel };
};

/**
 * verifies CID integrity and MST path for a record CAR without checking
 * the commit signature. proves data integrity but not provenance.
 */
export const verifyCidIntegrity = async (
  carBytes: Uint8Array,
  collection: string,
  rkey: string,
  did?: string,
): Promise<VerifiedRecord> => {
  return verifyRecordCar(carBytes, collection, rkey, did);
};

/**
 * resolves a Stratos service's signing public key from its did:web document.
 * results are cached — the key doesn't change unless the service rotates it.
 */
export const resolveServiceSigningKey = async (
  serviceDid: string,
  options?: ResolveSigningKeyOptions,
): Promise<PublicKey> => {
  const cached = signingKeyCache.get(serviceDid);
  if (cached) return cached;

  if (!serviceDid.startsWith("did:web:")) {
    throw new Error(`expected did:web, got: ${serviceDid}`);
  }

  const fetchFn = options?.fetchFn;
  const resolver = new WebDidDocumentResolver(fetchFn ? { fetch: fetchFn } : undefined);
  const doc = await resolver.resolve(serviceDid as `did:web:${string}`);

  const material = getAtprotoVerificationMaterial(doc);
  if (!material) {
    throw new Error("DID document has no #atproto verificationMethod");
  }

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
 * resolves a user's per-actor signing public key from their enrollment record
 * on their PDS. the enrollment record contains the did:key of the user's
 * signing key, which is decoded into the appropriate key type.
 */
export const resolveUserSigningKey = async (
  pdsUrl: string,
  did: string,
  serviceDid: string,
): Promise<PublicKey | null> => {
  const enrollments = await discoverEnrollments(did, pdsUrl);

  const targetRkey = serviceDIDToRkey(serviceDid);
  const enrollment = enrollments.find((e) => e.rkey === targetRkey);
  if (!enrollment?.signingKey) return null;

  const didKey = enrollment.signingKey;
  if (!didKey.startsWith("did:key:")) {
    throw new Error(`invalid signing key format: ${didKey}`);
  }

  const found = parseDidKey(didKey);

  switch (found.type) {
    case "secp256k1":
      return Secp256k1PublicKey.importRaw(found.publicKeyBytes);
    case "p256":
      return P256PublicKey.importRaw(found.publicKeyBytes);
  }
};

/**
 * fetches a record with its inclusion proof from a Stratos service
 * and verifies it. verification priority:
 * 1. userSigningKey — verifies the user's per-actor commit signature ('user-signature')
 * 2. serviceSigningKey — verifies the service's commit signature ('service-signature')
 * 3. neither — CID integrity and MST path validation only ('cid-integrity')
 */
export const fetchAndVerifyRecord = async (
  serviceUrl: string,
  did: string,
  collection: string,
  rkey: string,
  options?: FetchAndVerifyOptions,
): Promise<VerifiedRecord> => {
  const fetchFn = options?.fetchFn ?? fetch;

  const params = new URLSearchParams({ did, collection, rkey });
  const url = new URL(`/xrpc/com.atproto.sync.getRecord?${params}`, serviceUrl);

  const res = await fetchFn(url.href);
  if (!res.ok) {
    throw new Error(`failed to fetch record proof: ${res.status} ${res.statusText}`);
  }

  const carBytes = new Uint8Array(await res.arrayBuffer());

  if (options?.userSigningKey) {
    return verifyRecordCar(carBytes, collection, rkey, did, options.userSigningKey, "user-signature");
  }

  return verifyRecordCar(carBytes, collection, rkey, did, options?.serviceSigningKey);
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
