/**
 * CALL-HISTORY-SEARCH-002 — q 검증·필터 escaping 계약
 * Run: npm run test:call-history-search
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CALL_HISTORY_Q_MAX_LEN,
  CallHistoryQueryValidationError,
  buildCallHistorySearchOrFilter,
  buildIlikePattern,
  parseMatchedPhones,
  quoteFilterValue,
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

  it("accepts 100 chars and rejects 101 with INVALID_SEARCH_QUERY", () => {
    assert.equal(resolveSearchQuery("a".repeat(CALL_HISTORY_Q_MAX_LEN)).q?.length, 100);
    try {
      resolveSearchQuery("a".repeat(101));
      assert.fail("expected throw");
    } catch (e) {
      assert.ok(e instanceof CallHistoryQueryValidationError);
      assert.equal(e.code, "INVALID_SEARCH_QUERY");
      assert.equal(e.status, 400);
    }
  });

  it("extracts phone digits", () => {
    assert.equal(resolveSearchQuery("010-1234-6680").digits, "01012346680");
    assert.equal(resolveSearchQuery("6680").digits, "6680");
    assert.equal(resolveSearchQuery("0106680").digits, "0106680");
  });
});

describe("PostgREST filter escaping", () => {
  const specials = ["주차,투베드", "50%", "_", "()", "'", '"', "a.b", "x:y"];

  for (const term of specials) {
    it(`escapes and quotes safely for: ${JSON.stringify(term)}`, () => {
      const or = buildCallHistorySearchOrFilter({ q: term, digits: null });
      // or() commas separate clauses — user comma must live inside quoted value
      assert.match(or, /phone_number\.ilike\."/);
      assert.doesNotMatch(or, /ilike\.%[^"]*,/); // unquoted comma after % would break
      const pattern = quoteFilterValue(buildIlikePattern(term));
      assert.ok(or.includes(`phone_number.ilike.${pattern}`));
    });
  }

  it("escapes ilike wildcards", () => {
    assert.equal(buildIlikePattern("100%_off"), "%100\\%\\_off%");
  });
});

describe("buildCallHistorySearchOrFilter", () => {
  it("includes transcript in WHERE only", () => {
    const or = buildCallHistorySearchOrFilter({ q: "주차", digits: null });
    assert.match(or, /transcript_text\.ilike/);
    assert.match(or, /summary\.ilike/);
  });

  it("adds digit phone patterns and matchedPhones", () => {
    const or = buildCallHistorySearchOrFilter({
      q: "김민수",
      digits: "6680",
      matchedPhones: ["01012345678"],
    });
    assert.match(or, /normalized_phone\.ilike\."%6680%"/);
    assert.match(or, /normalized_phone\.in\.\(/);
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
