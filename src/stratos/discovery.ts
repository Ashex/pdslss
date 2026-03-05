import type { FetchHandler } from "@atcute/client";
import { Client, simpleFetchHandler } from "@atcute/client";
import type { StratosEnrollment } from "./state";

const ENROLLMENT_COLLECTION = "zone.stratos.actor.enrollment";
const ENROLLMENT_RKEY = "self";

const isEnrollmentRecord = (
  val: unknown,
): val is {
  service: string;
  boundaries?: Array<{ value: string }>;
  createdAt: string;
} => {
  if (typeof val !== "object" || val === null) return false;
  const obj = val as Record<string, unknown>;
  return typeof obj.service === "string" && typeof obj.createdAt === "string";
};

export const discoverStratosEnrollment = async (
  did: string,
  pdsUrlOrHandler: string | FetchHandler,
): Promise<StratosEnrollment | null> => {
  const handler =
    typeof pdsUrlOrHandler === "string" ?
      simpleFetchHandler({ service: pdsUrlOrHandler })
    : pdsUrlOrHandler;

  const rpc = new Client({ handler });
  const res = await rpc.get("com.atproto.repo.getRecord", {
    params: {
      repo: did as `did:${string}:${string}`,
      collection: ENROLLMENT_COLLECTION,
      rkey: ENROLLMENT_RKEY,
    },
  });
  if (!res.ok) return null;

  const val = res.data.value;
  if (!isEnrollmentRecord(val)) return null;

  return {
    service: val.service,
    boundaries: Array.isArray(val.boundaries) ? val.boundaries : [],
    createdAt: val.createdAt,
  };
};
