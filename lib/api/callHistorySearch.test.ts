/**
 * CALL-HISTORY-SEARCH-001 — q 검증·필터 계약 테스트
 * Run: node --import tsx --test lib/api/callHistorySearch.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CALL_HISTORY_Q_MAX_LEN,
  CallHistoryQueryValidationError,
  buildCallHistorySearchOrFilter,
  buildIlikePattern,
  parseMatchedPhones,
  resolveSearchQuery,
} from "./callHistorySearch";

describe("resolveSearchQuery", () => {
  it("treats missing/blank as no filter", () => {
    assert.deepEqual(resolveSearchQuery(null), { q: null, digits: null });
    assert.deepEqual(resolveSearchQuery(""), { q: null, digits: null });
    assert.deepEqual(resolveSearchQuery("   "), { q: null, digits: null });
  });

  it("trims whitespace", () => {
    assert.equal(resolveSearchQuery("  주차  ")?.q, "주차");
  });

  it("accepts 100 chars and rejects 101", () => {
    const ok = "a".repeat(CALL_HISTORY_Q_MAX_LEN);
    assert.equal(resolveSearchQuery(ok).q?.length, 100);
    assert.throws(
      () => resolveSearchQuery("a".repeat(101)),
      (e: unknown) =>
        e instanceof CallHistoryQueryValidationError && e.status === 400,
    );
  });

  it("extracts phone digits for 010-1234-6680 / 6680", () => {
    assert.equal(resolveSearchQuery("010-1234-6680").digits, "01012346680");
    assert.equal(resolveSearchQuery("6680").digits, "6680");
    assert.equal(resolveSearchQuery("0106680").digits, "0106680");
    assert.equal(resolveSearchQuery("a").digits, null);
  });
});

describe("buildCallHistorySearchOrFilter", () => {
  it("includes transcript in WHERE but callers must not select it on list", () => {
    const or = buildCallHistorySearchOrFilter({ q: "주차", digits: null });
    assert.match(or, /transcript_text\.ilike/);
    assert.match(or, /summary\.ilike/);
    assert.match(or, /primary_intent\.ilike/);
  });

  it("adds digit phone patterns when digits present", () => {
    const or = buildCallHistorySearchOrFilter({ q: "6680", digits: "6680" });
    assert.match(or, /normalized_phone\.ilike\.%6680%/);
  });

  it("adds matchedPhones in() clauses (customer-name path)", () => {
    const or = buildCallHistorySearchOrFilter({
      q: "김민수",
      digits: null,
      matchedPhones: ["01012345678", "01099998888"],
    });
    assert.match(or, /normalized_phone\.in\.\(/);
  });

  it("escapes ilike wildcards in user input", () => {
    assert.equal(buildIlikePattern("100%_off"), "%100\\%\\_off%");
  });
});

describe("parseMatchedPhones", () => {
  it("parses and caps at 100", () => {
    assert.deepEqual(parseMatchedPhones("010-1111-2222,12"), ["01011112222"]);
    const many = Array.from({ length: 120 }, (_, i) => `010${String(i).padStart(8, "0")}`).join(
      ",",
    );
    assert.equal(parseMatchedPhones(many).length, 100);
  });
});
