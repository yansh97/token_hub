import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");

describe("release workflow", () => {
  it("bootstraps the GitHub release before desktop asset uploads", () => {
    expect(releaseWorkflow).toContain("stable_release_bootstrap:");
    expect(releaseWorkflow).toContain(
      `stable_release:\n    name: Release (\${{ matrix.platform }} / \${{ matrix.target }})\n    needs: [stable_tag, stable_release_bootstrap]`,
    );
    expect(releaseWorkflow).not.toContain("stable_cli_release:");
    expect(releaseWorkflow).not.toContain("Build CLI binary");
  });

  it("does not rely on polling the release from build jobs", () => {
    expect(releaseWorkflow).not.toContain("- name: Wait for GitHub Release");
    expect(releaseWorkflow).not.toContain(
      "uses: ./.github/actions/wait-for-release",
    );
  });

  it("includes the synchronized upstream version in release notes", () => {
    expect(releaseWorkflow).toContain(
      'fs.readFileSync(".upstream-version", "utf8")',
    );
    expect(releaseWorkflow).toContain(
      `https://github.com/mxyhi/token_proxy/releases/tag/v\${upstreamVersion}`,
    );
  });
});
