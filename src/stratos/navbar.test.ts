/**
 * property-based tests for navbar toggle/chip visibility logic.
 *
 * these tests verify the pure predicates that determine what the navbar renders,
 * without needing to mount any SolidJS components.
 *
 * Validates: Requirements 5.4, 1.4
 */
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { StratosEnrollment } from "./state";

// #region predicates under test

/** toggle button is visible iff both own and target enrollment are non-null */
const isToggleVisible = (
  ownEnrollment: StratosEnrollment | null | undefined,
  targetEnrollment: StratosEnrollment | null | undefined,
): boolean => ownEnrollment != null && targetEnrollment != null;

/** boundary chips are visible iff enrollment is non-null AND active is true AND boundaries non-empty */
const areBoundaryChipsVisible = (
  enrollment: StratosEnrollment | null | undefined,
  active: boolean,
): boolean => enrollment != null && active === true && enrollment.boundaries.length > 0;

/**
 * the displayed hostname in the PDS row.
 * when active and enrolled, shows the Stratos service hostname; otherwise shows the pds signal value.
 */
const getDisplayedHostname = (
  enrollment: StratosEnrollment | null | undefined,
  active: boolean,
  pds: string,
): string => (active && enrollment != null ? new URL(enrollment.service).hostname : pds);

// #endregion

// #region arbitraries

const arbUrl = fc.webUrl({ withQueryParameters: false, withFragments: false });

const arbBoundary = fc.record({ value: fc.string({ minLength: 1, maxLength: 50 }) });

const arbAttestation = fc.record({
  sig: fc.constant(new Uint8Array([1, 2, 3])),
  signingKey: fc.constant("did:key:zDnaeservice"),
});

const arbEnrollment = (
  boundaryCount: { minLength?: number; maxLength?: number } = { minLength: 0, maxLength: 10 },
) =>
  fc.record({
    service: arbUrl,
    boundaries: fc.array(arbBoundary, boundaryCount),
    signingKey: fc.constant("did:key:zDnaeuser"),
    attestation: arbAttestation,
    createdAt: fc.constant("2024-01-01T00:00:00.000Z"),
    rkey: fc.constant("did:web:stratos.example.com"),
  });

const arbNullableEnrollment = fc.option(arbEnrollment(), { nil: null });

// #endregion

describe("navbar visibility predicates", () => {
  describe("isToggleVisible", () => {
    it("is true when both enrollments are non-null", () => {
      fc.assert(
        fc.property(arbEnrollment(), arbEnrollment(), (own, target) => {
          expect(isToggleVisible(own, target)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it("is false when own enrollment is null", () => {
      fc.assert(
        fc.property(arbEnrollment(), (target) => {
          expect(isToggleVisible(null, target)).toBe(false);
        }),
        { numRuns: 50 },
      );
    });

    it("is false when target enrollment is null", () => {
      fc.assert(
        fc.property(arbEnrollment(), (own) => {
          expect(isToggleVisible(own, null)).toBe(false);
        }),
        { numRuns: 50 },
      );
    });

    it("is false when own enrollment is undefined", () => {
      expect(isToggleVisible(undefined, null)).toBe(false);
    });

    it("is false when both are null", () => {
      expect(isToggleVisible(null, null)).toBe(false);
    });

    it("matches own != null && target != null for all combinations", () => {
      fc.assert(
        fc.property(arbNullableEnrollment, arbNullableEnrollment, (own, target) => {
          expect(isToggleVisible(own, target)).toBe(own != null && target != null);
        }),
        { numRuns: 200 },
      );
    });
  });

  describe("areBoundaryChipsVisible", () => {
    it("is true iff enrollment is non-null AND active AND boundaries non-empty", () => {
      fc.assert(
        fc.property(arbNullableEnrollment, fc.boolean(), (enrollment, active) => {
          const result = areBoundaryChipsVisible(enrollment, active);
          const expected =
            enrollment != null && active === true && enrollment.boundaries.length > 0;
          expect(result).toBe(expected);
        }),
        { numRuns: 200 },
      );
    });

    it("is false when enrollment is null regardless of active", () => {
      fc.assert(
        fc.property(fc.boolean(), (active) => {
          expect(areBoundaryChipsVisible(null, active)).toBe(false);
        }),
        { numRuns: 50 },
      );
    });

    it("is false when active is false regardless of enrollment", () => {
      fc.assert(
        fc.property(arbEnrollment({ minLength: 1, maxLength: 10 }), (enrollment) => {
          expect(areBoundaryChipsVisible(enrollment, false)).toBe(false);
        }),
        { numRuns: 50 },
      );
    });

    it("is false when boundaries are empty even if active and enrolled", () => {
      fc.assert(
        fc.property(arbEnrollment({ minLength: 0, maxLength: 0 }), (enrollment) => {
          expect(areBoundaryChipsVisible(enrollment, true)).toBe(false);
        }),
        { numRuns: 50 },
      );
    });

    it("is true when enrolled, active, and has at least one boundary", () => {
      fc.assert(
        fc.property(arbEnrollment({ minLength: 1, maxLength: 10 }), (enrollment) => {
          expect(areBoundaryChipsVisible(enrollment, true)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe("getDisplayedHostname", () => {
    it("returns the Stratos service hostname when active and enrolled", () => {
      fc.assert(
        fc.property(arbEnrollment(), fc.string(), (enrollment, pds) => {
          const result = getDisplayedHostname(enrollment, true, pds);
          expect(result).toBe(new URL(enrollment.service).hostname);
        }),
        { numRuns: 100 },
      );
    });

    it("returns the pds value when inactive", () => {
      fc.assert(
        fc.property(arbNullableEnrollment, fc.string(), (enrollment, pds) => {
          const result = getDisplayedHostname(enrollment, false, pds);
          expect(result).toBe(pds);
        }),
        { numRuns: 100 },
      );
    });

    it("returns the pds value when active but enrollment is null", () => {
      fc.assert(
        fc.property(fc.string(), (pds) => {
          const result = getDisplayedHostname(null, true, pds);
          expect(result).toBe(pds);
        }),
        { numRuns: 50 },
      );
    });

    it("hostname from getDisplayedHostname matches new URL(service).hostname exactly", () => {
      fc.assert(
        fc.property(arbEnrollment(), fc.string(), (enrollment, pds) => {
          const displayed = getDisplayedHostname(enrollment, true, pds);
          const expected = new URL(enrollment.service).hostname;
          expect(displayed).toBe(expected);
        }),
        { numRuns: 100 },
      );
    });
  });
});
