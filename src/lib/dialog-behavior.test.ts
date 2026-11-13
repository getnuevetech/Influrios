import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { isDismissKey, listReturnQuery, nextFocusIndex, nextTabIndex } from "./dialog-behavior";

describe("shared popup behavior", () => {
  it("cycles keyboard focus and treats Escape as dismiss", () => {
    assert.equal(nextFocusIndex(3, 0, false), 1);
    assert.equal(nextFocusIndex(3, 2, false), 0);
    assert.equal(nextFocusIndex(3, 0, true), 2);
    assert.equal(nextFocusIndex(3, -1, false), 0);
    assert.equal(nextFocusIndex(0, 0, false), -1);
    assert.equal(isDismissKey("Escape"), true);
    assert.equal(isDismissKey("Enter"), false);
  });

  it("moves tabs with the arrow keys", () => {
    assert.equal(nextTabIndex(4, 1, "ArrowRight"), 2);
    assert.equal(nextTabIndex(4, 0, "ArrowLeft"), 3);
    assert.equal(nextTabIndex(4, 2, "Home"), 0);
    assert.equal(nextTabIndex(4, 2, "End"), 3);
    assert.equal(nextTabIndex(4, 1, "Tab"), null);
  });

  it("restores the list filters and drops the open record", () => {
    assert.deepEqual(
      listReturnQuery(
        { q: "summer", status: "processing", currency: "USD", page: "2", deal: "deal-1", tab: "transactions" },
        ["deal", "tab", "case"],
      ),
      { q: "summer", status: "processing", currency: "USD", page: "2" },
    );
  });

  it("keeps a successful role duplicate out of the error catch", () => {
    const source = readFileSync("src/app/admin/actions-auth.ts", "utf8");
    const start = source.indexOf("export async function actionDuplicateRole");
    const end = source.indexOf("function appOrigin");
    const body = source.slice(start, end);
    const catchAt = body.indexOf("} catch");
    const success = body.lastIndexOf("created=role");
    assert.ok(catchAt > 0);
    assert.ok(success > catchAt);
    assert.equal(body.slice(0, catchAt).includes("redirect("), false);
  });
});
