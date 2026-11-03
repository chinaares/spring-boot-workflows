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
const { checkMarkers } = require("./lib/render-ci-templates");

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
  "verify": {
    phases: ["DETECT", "BUILD", "STATIC", "TEST", "SECURITY", "DIFF", "REPORT"],
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
    test("ci-setup documents integration-test policy", skill.includes("-DskipITs") && skill.includes("failsafe"));
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

    // Markers must be well-formed, not merely balanced — a nameless or
    // mismatched marker leaks a step into the generated workflow.
    const markers = checkMarkers(content);
    test(`${label}: optional markers well-formed`, markers.ok, markers.error);

    for (const feature of ["coverage", "spotbugs", "artifact"]) {
      test(`${label}: optional block ${feature}`, content.includes(`# >>> optional:${feature}`) && content.includes(`# <<< optional:${feature}`));
    }

    const usesLines = content.split("\n")
      .map(line => line.match(/^\s*uses:\s*(\S+)/))
      .filter(Boolean)
      .map(m => m[1]);
    test(`${label}: every step declares a usable action`, usesLines.length > 0);

    // Namespace checks apply to executable YAML, not comments — a comment may
    // legitimately mention the other platform's token expression.
    const yamlBody = content.split("\n").filter(l => !l.trim().startsWith("#")).join("\n");

    if (platform === "github") {
      test(`${label}: no gitea context`, !/\$\{\{\s*gitea\./.test(yamlBody));
      test(`${label}: no gitea action URLs`, !yamlBody.includes("gitea.com/"));
      const bad = usesLines.filter(u => !/^(actions|docker|appleboy)\//.test(u) && !u.startsWith("https://github.com/"));
      test(`${label}: github action references are valid`, bad.length === 0, bad.join(", "));
    }

    if (platform === "gitea") {
      test(`${label}: no github context`, !/\$\{\{\s*github\./.test(yamlBody));
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

  // Skills that generate .workflows/config.yml must copy every top-level
  // section of defaults.yml, including ci — otherwise project-level CI
  // settings are silently dropped.
  const defaultsTopLevel = fs.existsSync(defaultsPath)
    ? fs.readFileSync(defaultsPath, "utf8")
      .split("\n")
      .map(l => l.match(/^([a-z_]+):/))
      .filter(Boolean)
      .map(m => m[1])
    : [];
  test("defaults.yml has expected top-level sections", defaultsTopLevel.length > 0);
  test("defaults.yml contains a ci section", defaultsTopLevel.includes("ci"));

  for (const skill of ["setup", "new-project"]) {
    const skillPath = path.join(PLUGIN_ROOT, "skills", skill, "SKILL.md");
    if (!fs.existsSync(skillPath)) continue;
    const content = fs.readFileSync(skillPath, "utf8");
    test(`${skill}: generates .workflows/config.yml`, content.includes(".workflows/config.yml"));
    test(`${skill}: preserves the ci section`, content.includes("ci.platform"),
      "The ci section must survive config generation");
    test(
      `${skill}: copies defaults.yml in full`,
      /in full|as the base template/i.test(content),
      "The skill must copy every section of defaults.yml, not a hand-picked subset",
    );
  }
}

function validatePlatformSupport() {
  section("Platform Support");

  const refPath = path.join(PLUGIN_ROOT, "skills", "_orchestration", "references", "platform-cli.md");
  test("platform-cli reference exists", fs.existsSync(refPath));

  if (fs.existsSync(refPath)) {
    const ref = fs.readFileSync(refPath, "utf8");
    test("reference documents platform detection", ref.includes("git remote get-url origin"));
    test("reference covers CI runs", ref.includes("gh run view") && ref.includes("tea actions runs"));
    test("reference covers pull requests", ref.includes("gh pr create") && ref.includes("tea pr create"));
    test("reference covers releases", ref.includes("gh release create") && ref.includes("tea releases create"));
    test("reference lists Gitea feature gaps", ref.includes("Not supported"));
  }

  const rule08Path = path.join(PLUGIN_ROOT, "skills", "_orchestration", "rules", "rule-08-common-errors.md");
  if (fs.existsSync(rule08Path)) {
    const rule08 = fs.readFileSync(rule08Path, "utf8");
    test("rule 8 mentions both CLIs", rule08.includes("gh") && rule08.includes("tea"));
    test("rule 8 documents platform detection", rule08.includes("git remote get-url origin"));
  }

  // Skills that run CI or PR commands must handle both platforms.
  const platformSkills = {
    "ci-fix": { gitea: "tea actions runs", github: "gh run" },
    "review": { gitea: "tea pr", github: "gh pr" },
    "git-flow": { gitea: "tea pr", github: "gh pr" },
    "new-feature": { gitea: "tea pr", github: "gh pr" },
    "release": { gitea: "tea releases", github: "gh release" },
  };

  for (const [name, expected] of Object.entries(platformSkills)) {
    const skillPath = path.join(PLUGIN_ROOT, "skills", name, "SKILL.md");
    if (!fs.existsSync(skillPath)) continue;
    const content = fs.readFileSync(skillPath, "utf8");
    test(`${name}: supports GitHub CLI`, content.includes(expected.github), `expected ${expected.github}`);
    test(`${name}: supports Gitea CLI`, content.includes(expected.gitea), `expected ${expected.gitea}`);
    test(`${name}: detects the platform`,
      content.includes("git remote get-url origin") || content.includes("Detect Platform") || content.includes("Rule 8"),
      "Skills must resolve the platform before running platform-specific commands");
  }

  const ciFixPath = path.join(PLUGIN_ROOT, "skills", "ci-fix", "SKILL.md");
  if (fs.existsSync(ciFixPath)) {
    const content = fs.readFileSync(ciFixPath, "utf8");
    test("ci-fix documents platform detection step", content.includes("Step 0b"));
    test("ci-fix fetches Gitea logs", content.includes("tea actions runs logs"));
    test("ci-fix monitors on both platforms", content.includes("gh run watch") && content.includes("tea actions runs list"));
    test("ci-fix handles missing CLI", content.includes("command -v gh") && content.includes("command -v tea"));
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

function validateProjectInitParity() {
  section("Project Init Parity (setup vs new-project)");

  const readSkill = (name) => {
    const p = path.join(PLUGIN_ROOT, "skills", name, "SKILL.md");
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  };

  const setupContent = readSkill("setup");
  const newProjectContent = readSkill("new-project");

  test("setup SKILL.md exists", setupContent.length > 0);
  test("new-project SKILL.md exists", newProjectContent.length > 0);
  if (!setupContent || !newProjectContent) return;

  // --- .workflows subdirectories ---
  // new-project supersedes /setup, so it must create the same directories.
  // Later workflows depend on them: /new-feature writes specs, Rule 5
  // archives the state file into history/, /learn writes learned/.
  for (const dir of ["specs", "history", "learned"]) {
    test(
      `new-project creates .workflows/${dir}`,
      newProjectContent.includes(`.workflows/${dir}`),
      `Phase 4.1 must create .workflows/${dir}`,
    );
  }

  test(
    "new-project creates the tasks/ scaffolding",
    newProjectContent.includes("tasks/todo.md") && newProjectContent.includes("tasks/lessons.md"),
  );
  test(
    "new-project does not put tasks/ under .workflows",
    !/\.workflows\/tasks/.test(newProjectContent),
  );

  // --- .gitignore sync ---
  test("new-project syncs .gitignore", newProjectContent.includes(".gitignore"));
  test(
    "new-project keeps tasks/ out of .gitignore",
    /Do NOT add `tasks\/` to `.gitignore`/.test(newProjectContent),
  );

  const GITIGNORE_MARKER = "spring-boot-workflows state (transient)";
  const blockOf = (content) => {
    const fences = content.match(/```[\w]*\n[\s\S]*?```/g) || [];
    return fences.find((f) => f.includes(GITIGNORE_MARKER)) || "";
  };
  const patternsOf = (block) =>
    block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && !l.startsWith("```"));

  const setupPatterns = patternsOf(blockOf(setupContent));
  const newProjectPatterns = patternsOf(blockOf(newProjectContent));

  test("setup has a .gitignore block", setupPatterns.length > 0);
  test("new-project has a .gitignore block", newProjectPatterns.length > 0);

  // The two skills must ignore exactly the same paths — a project
  // initialized by one and re-synced by the other would otherwise end up
  // with a different ignore set.
  test(
    "setup and new-project ignore the same paths",
    setupPatterns.length === newProjectPatterns.length &&
      setupPatterns.every((p) => newProjectPatterns.includes(p)),
    `setup=${JSON.stringify(setupPatterns)} new-project=${JSON.stringify(newProjectPatterns)}`,
  );
  test(
    "the .gitignore block never ignores tasks/",
    !newProjectPatterns.some((p) => p.startsWith("tasks")),
    JSON.stringify(newProjectPatterns),
  );

  // --- guards ---
  test("new-project offers safety guards", newProjectContent.includes("guards.yml"));

  // --- workflow directory naming (Rule 0) ---
  // The output directory is a filesystem path, so it must be a safe
  // kebab-case name — a raw project name can contain uppercase, spaces,
  // or non-ASCII characters.
  test(
    "new-project names the output directory in kebab-case",
    /kebab-case/i.test(newProjectContent),
    "Rule 0 requires a kebab-case directory name",
  );
  test(
    "new-project caps the output directory name at 40 chars",
    /40 char/i.test(newProjectContent),
  );
  test(
    "new-project does not use a raw <project-name> directory",
    !newProjectContent.includes("<project-name>"),
    "Use <name> (kebab-case) as the directory placeholder",
  );
}

function validateSkillComposition() {
  section("Skill Composition (Rule 9 delegation)");

  const readSkill = (name) => {
    const p = path.join(PLUGIN_ROOT, "skills", name, "SKILL.md");
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  };

  // new-project delegates to ci-setup. Rule 9 requires the output to route
  // into the parent's directory and forbids a separate state file — without
  // that, the inlined skill runs its own Step 0 and overwrites the parent's
  // current-state.md.
  const newProject = readSkill("new-project");
  test("new-project mentions the ci-setup delegation", newProject.includes("ci-setup"));
  test(
    "new-project pins the ci-setup output route",
    newProject.includes("**output**"),
    "Rule 9 delegation must state where the sub-skill writes its output",
  );
  test(
    "new-project forbids overwriting current-state.md in the delegation",
    /do NOT overwrite `\.workflows\/current-state\.md`/i.test(newProject),
    "The inlined skill must not create its own state file",
  );
  test(
    "new-project skips the delegated skill's own Step 0",
    /Step 0 is skipped/i.test(newProject),
  );
  test(
    "new-project keeps the delegated output inside .workflows/<name>/",
    /this workflow's `(?:<root>\/)?\.workflows\/<name>\/`/i.test(newProject),
  );

  // new-feature delegates to brainstorm with the same contract.
  const newFeature = readSkill("new-feature");
  test(
    "new-feature routes brainstorm output to the parent directory",
    /\*\*output\*\*:\s*write to this workflow/i.test(newFeature),
  );
}

function validateNewProjectCli() {
  section("new-project CLI Contract (--path, --preset, chaining)");

  const skillPath = path.join(PLUGIN_ROOT, "skills", "new-project", "SKILL.md");
  if (!fs.existsSync(skillPath)) {
    test("new-project SKILL.md exists", false);
    return;
  }
  const content = fs.readFileSync(skillPath, "utf8");
  const fm = (content.match(/^---\n([\s\S]*?)\n---/) || [])[1] || "";

  // --- Rule 15 (chaining) ---
  const rules = (fm.match(/^rules:\s*\[([^\]]*)\]/m) || [])[1] || "";
  const ruleList = rules.split(",").map((r) => r.trim()).filter(Boolean);
  test(
    "new-project declares Rule 15 (chaining)",
    ruleList.includes("15"),
    `rules: [${ruleList.join(", ")}]`,
  );
  test(
    "new-project applies Rule 15 in Phase 4",
    /apply Rule 15/i.test(content),
  );

  // --- --path ---
  test("new-project documents --path", content.includes("--path"));
  test("new-project defines a target root", /<root>/.test(content));
  test(
    "new-project scopes git commands to the root",
    /git -C <root>/.test(content),
    "Do not cd — scope git with -C so the shell context is unchanged",
  );
  test(
    "new-project scopes file writes to the root",
    /<root>\/\.workflows\/<name>\/01-detect\.md/.test(content),
    "Phase output paths must be rooted at <root>",
  );
  test(
    "new-project creates CLAUDE.md under the root",
    /<root>\/CLAUDE\.md/.test(content),
  );

  // --- --preset ---
  test("new-project documents --preset", content.includes("--preset"));
  test(
    "new-project defines the spring-boot preset",
    /`--preset spring-boot`/.test(content),
  );
  test(
    "new-project defines the java preset",
    /`--preset java`/.test(content),
  );
  test(
    "the preset table covers type, language, boot_major, build_tool and persistence",
    /project\.type/.test(content) &&
      /project\.language/.test(content) &&
      /project\.spring\.boot_major/.test(content) &&
      /project\.spring\.build_tool/.test(content) &&
      /project\.spring\.persistence/.test(content),
  );
  test(
    "the preset never guesses boot_major",
    /boot_major` \| ask/i.test(content) && /never guess/i.test(content),
  );
  test(
    "detected values take precedence over the preset",
    /Detected values always win/i.test(content),
  );
  test(
    "a preset contradiction is reported, not silently resolved",
    /contradicts the preset/i.test(content),
  );
}

function validateInitFeatureParity() {
  section("Init Feature Parity (setup vs new-project)");

  const readSkill = (name) => {
    const p = path.join(PLUGIN_ROOT, "skills", name, "SKILL.md");
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  };
  const setup = readSkill("setup");
  const newProject = readSkill("new-project");
  if (!setup || !newProject) return;

  // --- config validation: both skills must run the same checks ---
  const validationOf = (content) =>
    content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^\d+\.\s+Verify/.test(l));
  const setupChecks = validationOf(setup);
  const newChecks = validationOf(newProject);

  test("setup has config validation checks", setupChecks.length >= 8, `${setupChecks.length} checks`);
  test("new-project has config validation checks", newChecks.length >= 8, `${newChecks.length} checks`);
  test(
    "setup and new-project run the same config validation",
    setupChecks.length === newChecks.length && setupChecks.every((c, i) => c === newChecks[i]),
    `setup=${JSON.stringify(setupChecks)}\nnew-project=${JSON.stringify(newChecks)}`,
  );

  // --- user plugin settings layer ---
  for (const key of ["project_type", "team", "git_main_branch", "git_dev_branch", "commit_format"]) {
    test(`new-project applies the ${key} user setting`, newProject.includes(key));
  }
  test(
    "new-project treats user settings as a fallback, not an override",
    /fallback, not an override/i.test(newProject),
  );
  test(
    "setup treats user settings as a fallback, not an override",
    /fallback, not an override/i.test(setup),
  );
  test(
    "new-project declares the config precedence chain",
    /detected value →/.test(newProject) && /user plugin setting →/.test(newProject),
  );
  test(
    "setup declares the config precedence chain",
    /detected value →/.test(setup) && /user plugin setting →/.test(setup),
  );

  // --- v2.x migration check ---
  for (const [label, content] of [["setup", setup], ["new-project", newProject]]) {
    test(
      `${label} checks .claude/workflows.yml for v2.x migration`,
      content.includes(".claude/workflows.yml"),
    );
    test(
      `${label} checks .claude/.workflows-version`,
      content.includes(".claude/.workflows-version"),
    );
  }

  // --- guards installation ---
  test(
    "new-project installs guards from the template",
    newProject.includes("templates/guards.yml.tmpl") && newProject.includes(".workflows/guards.yml"),
  );
  test(
    "setup installs guards from the template",
    setup.includes("templates/guards.yml.tmpl") && setup.includes(".workflows/guards.yml"),
  );
}

// ============================================================
// Domain Skills (the spring-boot-3 / spring-boot-4 version trees)
// ============================================================

/**
 * Minimal frontmatter reader for the subset of YAML the skills use:
 * `key: value`, `key: >` (folded, with or without inline text), and
 * `key:` followed by an indented block. Good enough to check the fields the
 * house conventions depend on.
 */
function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const lines = m[1].split("\n");
  const out = {};
  for (let i = 0; i < lines.length; i++) {
    const km = lines[i].match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!km) continue;
    const key = km[1];
    const rest = km[2].trim();
    if (rest.startsWith(">") || rest.startsWith("|")) {
      const buf = [];
      const inline = rest.slice(1).trim();
      if (inline) buf.push(inline);
      let j = i + 1;
      while (j < lines.length && (lines[j].startsWith("  ") || lines[j].trim() === "")) {
        if (lines[j].trim() === "") { buf.push(""); j++; continue; }
        buf.push(lines[j].trim());
        j++;
      }
      out[key] = buf.join(" ").replace(/\s+/g, " ").trim();
      i = j - 1;
    } else {
      out[key] = rest.replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

function validateDomainSkills() {
  section("Domain Skills (version trees)");

  const FORBIDDEN = [
    { token: "${CLAUDE_PLUGIN_ROOT}", hint: "Use <plugin-root>" },
    { token: "${user_config", hint: "Use plain English references to plugin settings" },
    { token: "${CLAUDE_PLUGIN_DATA}", hint: "This variable does not exist in Claude Code plugins" },
  ];

  const boot4Names = [];

  for (const container of SKILL_CONTAINERS) {
    const containerDir = path.join(PLUGIN_ROOT, "skills", container);
    test(`${container}: directory exists`, fs.existsSync(containerDir));
    if (!fs.existsSync(containerDir)) continue;

    const topics = fs.readdirSync(containerDir, { withFileTypes: true })
      .filter(e => e.isDirectory());

    for (const topic of topics) {
      const label = `${container}/${topic.name}`;
      const skillPath = path.join(containerDir, topic.name, "SKILL.md");
      test(`${label}: SKILL.md exists`, fs.existsSync(skillPath));
      if (!fs.existsSync(skillPath)) continue;

      const content = fs.readFileSync(skillPath, "utf8");
      const fm = parseFrontmatter(content);

      test(`${label}: valid YAML frontmatter`, fm !== null);
      if (!fm) continue;

      // The router refers to skills by their frontmatter name, so a mismatch
      // between the name and the directory silently breaks routing.
      test(`${label}: has name field`, Boolean(fm.name));
      test(
        `${label}: name matches directory`,
        fm.name === topic.name,
        `frontmatter name is "${fm.name}", directory is "${topic.name}"`,
      );
      if (container === "spring-boot-4") boot4Names.push(fm.name || topic.name);

      // House convention: a domain-skill description says when to use the
      // skill. Boot 4 opens with "Use when"; Boot 3 prefixes the variant
      // marker before the same sentence.
      test(`${label}: has description field`, Boolean(fm.description));
      test(
        `${label}: description says when to use the skill`,
        typeof fm.description === "string" && fm.description.includes("Use when"),
        fm.description ? `got: "${fm.description.slice(0, 60)}"` : undefined,
      );
      if (container === "spring-boot-3") {
        test(
          `${label}: description carries the Boot 3 variant marker`,
          typeof fm.description === "string" && fm.description.startsWith("(Boot 3 variant"),
          fm.description ? `got: "${fm.description.slice(0, 60)}"` : undefined,
        );
      } else {
        test(
          `${label}: description opens with "Use when"`,
          typeof fm.description === "string" && fm.description.startsWith("Use when"),
          fm.description ? `got: "${fm.description.slice(0, 60)}"` : undefined,
        );
      }

      // Domain skills carry no orchestration rules — they are composed, not run.
      test(`${label}: declares no orchestration rules`, fm.rules === undefined);

      for (const { token, hint } of FORBIDDEN) {
        test(
          `${label}: no ${token} references`,
          !content.includes(token),
          hint,
        );
      }

      // agents/openai.yaml is optional, but when present it must be the
      // 4-line interface shim.
      const agentYaml = path.join(containerDir, topic.name, "agents", "openai.yaml");
      if (fs.existsSync(agentYaml)) {
        const yaml = fs.readFileSync(agentYaml, "utf8");
        for (const field of ["display_name", "short_description", "default_prompt"]) {
          test(`${label}: agents/openai.yaml has ${field}`, yaml.includes(`${field}:`));
        }
        test(`${label}: agents/openai.yaml has an interface block`, yaml.includes("interface:"));
      }
    }
  }

  // Every vendored Boot 4 skill must be reachable from the router — a skill
  // nothing can select is dead weight in the knowledge set.
  const routerPath = path.join(PLUGIN_ROOT, "skills", "spring-context", "SKILL.md");
  const router = fs.existsSync(routerPath) ? fs.readFileSync(routerPath, "utf8") : "";
  for (const name of boot4Names) {
    test(
      `router: reaches ${name}`,
      router.includes(name),
      `${name} is not mentioned in skills/spring-context/SKILL.md`,
    );
  }
}

// ============================================================
// Config consistency
// ============================================================

/**
 * Minimal YAML reader for config/defaults.yml — nested maps, inline flow
 * mappings `{a: b}`, inline flow sequences `[a, b]`, and scalars. Block
 * scalars (`|`) are kept as their literal marker; nothing in the assertions
 * below reads them.
 */
function parseSimpleYaml(text) {
  const root = {};
  const stack = [{ indent: -1, node: root }];
  const coerce = (v) => {
    const t = v.trim().replace(/^["']|["']$/g, "");
    if (/^-?\d+$/.test(t)) return parseInt(t, 10);
    if (/^-?\d*\.\d+$/.test(t)) return parseFloat(t);
    return t;
  };
  for (const raw of text.split("\n")) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim().replace(/\s+#.*$/, "");
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].node;
    const km = line.match(/^([^:]+):\s*(.*)$/);
    if (!km) continue;
    const key = km[1].trim();
    const rest = km[2].trim();
    if (rest === "") {
      const node = {};
      parent[key] = node;
      stack.push({ indent, node });
    } else if (rest.startsWith("{") && rest.endsWith("}")) {
      const obj = {};
      for (const part of rest.slice(1, -1).split(",")) {
        const idx = part.indexOf(":");
        if (idx === -1) continue;
        obj[part.slice(0, idx).trim()] = coerce(part.slice(idx + 1));
      }
      parent[key] = obj;
    } else if (rest.startsWith("[") && rest.endsWith("]")) {
      parent[key] = rest.slice(1, -1).split(",").map(coerce).filter(v => v !== "");
    } else {
      parent[key] = coerce(rest);
    }
  }
  return root;
}

/** Every file the plugin ships, as one searchable string. */
function collectPluginText(extensions = [".md", ".yml", ".json", ".js", ".py", ".tmpl", ".yaml"]) {
  const parts = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (extensions.some(ext => entry.name.endsWith(ext))) {
        parts.push(fs.readFileSync(full, "utf8"));
      }
    }
  };
  walk(PLUGIN_ROOT);
  return parts.join("\n");
}

function validateConfigConsistency() {
  section("Configuration consistency");

  const defaultsPath = path.join(PLUGIN_ROOT, "config", "defaults.yml");
  test("config/defaults.yml exists", fs.existsSync(defaultsPath));
  if (!fs.existsSync(defaultsPath)) return;

  const config = parseSimpleYaml(fs.readFileSync(defaultsPath, "utf8"));
  const pluginText = collectPluginText();

  // --- a config key that nothing reads is a key that does nothing ---
  // These are the gate-shaped keys: each one silently disables a check when
  // it is changed, so each one must be read by at least one skill or rule.
  const mustBeLive = [
    "guards.enabled",
    "guards.strict",
    "guards.config",
    "quality.proportional",
    "quality.self_review",
    "quality.focused_gate",
    "workflows.review.checklist",
    "workflows.review.size_thresholds",
    "workflows.review.context_thresholds",
    "workflows.test.default_coverage",
    "ci.features",
    "ci.java_versions",
    "verify.checks",
    "verify.coverage_threshold",
    "verify.coverage_scope",
    "verify.static_analysis",
    "verify.static_fail_on",
    "verify.dependency_scan",
    "verify.secret_scan",
    "verify.findings_file",
  ];

  for (const keyPath of mustBeLive) {
    test(
      `config: ${keyPath} is read somewhere`,
      pluginText.includes(keyPath),
      `${keyPath} is declared in config/defaults.yml but nothing references it`,
    );
  }

  // --- the review thresholds must agree with the rule that documents them ---
  const thresholds = config.workflows && config.workflows.review
    ? config.workflows.review.size_thresholds
    : null;
  test("config: workflows.review.size_thresholds exists", Boolean(thresholds));
  test("config: size_thresholds.light exists", Boolean(thresholds && thresholds.light));
  test("config: size_thresholds.standard exists", Boolean(thresholds && thresholds.standard));

  const rule03Path = path.join(PLUGIN_ROOT, "skills", "_orchestration", "rules", "rule-03-quality-gate.md");
  const rule03 = fs.existsSync(rule03Path) ? fs.readFileSync(rule03Path, "utf8") : "";
  test("rule-03 exists", rule03.length > 0);

  if (thresholds && thresholds.light && thresholds.standard && rule03) {
    // The rule must document the shipped numbers, not a second set of numbers.
    for (const value of [
      thresholds.light.max_files,
      thresholds.light.max_lines,
      thresholds.standard.max_files,
    ]) {
      test(
        `rule-03 documents threshold ${value}`,
        rule03.includes(String(value)),
        `config says ${value} but rule-03 does not mention it`,
      );
    }
    test(
      "rule-03 defers to the config block as the source of truth",
      /size_thresholds/.test(rule03),
      "rule-03 must read the thresholds from config instead of hardcoding them",
    );
    // The per-key paths matter: a project config generated before the block was
    // reshaped has no `light`/`standard` keys, so the rule has to fall back
    // key by key and say what to do with the legacy shape.
    for (const keyPath of [
      "size_thresholds.light.max_files",
      "size_thresholds.light.max_lines",
      "size_thresholds.standard.max_files",
    ]) {
      test(
        `rule-03 names the config path ${keyPath}`,
        rule03.includes(keyPath),
        "rule-03 must name each threshold's config path so the fallback is per key",
      );
    }
    test(
      "rule-03 explains how to handle a legacy thresholds block",
      /legacy/i.test(rule03) && /defaults/i.test(rule03),
      "rule-03 must say what to do with a project config that predates the current shape",
    );
  }

  // --- verify skill must exist and be registered ---
  const verifyPath = path.join(PLUGIN_ROOT, "skills", "verify", "SKILL.md");
  test("skills/verify/SKILL.md exists", fs.existsSync(verifyPath));
  if (fs.existsSync(verifyPath)) {
    const verify = fs.readFileSync(verifyPath, "utf8");
    const verifyFm = parseFrontmatter(verify);
    test("verify: has name field", Boolean(verifyFm && verifyFm.name));
    test("verify: name is 'verify'", verifyFm && verifyFm.name === "verify");
    // Every check the config can turn on must be handled by the skill.
    for (const phase of ["DETECT", "BUILD", "STATIC", "TEST", "SECURITY", "DIFF", "REPORT"]) {
      test(`verify: declares phase ${phase}`, verify.includes(`Phase ${phase}`) || verify.includes(phase));
    }
    test(
      "verify: writes a machine-readable findings file",
      verify.includes("findings.json"),
    );
    test(
      "verify: reports a skipped check as skipped",
      /SKIPPED/.test(verify),
    );
  }

  // --- every orchestration rule index referenced by a skill must exist ---
  const rulesDir = path.join(PLUGIN_ROOT, "skills", "_orchestration", "rules");
  const ruleFiles = fs.existsSync(rulesDir)
    ? fs.readdirSync(rulesDir).filter(f => /^rule-\d\d-.*\.md$/.test(f))
    : [];
  const skillsDir = path.join(PLUGIN_ROOT, "skills");
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("_") || SKILL_CONTAINERS.includes(entry.name)) continue;
    const p = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(p)) continue;
    const fm = parseFrontmatter(fs.readFileSync(p, "utf8"));
    if (!fm || fm.rules === undefined) continue;
    const indices = String(fm.rules).match(/\d+/g) || [];
    for (const idx of indices) {
      test(
        `${entry.name}: rules index ${idx} exists`,
        Number(idx) < ruleFiles.length,
        `only ${ruleFiles.length} rules exist (indices 0..${ruleFiles.length - 1})`,
      );
    }
  }
}

// ============================================================
// Guards template
// ============================================================

/**
 * The guard rules are regexes that a broken one silently stops matching —
 * the fork-bomb pattern was a no-op for months because `:` alternated with
 * the rest. Every pattern must compile, and the ones that used to be broken
 * must still match.
 */
function validateGuardsTemplate() {
  section("Guards Template");

  const tmplPath = path.join(PLUGIN_ROOT, "templates", "guards.yml.tmpl");
  test("templates/guards.yml.tmpl exists", fs.existsSync(tmplPath));
  if (!fs.existsSync(tmplPath)) return;

  const content = fs.readFileSync(tmplPath, "utf8");

  // Pull the pattern lists out without a YAML dependency: the template lists
  // each entry as a single-quoted string under a two-space-indented key.
  const lists = { block_patterns: [], warn_patterns: [], token_patterns: [] };
  let current = null;
  for (const raw of content.split("\n")) {
    const keyMatch = raw.match(/^ {2}([a-z_]+):\s*$/);
    if (keyMatch) {
      current = keyMatch[1];
      continue;
    }
    if (!current || !lists[current]) continue;
    // The pattern entries may carry a trailing comment.
    const item = raw.match(/^ {4}-\s+'(.*)'\s*(?:#.*)?$/);
    if (item) lists[current].push(item[1].replace(/''/g, "'"));
  }

  for (const key of Object.keys(lists)) {
    test(`guards: ${key} has entries`, lists[key].length > 0);
    for (const pattern of lists[key]) {
      let compiles = true;
      try {
        new RegExp(pattern);
      } catch (e) {
        compiles = false;
      }
      test(`guards: ${key} pattern compiles`, compiles, pattern);
    }
  }

  // The template must use single quotes for the pattern lists — a double-quoted
  // YAML string turns `\.` into an invalid escape and the whole file fails to
  // parse, which silently disables every rule in it.
  for (const key of Object.keys(lists)) {
    const keyLine = content.split("\n").findIndex(l => l === `  ${key}:`);
    test(`guards: ${key} key present in template`, keyLine !== -1);
    if (keyLine === -1) continue;
    const lines = content.split("\n").slice(keyLine + 1);
    const items = [];
    for (const line of lines) {
      if (/^ {2}\S/.test(line)) break;
      if (/^ {4}-/.test(line)) items.push(line);
    }
    const doubleQuoted = items.filter(l => /-\s+"/.test(l));
    test(
      `guards: ${key} uses single-quoted patterns`,
      doubleQuoted.length === 0,
      doubleQuoted[0] ? doubleQuoted[0].trim() : undefined,
    );
  }

  // Spot-check the patterns that used to be silently broken.
  const matches = (key, sample) => lists[key].some(p => new RegExp(p).test(sample));
  test("guards: fork bomb pattern matches", matches("block_patterns", ":(){:|:&};:"));
  test("guards: 'rm -rf .' matches", matches("block_patterns", "rm -rf ."));
  test("guards: 'mkfs.ext4' matches", matches("block_patterns", "mkfs.ext4"));
  test("guards: DROP TABLE matches", matches("block_patterns", "DROP TABLE users"));
  test("guards: benign command does not match", !matches("block_patterns", "echo hello"));
  test("guards: SQL UPDATE warns", matches("warn_patterns", "UPDATE users SET name = 'x' WHERE id = 1"));
  test("guards: AWS key detected", matches("token_patterns", "AKIAIOSFODNN7EXAMPLE"));
  test("guards: GitHub token detected", matches("token_patterns", "ghp_1234567890abcdefghijklmnopqrstuvwxyz"));
  test("guards: inline URL credentials detected", matches("token_patterns", "postgres://user:secret@localhost/db"));
  test("guards: ordinary code does not trip the token scan", !matches("token_patterns", "int total = 42;"));

  // The path lists are globs, not regexes — a glob pattern in a regex list
  // would match nothing.
  test(
    "guards: protected_paths are globs",
    content.includes("    - \"*.pem\""),
    "path lists must stay glob-shaped",
  );
  test(
    "guards: skill documents the two matchers",
    (() => {
      const skillPath = path.join(PLUGIN_ROOT, "skills", "guards", "SKILL.md");
      const skill = fs.existsSync(skillPath) ? fs.readFileSync(skillPath, "utf8") : "";
      return /regex/i.test(skill) && /glob/i.test(skill);
    })(),
    "skills/guards/SKILL.md must state which matcher applies to which list",
  );
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
validateDomainSkills();
validateConfigConsistency();
validateGuardsTemplate();
validateCiTemplates();
validatePlatformSupport();
validateOrchestrationRules();
validateProjectInitParity();
validateSkillComposition();
validateNewProjectCli();
validateInitFeatureParity();

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
