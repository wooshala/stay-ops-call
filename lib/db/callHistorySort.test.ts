/**
 * CALL-HISTORY-SORT-002 — pure sort contract tests (node:test).
 * Run: node --import tsx --test lib/db/callHistorySort.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CALL_HISTORY_ORDER,
  compareCallHistorySort,
  sortCallHistoryKeys,
} from "./callHistorySort";

describe("CALL_HISTORY_ORDER PostgREST contract", () => {
  it("uses started_at DESC NULLS LAST then created_at DESC then id DESC", () => {
    assert.equal(CALL_HISTORY_ORDER[0].column, "started_at");
    assert.deepEqual(CALL_HISTORY_ORDER[0].options, {
      ascending: false,
      nullsFirst: false,
    });
    assert.equal(CALL_HISTORY_ORDER[1].column, "created_at");
    assert.deepEqual(CALL_HISTORY_ORDER[1].options, { ascending: false });
    assert.equal(CALL_HISTORY_ORDER[2].column, "id");
    assert.deepEqual(CALL_HISTORY_ORDER[2].options, { ascending: false });
  });
});

describe("compareCallHistorySort — fixture A/B", () => {
  // A: started 22:19 / created 22:33:45
  // B: started 22:26 / created 22:33:42
  const A = {
    id: "5ac8763e-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    startedAt: "2026-08-01T13:19:54.000Z",
    createdAt: "2026-08-01T13:33:45.526Z",
  };
  const B = {
    id: "e648f735-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    startedAt: "2026-08-01T13:26:19.000Z",
    createdAt: "2026-08-01T13:33:42.391Z",
  };

  it("orders B before A (started_at wins over created_at)", () => {
    assert.ok(compareCallHistorySort(B, A) < 0);
    assert.ok(compareCallHistorySort(A, B) > 0);
    const sorted = sortCallHistoryKeys([A, B]);
    assert.deepEqual(
      sorted.map((r) => r.id),
      [B.id, A.id],
    );
  });
});

describe("compareCallHistorySort — NULLs and ties", () => {
  it("puts started_at NULL after non-null (NULLS LAST)", () => {
    const withStarted = {
      id: "a",
      startedAt: "2026-08-01T13:00:00.000Z",
      createdAt: "2026-08-01T12:00:00.000Z",
    };
    const nullStarted = {
      id: "b",
      startedAt: null,
      createdAt: "2026-08-01T14:00:00.000Z",
    };
    const sorted = sortCallHistoryKeys([nullStarted, withStarted]);
    assert.equal(sorted[0].id, "a");
    assert.equal(sorted[1].id, "b");
  });

  it("same started_at → created_at DESC", () => {
    const olderCreated = {
      id: "x",
      startedAt: "2026-08-01T13:00:00.000Z",
      createdAt: "2026-08-01T13:10:00.000Z",
    };
    const newerCreated = {
      id: "y",
      startedAt: "2026-08-01T13:00:00.000Z",
      createdAt: "2026-08-01T13:20:00.000Z",
    };
    const sorted = sortCallHistoryKeys([olderCreated, newerCreated]);
    assert.deepEqual(
      sorted.map((r) => r.id),
      ["y", "x"],
    );
  });

  it("same started_at and created_at → id DESC", () => {
    const lowId = {
      id: "aaaaaaaa-0000-0000-0000-000000000001",
      startedAt: "2026-08-01T13:00:00.000Z",
      createdAt: "2026-08-01T13:10:00.000Z",
    };
    const highId = {
      id: "ffffffff-0000-0000-0000-000000000001",
      startedAt: "2026-08-01T13:00:00.000Z",
      createdAt: "2026-08-01T13:10:00.000Z",
    };
    const sorted = sortCallHistoryKeys([lowId, highId]);
    assert.deepEqual(
      sorted.map((r) => r.id),
      [highId.id, lowId.id],
    );
  });
});

describe("pagination stability (compound key)", () => {
  it("page boundaries do not duplicate or skip under stable sort", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      id: `id-${String(5 - i).padStart(2, "0")}`,
      startedAt: "2026-08-01T13:00:00.000Z",
      createdAt: "2026-08-01T13:10:00.000Z",
    }));
    // identical started/created → id DESC: id-05, id-04, id-03, id-02, id-01
    const sorted = sortCallHistoryKeys(rows);
    const page1 = sorted.slice(0, 2);
    const page2 = sorted.slice(2, 4);
    const page3 = sorted.slice(4, 6);
    const all = [...page1, ...page2, ...page3].map((r) => r.id);
    assert.equal(new Set(all).size, 5);
    assert.deepEqual(all, ["id-05", "id-04", "id-03", "id-02", "id-01"]);
  });
});
