/**
 * property-based tests for scope utility functions.
 *
 * these tests verify pure functions from scope-utils.ts without any SolidJS signals.
 *
 * Validates: Requirements (task 8)
 */
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  buildScopeString,
  GRANULAR_SCOPES,
  parseScopeString,
  scopeIdsToString,
} from "./scope-utils";

// #region arbitraries

const scopeIds = GRANULAR_SCOPES.map((s) => s.id);

/** generates an arbitrary subset of scope IDs */
const arbScopeIdSet = fc
  .subarray(scopeIds, { minLength: 0, maxLength: scopeIds.length })
  .map((arr) => new Set(arr));

// #endregion

describe("scope utility properties", () => {
  describe("buildScopeString", () => {
    it("always starts with atproto as the first token", () => {
      fc.assert(
        fc.property(arbScopeIdSet, (selected) => {
          const result = buildScopeString(selected);
          const tokens = result.split(" ");
          expect(tokens[0]).toBe("atproto");
        }),
        { numRuns: 200 },
      );
    });

    it("contains stratos post scope when stratos-posts is selected", () => {
      fc.assert(
        fc.property(arbScopeIdSet, (selected) => {
          // ensure stratos-posts is in the set
          const withStratosPosts = new Set(selected);
          withStratosPosts.add("stratos-posts");

          const result = buildScopeString(withStratosPosts);
          const tokens = result.split(" ");
          expect(tokens).toContain("repo:zone.stratos.feed.post?action=create&action=delete");
        }),
        { numRuns: 200 },
      );
    });

    it("does not contain stratos post scope when stratos-posts is not selected", () => {
      fc.assert(
        fc.property(arbScopeIdSet, (selected) => {
          const withoutStratosPosts = new Set(selected);
          withoutStratosPosts.delete("stratos-posts");

          const result = buildScopeString(withoutStratosPosts);
          const tokens = result.split(" ");
          expect(tokens).not.toContain("repo:zone.stratos.feed.post?action=create&action=delete");
        }),
        { numRuns: 200 },
      );
    });
  });

  describe("parseScopeString / scopeIdsToString round-trip", () => {
    it("round-trips: parseScopeString(scopeIdsToString(set)) equals the original set (excluding atproto)", () => {
      fc.assert(
        fc.property(arbScopeIdSet, (original) => {
          const serialized = scopeIdsToString(original);
          const parsed = parseScopeString(serialized);

          // atproto is always injected by scopeIdsToString but stripped by parseScopeString
          // so the round-tripped set should equal the original
          expect(parsed).toEqual(original);
        }),
        { numRuns: 200 },
      );
    });

    it("parseScopeString never includes atproto in the result", () => {
      fc.assert(
        fc.property(arbScopeIdSet, (selected) => {
          const serialized = scopeIdsToString(selected);
          const parsed = parseScopeString(serialized);
          expect(parsed.has("atproto")).toBe(false);
        }),
        { numRuns: 200 },
      );
    });
  });
});
