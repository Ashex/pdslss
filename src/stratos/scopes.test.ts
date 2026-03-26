import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildCollectionScope, buildStratosScopes, STRATOS_SCOPES } from "./scopes";

describe("STRATOS_SCOPES", () => {
  it("has enrollment and post scope identifiers", () => {
    expect(STRATOS_SCOPES.enrollment).toBe("zone.stratos.actor.enrollment");
    expect(STRATOS_SCOPES.post).toBe("zone.stratos.feed.post");
  });
});

describe("buildCollectionScope", () => {
  it("omits action params when all actions are requested", () => {
    const result = buildCollectionScope("zone.stratos.feed.post");
    expect(result).toBe("repo:zone.stratos.feed.post");
  });

  it("omits action params when explicitly passing all three actions", () => {
    const result = buildCollectionScope("zone.stratos.feed.post", ["create", "update", "delete"]);
    expect(result).toBe("repo:zone.stratos.feed.post");
  });

  it("includes action params when subset of actions", () => {
    const result = buildCollectionScope("zone.stratos.feed.post", ["create", "delete"]);
    expect(result).toBe("repo:zone.stratos.feed.post?action=create&action=delete");
  });

  it("includes action params for single action", () => {
    const result = buildCollectionScope("zone.stratos.feed.post", ["create"]);
    expect(result).toBe("repo:zone.stratos.feed.post?action=create");
  });

  it("always starts with repo: prefix", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (collection) => {
        const result = buildCollectionScope(collection);
        expect(result.startsWith("repo:")).toBe(true);
      }),
      { numRuns: 50 },
    );
  });
});

describe("buildStratosScopes", () => {
  it("returns array starting with atproto", () => {
    const scopes = buildStratosScopes();
    expect(scopes[0]).toBe("atproto");
  });

  it("includes enrollment scope without action params", () => {
    const scopes = buildStratosScopes();
    expect(scopes).toContain("repo:zone.stratos.actor.enrollment");
  });

  it("includes post scope with create and delete actions", () => {
    const scopes = buildStratosScopes();
    expect(scopes).toContain("repo:zone.stratos.feed.post?action=create&action=delete");
  });

  it("returns exactly 3 scopes", () => {
    expect(buildStratosScopes()).toHaveLength(3);
  });
});
