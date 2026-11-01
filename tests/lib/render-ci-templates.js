"use strict";

/**
 * CI template rendering helpers.
 *
 * Shared by the plugin validation suite so that the rendering logic exercised
 * by tests matches the logic the `ci-setup` skill documents. Keep the two in
 * sync: the skill's placeholder contract and optional-block markers are the
 * source of truth.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const PLUGIN_ROOT = path.resolve(__dirname, "..", "..");
const TEMPLATES_ROOT = path.join(PLUGIN_ROOT, "skills", "ci-setup", "templates");

/** Fixture values used by the golden render test. */
const FIXTURE_VALUES = {
  "{VERSION}": "1.0.0",
  "{BRANCHES}": '"main", "develop"',
  "{PR_BRANCHES}": '"main"',
  "{JAVA_VERSION}": "25",
  "{RUNNER}": "ubuntu-latest",
  "{MAVEN_CMD}": "./mvnw",
  "{MAVEN_ARGS}": "-s .mvn/settings.xml",
  "{CACHE_PATH}": "~/.m2/repository",
  "{ARTIFACT_GLOB}": "target/app.jar",
  "{MIRROR_ID}": "aliyunmaven",
  "{MIRROR_NAME}": "Aliyun Public",
  "{MIRROR_URL}": "https://maven.aliyun.com/repository/public",
};

/** Features that can be toggled via the optional-block markers. */
const OPTIONAL_FEATURES = ["coverage", "spotbugs", "artifact"];

/**
 * Replace the documented placeholders only. A blanket regex would corrupt the
 * GitHub/Gitea expressions such as `${{ runner.os }}`.
 */
function renderPlaceholders(text, values = FIXTURE_VALUES) {
  let out = text;
  for (const [token, value] of Object.entries(values)) {
    out = out.split(token).join(value);
  }
  return out;
}

/**
 * Keep the blocks whose feature is selected; drop the others entirely,
 * including their marker lines.
 *
 * Strict: an unmatched, nameless, or mismatched marker throws instead of
 * silently leaking a block into the output. The skill's documented procedure
 * requires the same check.
 */
function applyFeatures(text, features = ["test", "coverage", "artifact"]) {
  const selected = new Set(features);
  const lines = text.split("\n");
  const out = [];
  let current = null;   // feature of the block we are inside, or null
  let keeping = true;   // whether the current block is being kept

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    const open = line.match(/^\s*# >>> optional:(.*?)\s*$/);
    if (open) {
      const feature = open[1];
      if (!feature) {
        throw new Error(`Line ${lineNo}: optional block marker without a feature name`);
      }
      if (current !== null) {
        throw new Error(`Line ${lineNo}: nested optional block (inside "${current}")`);
      }
      current = feature;
      keeping = selected.has(feature);
      if (keeping) out.push(line);
      continue;
    }

    const close = line.match(/^\s*# <<< optional:(.*?)\s*$/);
    if (close) {
      const feature = close[1];
      if (!feature) {
        throw new Error(`Line ${lineNo}: optional block close marker without a feature name`);
      }
      if (current === null) {
        throw new Error(`Line ${lineNo}: optional block close marker without a matching open`);
      }
      if (current !== feature) {
        throw new Error(`Line ${lineNo}: close marker "${feature}" does not match open marker "${current}"`);
      }
      const wasKept = keeping;
      current = null;
      keeping = true;
      if (wasKept) out.push(line);
      continue;
    }

    if (current !== null && !keeping) continue;
    out.push(line);
  }

  if (current !== null) {
    throw new Error(`Unterminated optional block: "${current}"`);
  }

  return out.join("\n");
}

/**
 * Verify the optional-block markers in a template are well-formed.
 * Returns { ok, error }.
 */
function checkMarkers(text) {
  try {
    applyFeatures(text, []);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/** Render a template end to end. */
function render(relativePath, { features, values } = {}) {
  const filePath = path.join(TEMPLATES_ROOT, relativePath);
  const raw = fs.readFileSync(filePath, "utf8");
  return applyFeatures(renderPlaceholders(raw, values || FIXTURE_VALUES), features);
}

let pyYamlAvailable = null;

/** True when python3 with PyYAML is importable. */
function hasPyYaml() {
  if (pyYamlAvailable !== null) return pyYamlAvailable;
  try {
    execFileSync("python3", ["-c", "import yaml"], { stdio: "ignore" });
    pyYamlAvailable = true;
  } catch (e) {
    pyYamlAvailable = false;
  }
  return pyYamlAvailable;
}

/**
 * Parse YAML via PyYAML. Returns { ok, data } or { ok: false, error }.
 * PyYAML follows YAML 1.1, so the `on:` key parses as the boolean `True`.
 */
function parseYaml(content) {
  const script = [
    "import sys, yaml, json",
    "data = yaml.safe_load(sys.stdin.read())",
    "sys.stdout.write(json.dumps(data, default=str))",
  ].join("\n");
  try {
    const out = execFileSync("python3", ["-c", script], {
      input: content,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { ok: true, data: JSON.parse(out) };
  } catch (e) {
    const stderr = (e.stderr || "").toString();
    const message = stderr
      .split("\n")
      .filter(l => l.trim() && !l.includes("Traceback") && !l.startsWith(" "))
      .slice(0, 3)
      .join(" | ") || e.message;
    return { ok: false, error: message };
  }
}

/**
 * Parse XML via python3's ElementTree. Returns { ok, root } or { ok: false, error }.
 */
function parseXml(content) {
  const script = [
    "import sys, xml.etree.ElementTree as ET, json",
    "root = ET.fromstring(sys.stdin.read())",
    "tag = root.tag.split('}')[-1]",
    "sys.stdout.write(json.dumps({'tag': tag, 'ns': root.tag.startswith('{')}))",
  ].join("\n");
  try {
    const out = execFileSync("python3", ["-c", script], {
      input: content,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { ok: true, root: JSON.parse(out) };
  } catch (e) {
    const stderr = (e.stderr || "").toString();
    const message = stderr
      .split("\n")
      .filter(l => l.trim() && !l.includes("Traceback") && !l.startsWith(" "))
      .slice(0, 3)
      .join(" | ") || e.message;
    return { ok: false, error: message };
  }
}

/** Placeholders left unresolved after rendering (excluding ${{ }} expressions). */
function unresolvedPlaceholders(content) {
  const matches = content.match(/(?<!\$)\{[A-Z_]+\}/g);
  return matches ? Array.from(new Set(matches)) : [];
}

/** Step names declared in a rendered workflow. */
function stepNames(parsed) {
  const jobs = parsed && parsed.jobs;
  if (!jobs) return [];
  const names = [];
  for (const job of Object.values(jobs)) {
    for (const step of job.steps || []) {
      if (step.name) names.push(step.name);
    }
  }
  return names;
}

module.exports = {
  PLUGIN_ROOT,
  TEMPLATES_ROOT,
  FIXTURE_VALUES,
  OPTIONAL_FEATURES,
  render,
  renderPlaceholders,
  applyFeatures,
  checkMarkers,
  parseYaml,
  parseXml,
  hasPyYaml,
  unresolvedPlaceholders,
  stepNames,
};
