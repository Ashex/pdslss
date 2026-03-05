import { Client } from "@atcute/client";
import type { OAuthUserAgent } from "@atcute/oauth-browser-client";
import { setPDS } from "../components/navbar";
import { resolvePDS } from "../utils/api";
import { createServiceFetchHandler } from "./dpop-fetch";
import { stratosActive, stratosEnrollment } from "./state";

/**
 * resolves the service URL for the active target.
 * calls setPDS() as a side effect to update the navbar.
 *
 * when Stratos is active and enrollment exists, returns the Stratos service URL.
 * otherwise falls back to the PDS URL via resolvePDS (which also calls setPDS).
 *
 * @param did the DID to resolve for
 * @returns the service URL (Stratos or PDS)
 */
export const resolveServiceUrl = async (did: string): Promise<string> => {
  if (stratosActive()) {
    const enrollment = stratosEnrollment();
    if (enrollment) {
      const url = new URL(enrollment.service);
      setPDS(url.hostname);
      return enrollment.service;
    }
  }
  return resolvePDS(did);
};

/**
 * creates a Client routed to the active service.
 * when Stratos is active and enrollment exists, uses DPoP fetch handler targeting Stratos.
 * otherwise uses the agent directly for default PDS routing.
 *
 * @param agent the authenticated OAuthUserAgent
 * @returns a Client instance targeting the correct service
 */
export const createServiceClient = (agent: OAuthUserAgent, serviceUrl?: string): Client => {
  const url = serviceUrl ?? (stratosActive() ? stratosEnrollment()?.service : undefined);
  if (url) {
    return new Client({
      handler: createServiceFetchHandler(agent.handle.bind(agent), url),
    });
  }
  return new Client({ handler: agent });
};
