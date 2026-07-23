import { execSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

function setOutput(key, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  const line = `${key}=${value}\n`;
  if (outputPath) {
    fs.appendFileSync(outputPath, line);
  } else {
    process.stdout.write(line);
  }
}

function readPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  return pkg.version;
}

function readStableTags() {
  const output = execSync("git tag --list 'v*'", { encoding: "utf8" }).trim();
  if (!output) return [];
  return output.split(/\r?\n/).filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag));
}

function parseStableVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

export function evaluateReleaseGuard({ version, stableTags }) {
  const parsedVersion = parseStableVersion(version);
  const currentTag = `v${version}`;
  const sortedTags = stableTags
    .map((tag) => ({ tag, version: parseStableVersion(tag.slice(1)) }))
    .filter((item) => item.version !== null)
    .sort((left, right) => compareVersions(left.version, right.version));
  const latestTag = sortedTags.at(-1)?.tag ?? "";
  const latestVersion = sortedTags.at(-1)?.version ?? null;
  const isCurrentTagPresent = stableTags.includes(currentTag);
  const isAheadOfLatest =
    parsedVersion !== null &&
    (latestVersion === null ||
      compareVersions(parsedVersion, latestVersion) > 0);

  return {
    currentTag,
    latestTag,
    isStable: parsedVersion !== null,
    isCurrentTagPresent,
    isAheadOfLatest,
    isRelease:
      parsedVersion !== null && !isCurrentTagPresent && isAheadOfLatest,
  };
}

function main() {
  const version = readPackageVersion();
  const stableTags = readStableTags();
  const result = evaluateReleaseGuard({
    version,
    stableTags,
  });

  setOutput("version", version);
  setOutput("latest_tag", result.latestTag);
  setOutput("is_release", result.isRelease ? "true" : "false");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
