import type { FetchHandler, FetchHandlerObject } from "@atcute/client";

/**
 * creates a fetch handler that routes XRPC calls to a specific service URL
 * using an existing authenticated handler for DPoP credentials.
 *
 * works by resolving relative pathnames against the target service URL.
 * the underlying DPoP fetch derives htu from the actual request URL,
 * so proofs are valid for any origin without reconfiguration.
 *
 * @param authenticatedHandler a handler that attaches auth headers (DPoP proof + access token)
 * @param serviceUrl the target Stratos service base URL
 * @returns a FetchHandlerObject that routes calls to the target service
 */
export const createServiceFetchHandler = (
  authenticatedHandler: FetchHandler,
  serviceUrl: string,
): FetchHandlerObject => {
  const fetch = buildFetchHandler(handler);
  return {
    async handle(pathname: string, init?: RequestInit): Promise<Response> {
      const url = new URL(pathname, serviceUrl);
      const headers = new Headers(init?.headers);
      // ngrok free tier returns an HTML interstitial for browser User-Agents
      headers.set("ngrok-skip-browser-warning", "1");
      return authenticatedHandler(url.href, { ...init, headers });
    },
  };
};
