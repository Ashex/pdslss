export { verifyEnrollmentAttestation } from "./attestation";
export type { AttestationResult } from "./attestation";
export {
  createServiceClient,
  findEnrollmentByService,
  resolveServiceUrl,
  serviceDIDToRkey,
} from "./client";
export {
  discoverEnrollment,
  discoverEnrollments,
  discoverStratosEnrollment,
  getEnrollmentByServiceDid,
} from "./discovery";
export { createServiceFetchHandler } from "./dpop-fetch";
export { STRATOS_SCOPES, buildCollectionScope, buildStratosScopes } from "./scopes";
export type { StratosScopes } from "./scopes";
export {
  setStratosActive,
  setStratosEnrollment,
  setTargetEnrollment,
  stratosActive,
  stratosEnrollment,
  targetEnrollment,
} from "./state";
export type { ServiceAttestation, StratosEnrollment } from "./state";
export {
  fetchAndVerifyRecord,
  resolveServiceSigningKey,
  resolveUserSigningKey,
  verifyCidIntegrity,
  verifyStratosRecord,
} from "./verification";
export type {
  FetchAndVerifyOptions,
  ResolveSigningKeyOptions,
  StratosVerificationResult,
  VerificationLevel,
  VerifiedRecord,
} from "./verification";
