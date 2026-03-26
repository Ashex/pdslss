import * as fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import type { StratosEnrollment } from "./state";

vi.mock("../utils/api", () => ({
  resolvePDS: vi.fn(),
}));

vi.mock("../components/navbar", () => ({
  setPDS: vi.fn(),
}));

import { findEnrollmentByService, serviceDIDToRkey } from "./client";

const makeEnrollment = (serviceUrl: string): StratosEnrollment => ({
  service: serviceUrl,
  boundaries: [],
  signingKey: "did:key:zDnaeuser",
  attestation: { sig: new Uint8Array([1, 2, 3]), signingKey: "did:key:zDnaeservice" },
  createdAt: new Date().toISOString(),
  rkey: "did:web:stratos.example.com",
});

describe("serviceDIDToRkey", () => {
  it("returns the input unchanged when no percent-encoded colons", () => {
    expect(serviceDIDToRkey("did:web:stratos.example.com")).toBe("did:web:stratos.example.com");
  });

  it("replaces %3A with colons (case-insensitive)", () => {
    expect(serviceDIDToRkey("did%3Aweb%3Astratos.example.com")).toBe(
      "did:web:stratos.example.com",
    );
    expect(serviceDIDToRkey("did%3aweb%3astratos.example.com")).toBe(
      "did:web:stratos.example.com",
    );
  });

  it("is idempotent for already-decoded DIDs", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const did = `did:web:${s}`;
        expect(serviceDIDToRkey(did)).toBe(did);
      }),
      { numRuns: 50 },
    );
  });
});

describe("findEnrollmentByService", () => {
  it("finds matching enrollment by service URL", () => {
    const enrollments = [
      makeEnrollment("https://a.example.com"),
      makeEnrollment("https://b.example.com"),
      makeEnrollment("https://c.example.com"),
    ];
    const result = findEnrollmentByService(enrollments, "https://b.example.com");
    expect(result).toBe(enrollments[1]);
  });

  it("returns null when no match", () => {
    const enrollments = [makeEnrollment("https://a.example.com")];
    const result = findEnrollmentByService(enrollments, "https://z.example.com");
    expect(result).toBeNull();
  });

  it("normalizes trailing slashes", () => {
    const enrollments = [makeEnrollment("https://a.example.com/")];
    const result = findEnrollmentByService(enrollments, "https://a.example.com");
    expect(result).toBe(enrollments[0]);
  });

  it("returns null for empty array", () => {
    expect(findEnrollmentByService([], "https://a.example.com")).toBeNull();
  });

  it("returns the first match when duplicates exist", () => {
    const enrollments = [
      makeEnrollment("https://a.example.com"),
      makeEnrollment("https://a.example.com"),
    ];
    const result = findEnrollmentByService(enrollments, "https://a.example.com");
    expect(result).toBe(enrollments[0]);
  });
});
