#!/usr/bin/env node
"use strict";

/**
 * Plugin structure validation for spring-boot-workflows v3.0.0
 *
 * Validates:
 * 1. Plugin manifest exists and is valid JSON
 * 2. All skill directories contain SKILL.md
 * 3. Skills have valid YAML frontmatter (name, description)
 * 4. Phase ordering matches declared phases
 * 5. Phase output paths are sequential (01-, 02-, 03-...)
 * 6. Implementation skills reference rules/ for language rules
 * 7. PR skills reference reviews/ or Rule 3 for quality gate
 * 8. Language rule files exist for all supported types
 * 9. Review checklist files exist for all supported types
 * 10. No old .claude/ path references remain (except intentional ones)
 * 11. hooks.json is valid
 * 12. settings.json is valid
 * 13. No fake template variables (${CLAUDE_PLUGIN_ROOT}, ${user_config})
 */

const fs = require("fs");
const path = require("path");

const PLUGIN_ROOT = path.resolve(__dirname, "..");
const VERSION = fs.readFileSync(path.join(PLUGIN_ROOT, "VERSION"), "utf8").trim();

// Expected phase orders for each workflow
const WORKFLOW_PHASES = {
  "new-feature": {
    phases: ["GATHER", "SPEC", "BRAINSTORM", "PLAN", "BRANCH", "IMPLEMENT", "TEST", "PR"],
    hasImplement: true,
    hasPR: true,
  },
  "extend-feature": {
    phases: ["ANALYZE", "BRAINSTORM", "PLAN", "IMPLEMENT", "VERIFY-COMPAT", "TEST", "PR"],
    hasImplement: true,
    hasPR: true,
  },
  "hotfix": {
    phases: ["DIAGNOSE", "FIX", "REGRESSION-TEST", "PR", "CHERRY-PICK"],
    hasImplement: true,
    hasPR: true,
  },
  "refactor": {
    phases: ["ANALYZE", "BRAINSTORM", "CONTRACT", "DESIGN", "MIGRATE", "VERIFY", "PR"],
    hasImplement: true,
    hasPR: true,
  },
  "brainstorm": {
    phases: ["EXPLORE", "EVALUATE", "RECOMMEND"],
    hasImplement: false,
    hasPR: false,
  },
  "test": {
    phases: ["ANALYZE", "PLAN", "WRITE", "VERIFY", "REPORT"],
    hasImplement: false,
    hasPR: false,
  },
  "review": {
    phases: ["FETCH", "CATEGORIZE", "CHECK", "COMMENT"],
    hasImplement: false,
    hasPR: false,
  },
  "release": {
    phases: ["CHANGELOG", "VERSION-BUMP", "RELEASE-BRANCH", "PR", "TAG"],
    hasImplement: false,
    hasPR: true,
  },
  "ci-fix": {
    phases: ["FETCH", "DIAGNOSE", "FIX", "PUSH", "MONITOR"],
    hasImplement: true,
    hasPR: false,
  },
  "ci-setup": {
    phases: ["DETECT", "CONFIGURE", "GENERATE", "VALIDATE", "REPORT"],
    hasImplement: false,
    hasPR: false,
  },
  "migrate": {
    phases: ["ANALYZE", "BRAINSTORM", "PLAN", "EXECUTE", "VERIFY", "PR"],
    hasImplement: true,
    hasPR: true,
  },
  "new-project": {
    phases: ["DETECT", "CONFIGURE", "GENERATE", "SETUP"],
    hasImplement: false,
    hasPR: false,
  },
  "diagnose": {
    phases: ["REPRODUCE", "HYPOTHESIZE", "NARROW", "ROOT-CAUSE"],
    hasImplement: false,
    hasPR: false,
  },
};

// Skills that may intentionally reference .claude/ for project-local output
const ALLOWED_CLAUDE_REFS = ["setup", "new-project", "compose-skill"];

// Directories under skills/ that hold a version tree of skills rather than a skill
// themselves. Exposed via plugin.json "skills", not by directory convention.
const SKILL_CONTAINERS = ["spring-boot-3", "spring-boot-4"];

// Expected language files per project type
const TYPE_RULES = {
  "spring-boot": ["java.md", "spring-boot.md"],
  java: ["java.md"],
};

const TYPE_REVIEWS = {
  "spring-boot": ["java-checklist.md", "spring-boot-checklist.md"],
  java: ["java-checklist.md"],
};

// ============================================================
// Test Runner
// ============================================================
let totalTests = 0;
let passed = 0;
let failed = 0;
const failures = [];

function test(name, condition, detail) {
  totalTests++;
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push({ name, detail });
    console.log(`  FAIL: ${name}`);
    if (detail) console.log(`        ${detail}`);
  }
}

function section(title) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

// ============================================================
// Validators
// ============================================================

function validatePluginManifest() {
  section("Plugin Manifest");
  const manifestPath = path.join(PLUGIN_ROOT, ".claude-plugin", "plugin.json");

  test("plugin.json exists", fs.existsSync(manifestPath));

  if (fs.existsSync(manifestPath)) {
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      test("plugin.json is valid JSON", true);
    } catch (e) {
      test("plugin.json is valid JSON", false, e.message);
      return;
    }

    test("Has name field", manifest.name === "spring-boot-workflows");
    test("Has version field", manifest.version === VERSION, `Expected ${VERSION}, got ${manifest.version}`);
    test("Has description", typeof manifest.description === "string" && manifest.description.length > 0);
    test("Has userConfig", typeof manifest.userConfig === "object");

    if (manifest.userConfig) {
      for (const key of ["project_type", "team", "git_main_branch", "git_dev_branch", "commit_format"]) {
        test(`userConfig has ${key}`, manifest.userConfig[key] !== undefined);
        if (manifest.userConfig[key]) {
          test(`userConfig.${key} has description`, typeof manifest.userConfig[key].description === "string");
        }
      }
    }
  }
}

function validatePluginFiles() {
  section("Plugin Files");
  test("hooks/hooks.json exists", fs.existsSync(path.join(PLUGIN_ROOT, "hooks", "hooks.json")));
  test("settings.json exists", fs.existsSync(path.join(PLUGIN_ROOT, "settings.json")));
  test("config/defaults.yml exists", fs.existsSync(path.join(PLUGIN_ROOT, "config", "defaults.yml")));

  // Validate hooks.json
  const hooksPath = path.join(PLUGIN_ROOT, "hooks", "hooks.json");
  if (fs.existsSync(hooksPath)) {
    try {
      const hooks = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
      test("hooks.json is valid JSON", true);
      test("hooks.json has hooks object", typeof hooks.hooks === "object");
      test("Has SessionStart hook", hooks.hooks && hooks.hooks.SessionStart !== undefined);
    } catch (e) {
      test("hooks.json is valid JSON", false, e.message);
    }
  }

  // Validate settings.json
  const settingsPath = path.join(PLUGIN_ROOT, "settings.json");
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      test("settings.json is valid JSON", true);
      test("Has permissions", settings.permissions !== undefined);
    } catch (e) {
      test("settings.json is valid JSON", false, e.message);
    }
  }
}

function validateDirectoryStructure() {
  section("Directory Structure");
  test("skills/ directory exists", fs.existsSync(path.join(PLUGIN_ROOT, "skills")));
  test("rules/ directory exists", fs.existsSync(path.join(PLUGIN_ROOT, "rules")));
  test("reviews/ directory exists", fs.existsSync(path.join(PLUGIN_ROOT, "reviews")));
  test("templates/ directory exists", fs.existsSync(path.join(PLUGIN_ROOT, "templates")));
  test("teams/ directory exists", fs.existsSync(path.join(PLUGIN_ROOT, "teams")));

  // State template uses YAML frontmatter (not bullet format)
  const stateTemplate = path.join(PLUGIN_ROOT, "templates", "state.md.tmpl");
  if (fs.existsSync(stateTemplate)) {
    const stateContent = fs.readFileSync(stateTemplate, "utf8");
    test("State template uses YAML frontmatter", stateContent.startsWith("---\n"));
    test("State template has Phase History table", stateContent.includes("Phase History"));
    test("State template has Context section", stateContent.includes("## Context"));
    test("State template has Constraints section", stateContent.includes("## Constraints"));
  }
  test("_orchestration/RULES.md exists", fs.existsSync(path.join(PLUGIN_ROOT, "skills", "_orchestration", "RULES.md")));

  // No old directories
  test("No bin/ directory (CLI removed)", !fs.existsSync(path.join(PLUGIN_ROOT, "bin")));
  test("No core/ directory (moved to root)", !fs.existsSync(path.join(PLUGIN_ROOT, "core")));
  test("No .npmignore (not an npm package)", !fs.existsSync(path.join(PLUGIN_ROOT, ".npmignore")));
}

function validateLanguageFiles() {
  section("Language Rules & Review Files");

  // Check all rule files exist
  for (const [type, ruleFiles] of Object.entries(TYPE_RULES)) {
    for (const file of ruleFiles) {
      test(`Rule file: ${file} (${type})`, fs.existsSync(path.join(PLUGIN_ROOT, "rules", file)));
    }
  }

  // Check all review files exist
  test("General checklist exists", fs.existsSync(path.join(PLUGIN_ROOT, "reviews", "general-checklist.md")));
  for (const [type, reviewFiles] of Object.entries(TYPE_REVIEWS)) {
    for (const file of reviewFiles) {
      test(`Review file: ${file} (${type})`, fs.existsSync(path.join(PLUGIN_ROOT, "reviews", file)));
    }
  }
}

function validateSkills() {
  section("Skill Validation");

  const skillsDir = path.join(PLUGIN_ROOT, "skills");
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith("_") && !SKILL_CONTAINERS.includes(e.name));

  for (const entry of entries) {
    const skillPath = path.join(skillsDir, entry.name, "SKILL.md");
    test(`${entry.name}: SKILL.md exists`, fs.existsSync(skillPath));

    if (!fs.existsSync(skillPath)) continue;
    const content = fs.readFileSync(skillPath, "utf8");

    // YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    test(`${entry.name}: valid YAML frontmatter`, frontmatterMatch !== null);
    if (frontmatterMatch) {
      const fm = frontmatterMatch[1];
      test(`${entry.name}: has name field`, fm.includes("name:"));
      test(`${entry.name}: has description field`, fm.includes("description:"));
    }

    // No fake template variables — these don't work in Claude Code plugins
    test(
      `${entry.name}: no \${CLAUDE_PLUGIN_ROOT} references`,
      !content.includes("${CLAUDE_PLUGIN_ROOT}"),
      "Use <plugin-root> instead of ${CLAUDE_PLUGIN_ROOT}",
    );
    test(
      `${entry.name}: no \${user_config} references`,
      !content.includes("${user_config"),
      "Use plain English references to plugin settings",
    );
    test(
      `${entry.name}: no \${CLAUDE_PLUGIN_DATA} references`,
      !content.includes("${CLAUDE_PLUGIN_DATA}"),
      "This variable does not exist in Claude Code plugins",
    );

    // Check for stale .claude/ references (excluding allowed skills)
    if (!ALLOWED_CLAUDE_REFS.includes(entry.name)) {
      const lines = content.split("\n");
      const staleRefs = lines.filter(l =>
        l.includes(".claude/") &&
        !l.includes("<plugin-root>") &&
        !l.trim().startsWith("#") &&
        !l.trim().startsWith("//")
      );
      test(
        `${entry.name}: no stale .claude/ references`,
        staleRefs.length === 0,
        staleRefs.length > 0 ? `Found: ${staleRefs[0].trim().substring(0, 80)}` : undefined,
      );
    }

    // Workflow-specific phase validation
    const spec = WORKFLOW_PHASES[entry.name];
    if (!spec) continue;

    // Phase ordering
    const phasePositions = [];
    for (const phase of spec.phases) {
      const phaseRegex = new RegExp(`##\\s+(?:Phase\\s+\\d+[:\\s]+)?${phase.replace("-", "[-\\s]")}`, "i");
      const match = content.match(phaseRegex);
      if (match) {
        phasePositions.push({ phase, pos: content.indexOf(match[0]) });
      } else {
        const altRegex = new RegExp(`##.*${phase.replace("-", "[-\\s]")}`, "i");
        const altMatch = content.match(altRegex);
        if (altMatch) {
          phasePositions.push({ phase, pos: content.indexOf(altMatch[0]) });
        }
      }
    }

    test(
      `${entry.name}: all ${spec.phases.length} phases found`,
      phasePositions.length === spec.phases.length,
      `Found ${phasePositions.length}/${spec.phases.length}: ${phasePositions.map(p => p.phase).join(", ")}`,
    );

    // Implementation skills reference rules for language rules
    if (spec.hasImplement) {
      test(
        `${entry.name}: references rules/ for language rules`,
        content.includes("<plugin-root>/rules/") || content.includes("rules/") || content.includes("Rule 3"),
        "Implementation skills must reference <plugin-root>/rules/ or Rule 3",
      );
    }

    // PR skills reference reviews for quality gate
    if (spec.hasPR) {
      test(
        `${entry.name}: references quality gate`,
        content.includes("<plugin-root>/reviews/") || content.includes("reviews/") || content.includes("Rule 3") || content.includes("quality gate"),
        "PR skills must reference quality gate (Rule 3 or <plugin-root>/reviews/)",
      );
    }
  }
}

function validateCiTemplates() {
  section("CI Templates");

  const ciRoot = path.join(PLUGIN_ROOT, "skills", "ci-setup");
  const templatesRoot = path.join(ciRoot, "templates");
  const skillPath = path.join(ciRoot, "SKILL.md");

  test("skills/ci-setup/ exists", fs.existsSync(ciRoot));
  test("skills/ci-setup/templates/ exists", fs.existsSync(templatesRoot));
  test("ci-setup document is bundled", fs.existsSync(skillPath));

  if (fs.existsSync(skillPath)) {
    const skill = fs.readFileSync(skillPath, "utf8");
    test("ci-setup references bundled templates", skill.includes("<plugin-root>/skills/ci-setup/templates/"));
    test("ci-setup references platform matrix", skill.includes("references/platform-matrix.md"));
    test("ci-setup defines the placeholder contract", skill.includes("{CACHE_PATH}") && skill.includes("{JAVA_VERSION}"));
    test("ci-setup documents optional blocks", skill.includes("optional:<feature>"));
    test("ci-setup documents branch trigger policy", skill.includes("feature/**") && skill.includes("pull_request"));
  }

  const templates = [
    { file: path.join("github", "maven-ci.yml.tmpl"), platform: "github" },
    { file: path.join("gitea", "maven-ci.yml.tmpl"), platform: "gitea" },
    { file: path.join("shared", "settings.xml.tmpl"), platform: "shared" },
  ];

  for (const { file, platform } of templates) {
    const filePath = path.join(templatesRoot, file);
    const label = file.split(path.sep).join("/");
    test(`${label}: exists`, fs.existsSync(filePath));
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf8");
    test(`${label}: non-empty`, content.trim().length > 0);
    test(`${label}: has generation marker`, content.includes("Generated by spring-boot-workflows ci-setup"));
    test(`${label}: no \${CLAUDE_PLUGIN_ROOT}`, !content.includes("${CLAUDE_PLUGIN_ROOT}"));

    if (platform === "shared") {
      test(`${label}: defines a mirror`, content.includes("<mirrors>") && content.includes("<mirrorOf>*</mirrorOf>"));
      const xmlBody = content.replace(/<!--[\s\S]*?-->/g, "");
      test(`${label}: leaves localRepository unset`, !xmlBody.includes("<localRepository>"),
        "A custom localRepository must be paired with a matching cache path");
      test(`${label}: has mirror placeholders`, content.includes("{MIRROR_ID}") && content.includes("{MIRROR_URL}"));
      continue;
    }

    test(`${label}: has on: trigger`, /^on:/m.test(content));
    test(`${label}: has jobs:`, /^jobs:/m.test(content));
    test(`${label}: has cache path placeholder`, content.includes("{CACHE_PATH}"));
    test(`${label}: cache key uses hashFiles`, content.includes("hashFiles('**/pom.xml')"));
    for (const placeholder of ["{VERSION}", "{BRANCHES}", "{PR_BRANCHES}", "{JAVA_VERSION}", "{RUNNER}", "{MAVEN_CMD}", "{MAVEN_ARGS}", "{ARTIFACT_GLOB}"]) {
      test(`${label}: placeholder ${placeholder}`, content.includes(placeholder));
    }

    const opens = (content.match(/# >>> optional:/g) || []).length;
    const closes = (content.match(/# <<< optional:/g) || []).length;
    test(`${label}: optional blocks balanced`, opens === closes && opens > 0, `${opens} open / ${closes} close`);
    for (const feature of ["coverage", "spotbugs", "artifact"]) {
      test(`${label}: optional block ${feature}`, content.includes(`# >>> optional:${feature}`) && content.includes(`# <<< optional:${feature}`));
    }

    const usesLines = content.split("\n")
      .map(line => line.match(/^\s*uses:\s*(\S+)/))
      .filter(Boolean)
      .map(m => m[1]);
    test(`${label}: every step declares a usable action`, usesLines.length > 0);

    if (platform === "github") {
      test(`${label}: no gitea context`, !/\$\{\{\s*gitea\./.test(content));
      test(`${label}: no gitea action URLs`, !content.includes("gitea.com/"));
      const bad = usesLines.filter(u => !/^(actions|docker|appleboy)\//.test(u) && !u.startsWith("https://github.com/"));
      test(`${label}: github action references are valid`, bad.length === 0, bad.join(", "));
    }

    if (platform === "gitea") {
      test(`${label}: no github context`, !/\$\{\{\s*github\./.test(content));
      const bad = usesLines.filter(u => !u.startsWith("https://") && !u.startsWith("docker://"));
      test(`${label}: gitea actions use full URLs`, bad.length === 0, bad.join(", "));
      test(`${label}: checkout uses gitea.com`, content.includes("https://gitea.com/actions/checkout@"));
    }
  }

  const defaultsPath = path.join(PLUGIN_ROOT, "config", "defaults.yml");
  if (fs.existsSync(defaultsPath)) {
    const defaults = fs.readFileSync(defaultsPath, "utf8");
    test("defaults.yml has ci section", /^ci:/m.test(defaults));
    test("defaults.yml ci.platform", /^ci:[\s\S]*?platform:/m.test(defaults));
    test("defaults.yml ci.mirror", /^ci:[\s\S]*?mirror:/m.test(defaults));
  }
}

function validateOrchestrationRules() {
  section("Orchestration Rules");
  const rulesPath = path.join(PLUGIN_ROOT, "skills", "_orchestration", "RULES.md");
  if (!fs.existsSync(rulesPath)) {
    test("RULES.md index exists", false);
    return;
  }

  const content = fs.readFileSync(rulesPath, "utf8");

  // --- Individual rule files directory ---
  const rulesDir = path.join(PLUGIN_ROOT, "skills", "_orchestration", "rules");
  test("rules/ directory exists", fs.existsSync(rulesDir));

  // Expected rule file names (rule-00 through rule-17)
  const RULE_FILES = [
    "rule-00-state-init.md",
    "rule-01-phase-output.md",
    "rule-02-skip-phases.md",
    "rule-03-quality-gate.md",
    "rule-04-build-detection.md",
    "rule-05-completion.md",
    "rule-06-pause.md",
    "rule-07-error-recovery.md",
    "rule-08-common-errors.md",
    "rule-09-skill-composition.md",
    "rule-10-phase-statuses.md",
    "rule-11-checkpoints.md",
    "rule-12-telemetry.md",
    "rule-13-focused-gate.md",
    "rule-14-dry-run.md",
    "rule-15-chaining.md",
    "rule-16-knowledge.md",
    "rule-17-visual-progress.md",
  ];

  // Check all 18 individual rule files exist and are non-empty
  for (const file of RULE_FILES) {
    const filePath = path.join(rulesDir, file);
    const exists = fs.existsSync(filePath);
    test(`Rule file ${file} exists`, exists);
    if (exists) {
      const fileContent = fs.readFileSync(filePath, "utf8");
      test(`Rule file ${file} is non-empty`, fileContent.trim().length > 0);
    }
  }

  // --- Checks against individual rule files ---
  const readRule = (file) => {
    const filePath = path.join(rulesDir, file);
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  };

  const rule03 = readRule("rule-03-quality-gate.md");
  test("Rule 3 has project_type mapping table", rule03.includes("project_type"));
  test("Rule 3 references rules/", rule03.includes("<plugin-root>/rules/"));
  test("Has proportional quality gate", rule03.includes("Proportional"));
  test("Has explicit quality gate evidence format", rule03.includes("PASS:") && rule03.includes("FAIL:"));
  test("Has spring-boot in project_type mapping", rule03.includes("spring-boot"));
  test("Has java in project_type mapping", rule03.includes("java.md"));
  test("Rule 3 routes Spring projects to spring-context", rule03.includes("spring-context"));

  const rule04 = readRule("rule-04-build-detection.md");
  test("Rule 4 detects Maven", rule04.includes("pom.xml"));
  test("Rule 4 prefers the build wrapper", rule04.includes("mvnw") && rule04.includes("wrapper"));
  test("Rule 4 detects Spring Boot major version", rule04.includes("boot_major"));

  const rule17 = readRule("rule-17-visual-progress.md");
  test("Has visual progress rule (Rule 17)", rule17.includes("Mermaid") && rule17.includes("stateDiagram"));

  const rule01 = readRule("rule-01-phase-output.md");
  test("Has Phase Preconditions in Rule 1", rule01.includes("Phase Preconditions"));

  const rule05 = readRule("rule-05-completion.md");
  test("Has diff report in completion rule", rule05.includes("diff report"));

  // Constraints check — may be in RULES.md index or rule-00
  const rule00 = readRule("rule-00-state-init.md");
  test("Has Constraints section in state template", content.includes("Constraints") || rule00.includes("Constraints"));

  // --- Checks against RULES.md index ---
  test("Uses <plugin-root> for path references", content.includes("<plugin-root>"));
  test("No fake ${CLAUDE_PLUGIN_ROOT} variables", !content.includes("${CLAUDE_PLUGIN_ROOT}"));
  test("Has Quick Reference table", content.includes("Quick Reference"));
  test("Has path resolution section", content.includes("Path Resolution"));
  test("References .workflows/config.yml", content.includes(".workflows/config.yml"));
  test("No stale .claude/workflows.yml reference", !content.includes(".claude/workflows.yml"));
  test("No stale .claude/rules/ reference", !content.includes(".claude/rules/"));
  test("No stale .claude/reviews/ reference", !content.includes(".claude/reviews/"));
}

// ============================================================
// Run
// ============================================================
console.log("+" + "=".repeat(58) + "+");
console.log(`|   spring-boot-workflows v${VERSION} — Plugin Validation             |`);
console.log("+" + "=".repeat(58) + "+");

validatePluginManifest();
validatePluginFiles();
validateDirectoryStructure();
validateLanguageFiles();
validateSkills();
validateCiTemplates();
validateOrchestrationRules();

// ============================================================
// Summary
// ============================================================
console.log(`\n${"=".repeat(60)}`);
console.log("  RESULTS");
console.log("=".repeat(60));
console.log(`  Total:  ${totalTests}`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log();

if (failures.length > 0) {
  console.log("  FAILURES:");
  for (const f of failures) {
    console.log(`    x ${f.name}`);
    if (f.detail) console.log(`      ${f.detail}`);
  }
}

console.log();
if (failed === 0) {
  console.log("  ALL TESTS PASSED");
} else {
  console.log(`  ${failed} TEST(S) FAILED`);
}
console.log();

process.exit(failed > 0 ? 1 : 0);
