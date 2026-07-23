import assert from "node:assert/strict";
import test from "node:test";

import { evaluateReleaseGuard } from "./release-guard.mjs";

const cases = [
  {
    name: "放行高于最新 tag 的稳定版本",
    version: "0.2.0",
    stableTags: ["v0.1.160"],
    expected: true,
  },
  {
    name: "跳过已存在的当前 tag",
    version: "0.1.63",
    stableTags: ["v0.1.62", "v0.1.63"],
    expected: false,
  },
  {
    name: "跳过低于最新 tag 的版本",
    version: "0.1.63",
    stableTags: ["v0.1.64"],
    expected: false,
  },
  {
    name: "跳过预发布版本",
    version: "0.1.64-1",
    stableTags: ["v0.1.63"],
    expected: false,
  },
];

for (const { name, version, stableTags, expected } of cases) {
  test(`evaluateReleaseGuard ${name}`, () => {
    assert.equal(
      evaluateReleaseGuard({ version, stableTags }).isRelease,
      expected,
    );
  });
}
