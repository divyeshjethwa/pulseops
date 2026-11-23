
import test from "node:test";
import assert from "node:assert/strict";

import {
  retryDelaySeconds,
} from "./outbox-claim.mjs";

test("retry delay increases exponentially", () => {
  assert.equal(retryDelaySeconds(1), 30);
  assert.equal(retryDelaySeconds(2), 60);
  assert.equal(retryDelaySeconds(3), 120);
  assert.equal(retryDelaySeconds(4), 240);
});

test("retry delay is capped at one hour", () => {
  assert.equal(retryDelaySeconds(9), 3600);
});
