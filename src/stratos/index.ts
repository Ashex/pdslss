export { verifyEnrollmentAttestation } from "./attestation";
export type { AttestationResult } from "./attestation";
export { createServiceClient, resolveServiceUrl } from "./client";
export { discoverEnrollment } from "./discovery";
export { createServiceFetchHandler } from "./dpop-fetch";
export {
  setStratosActive,
  setStratosEnrollment,
  setTargetEnrollment,
  stratosActive,
  stratosEnrollment,
  targetEnrollment,
} from "./state";
export type { StratosEnrollment } from "./state";
export { verifyStratosRecord } from "./verification";
export type { StratosVerificationResult, VerificationLevel } from "./verification";
