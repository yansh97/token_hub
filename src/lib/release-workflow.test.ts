import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");

describe("release workflow", () => {
  it("keeps release creation atomic and recoverable", () => {
    expect(releaseWorkflow).toContain("stable_release_bootstrap:");
    expect(releaseWorkflow).toContain(
      `stable_release:\n    name: Release (\${{ matrix.platform }} / \${{ matrix.target }})\n    needs: [stable_tag, stable_release_bootstrap]`,
    );
    expect(releaseWorkflow).toContain("const createAsDraft = true;");
    expect(releaseWorkflow).toContain("Mark release as latest");
    expect(releaseWorkflow).not.toContain(
      "needs.stable_release_bootstrap.outputs.release_draft == 'true'",
    );
    expect(releaseWorkflow).not.toContain("- name: Wait for GitHub Release");
    expect(releaseWorkflow).not.toContain("stable_cli_release:");
    expect(releaseWorkflow).not.toContain("Build CLI binary");
  });

  it("includes the synchronized upstream version in release notes", () => {
    expect(releaseWorkflow).toContain(
      'fs.readFileSync(".upstream-version", "utf8")',
    );
    expect(releaseWorkflow).toContain(
      `https://github.com/mxyhi/token_proxy/releases/tag/v\${upstreamVersion}`,
    );
  });

  it("creates the release PR and explicitly dispatches its tests", () => {
    expect(releaseWorkflow).toContain("Create or update release PR");
    expect(releaseWorkflow).toContain("createWorkflowDispatch");
    expect(releaseWorkflow).toContain('workflow_id: "test.yml"');
    expect(releaseWorkflow).toContain("pull-requests: write");
    expect(releaseWorkflow).toContain("actions: write");
  });
});
