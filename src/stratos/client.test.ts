import { Client } from "@atcute/client";
import type { OAuthUserAgent } from "@atcute/oauth-browser-client";
import * as fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServiceClient, resolveServiceUrl } from "./client";
import { setStratosActive, setStratosEnrollment, type StratosEnrollment } from "./state";

vi.mock("../utils/api", () => ({
  resolvePDS: vi.fn(),
}));

vi.mock("../components/navbar", () => ({
  setPDS: vi.fn(),
}));

import { setPDS } from "../components/navbar";
import { resolvePDS } from "../utils/api";

const arbUrl = fc.webUrl({ withQueryParameters: false, withFragments: false });
const arbDid = fc.string({ minLength: 5, maxLength: 30 }).map((s) => `did:plc:${s}`);

const makeEnrollment = (serviceUrl: string): StratosEnrollment => ({
  service: serviceUrl,
  boundaries: [],
  signingKey: "did:key:zDnaeuser",
  attestation: { sig: new Uint8Array([1, 2, 3]), signingKey: "did:key:zDnaeservice" },
  createdAt: new Date().toISOString(),
  rkey: "did:web:stratos.example.com",
});

const arbEnrollment = arbUrl.map(makeEnrollment);

const mockResolvePDS = resolvePDS as ReturnType<typeof vi.fn>;
const mockSetPDS = setPDS as ReturnType<typeof vi.fn>;

function makeMockAgent(): OAuthUserAgent & { lastCalledUrl: string | undefined } {
  const agent = {
    lastCalledUrl: undefined as string | undefined,
    handle: vi.fn(async (url: string, _init?: RequestInit) => {
      agent.lastCalledUrl = url;
      void _init;
      return new Response(null, { status: 200 });
    }),
  } as unknown as OAuthUserAgent & { lastCalledUrl: string | undefined };
  return agent;
}

beforeEach(() => {
  vi.clearAllMocks();
  setStratosActive(false);
  setStratosEnrollment(undefined);
});

afterEach(() => {
  setStratosActive(false);
  setStratosEnrollment(undefined);
});

describe("resolveServiceUrl", () => {
  it("returns the Stratos service URL when active and enrollment exists", async () => {
    await fc.assert(
      fc.asyncProperty(arbDid, arbUrl, async (did, serviceUrl) => {
        vi.clearAllMocks();
        setStratosActive(true);
        setStratosEnrollment(makeEnrollment(serviceUrl));

        const result = await resolveServiceUrl(did);

        expect(result).toBe(serviceUrl);
      }),
      { numRuns: 50 },
    );
  });

  it("returns the PDS URL when inactive", async () => {
    await fc.assert(
      fc.asyncProperty(arbDid, arbUrl, async (did, pdsUrl) => {
        vi.clearAllMocks();
        setStratosActive(false);
        setStratosEnrollment(makeEnrollment("https://stratos.example.com"));
        mockResolvePDS.mockResolvedValue(pdsUrl);

        const result = await resolveServiceUrl(did);

        expect(result).toBe(pdsUrl);
        expect(mockResolvePDS).toHaveBeenCalledWith(did);
      }),
      { numRuns: 50 },
    );
  });

  it("falls back to the PDS URL when active but enrollment is null", async () => {
    await fc.assert(
      fc.asyncProperty(arbDid, arbUrl, async (did, pdsUrl) => {
        vi.clearAllMocks();
        setStratosActive(true);
        setStratosEnrollment(null);
        mockResolvePDS.mockResolvedValue(pdsUrl);

        const result = await resolveServiceUrl(did);

        expect(result).toBe(pdsUrl);
        expect(mockResolvePDS).toHaveBeenCalledWith(did);
      }),
      { numRuns: 50 },
    );
  });

  it("calls setPDS with the hostname when Stratos is active", async () => {
    await fc.assert(
      fc.asyncProperty(arbDid, arbUrl, async (did, serviceUrl) => {
        vi.clearAllMocks();
        setStratosActive(true);
        setStratosEnrollment(makeEnrollment(serviceUrl));

        await resolveServiceUrl(did);

        expect(mockSetPDS).toHaveBeenCalledWith(new URL(serviceUrl).hostname);
      }),
      { numRuns: 50 },
    );
  });

  it("delegates to resolvePDS when falling back to PDS", async () => {
    await fc.assert(
      fc.asyncProperty(arbDid, arbUrl, async (did, pdsUrl) => {
        vi.clearAllMocks();
        setStratosActive(false);
        setStratosEnrollment(null);
        mockResolvePDS.mockResolvedValue(pdsUrl);

        await resolveServiceUrl(did);

        expect(mockResolvePDS).toHaveBeenCalledWith(did);
      }),
      { numRuns: 50 },
    );
  });
});

describe("createServiceClient", () => {
  it("always returns a Client instance", () => {
    fc.assert(
      fc.property(fc.boolean(), fc.option(arbEnrollment, { nil: null }), (active, enrollment) => {
        setStratosActive(active);
        setStratosEnrollment(enrollment);

        expect(createServiceClient(makeMockAgent())).toBeInstanceOf(Client);
      }),
      { numRuns: 50 },
    );
  });

  it("routes requests to the Stratos service origin when active and enrolled", async () => {
    await fc.assert(
      fc.asyncProperty(arbUrl, async (serviceUrl) => {
        setStratosActive(true);
        setStratosEnrollment(makeEnrollment(serviceUrl));
        const agent = makeMockAgent();

        const client = createServiceClient(agent);
        await client.handler("/xrpc/com.atproto.repo.describeRepo", {});

        expect(agent.lastCalledUrl).toBeDefined();
        expect(new URL(agent.lastCalledUrl!).origin).toBe(new URL(serviceUrl).origin);
      }),
      { numRuns: 50 },
    );
  });

  it("passes the pathname directly to the agent when inactive", async () => {
    await fc.assert(
      fc.asyncProperty(arbUrl, async (serviceUrl) => {
        setStratosActive(false);
        setStratosEnrollment(makeEnrollment(serviceUrl));
        const agent = makeMockAgent();

        const client = createServiceClient(agent);
        await client.handler("/xrpc/com.atproto.repo.describeRepo", {});

        // agent.handle receives the raw pathname; it resolves the base against its own PDS
        expect(agent.lastCalledUrl).toBe("/xrpc/com.atproto.repo.describeRepo");
      }),
      { numRuns: 50 },
    );
  });

  it("falls back to agent routing when active but enrollment is null", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        setStratosActive(true);
        setStratosEnrollment(null);
        const agent = makeMockAgent();

        const client = createServiceClient(agent);
        await client.handler("/xrpc/com.atproto.repo.describeRepo", {});

        expect(agent.lastCalledUrl).toBe("/xrpc/com.atproto.repo.describeRepo");
      }),
      { numRuns: 20 },
    );
  });
});
