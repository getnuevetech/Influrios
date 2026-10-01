import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isStaleServerAction } from "./stale-server-action";

describe("stale server action", () => {
  it("recognizes the admin save failure from a different build", () => {
    const message =
      'Server Action "40a5f680abe3d92c0fecb64ff3afda188e68bbd148" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action';
    assert.equal(isStaleServerAction({ name: "UnrecognizedActionError", message }), true);
    assert.equal(isStaleServerAction({ message }), true);
    assert.equal(isStaleServerAction({ message: "Could not save the gateway." }), false);
  });
});
