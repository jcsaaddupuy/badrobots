/**
 * Test suite for Gondolin configuration module
 * Run with: npx ts-node config.test.ts
 */

import {
  DEFAULT_CONFIG,
  validateConfig,
  validateEnvironmentVars,
  validateSecretsStrict,
  validateSecretsRuntime,
  resolveEnvironmentVars,
  prepareSecretsForGondolin,
  expandSkillPaths,
} from "./config";

console.log("🧪 Gondolin Configuration Tests\n");

// Test 1: Default config structure
console.log("✓ Test 1: Default configuration structure");
console.log("  Workspace:", DEFAULT_CONFIG.workspace);
console.log("  Skills:", DEFAULT_CONFIG.skills);
console.log("  Auto-attach:", DEFAULT_CONFIG.autoAttach);
console.log("  Network:", DEFAULT_CONFIG.network);

// Test 2: Validate environment variables
console.log("\n✓ Test 2: Environment variable validation");
const validEnv = {
  DEBUG: { type: "propagate" as const },
  LANG: { type: "static" as const, value: "en_US.UTF-8" },
  CONFIG_PATH: { type: "reference" as const, value: "${HOME}/.config" },
};
const envValidation = validateEnvironmentVars(validEnv);
console.log("  Valid env vars:", envValidation.valid);
console.log("  Errors:", envValidation.errors);

// Test 3: Invalid environment variable
console.log("\n✓ Test 3: Invalid environment variable detection");
const invalidEnv = {
  "123INVALID": { type: "propagate" as const },
  STATIC_NO_VALUE: { type: "static" as const },
};
const invalidEnvValidation = validateEnvironmentVars(invalidEnv);
console.log("  Valid:", invalidEnvValidation.valid);
console.log("  Errors:", invalidEnvValidation.errors);

// Test 4: Validate secrets (strict)
console.log("\n✓ Test 4: Secrets validation (strict)");
const validSecrets = {
  GITHUB_TOKEN: {
    type: "propagate" as const,
    hosts: ["api.github.com", "github.com"],
  },
  API_KEY: {
    type: "static" as const,
    value: "secret-key",
    hosts: ["api.internal.com"],
  },
};
const secretValidation = validateSecretsStrict(validSecrets);
console.log("  Valid secrets:", secretValidation.valid);
console.log("  Errors:", secretValidation.errors);

// Test 5: Invalid secrets
console.log("\n✓ Test 5: Invalid secrets detection");
const invalidSecrets = {
  INVALID_SECRET: {
    type: "propagate" as const,
    hosts: [], // Empty hosts array!
  },
  NO_VALUE_STATIC: {
    type: "static" as const,
    value: "",
    hosts: ["api.example.com"],
  },
};
const invalidSecretValidation = validateSecretsStrict(invalidSecrets);
console.log("  Valid:", invalidSecretValidation.valid);
console.log("  Errors:", invalidSecretValidation.errors);

// Test 6: Full config validation
console.log("\n✓ Test 6: Full configuration validation");
const fullConfig = {
  workspace: { mountCwd: true, defaultVmName: "default" },
  skills: {
    enabled: false,
    mountDefault: true,
    customPaths: ["/path/to/skills"],
    readOnly: true,
  },
  autoAttach: false,
  network: { allowedHosts: ["*"], blockInternalRanges: true },
  environment: validEnv,
  secrets: validSecrets,
};
const fullValidation = validateConfig(fullConfig);
console.log("  Valid:", fullValidation.valid);
console.log("  Errors:", fullValidation.errors);

// Test 7: Environment variable resolution (propagate)
console.log("\n✓ Test 7: Environment variable resolution");
process.env.TEST_PROPAGATE = "propagated_value";
const envToResolve = {
  TEST_PROPAGATE: { type: "propagate" as const },
  TEST_STATIC: { type: "static" as const, value: "static_value" },
  TEST_REF: { type: "reference" as const, value: "${HOME}/test" },
};
const resolved = resolveEnvironmentVars(envToResolve);
console.log("  Resolved env:", resolved.env);
console.log("  Warnings:", resolved.warnings);

// Test 8: Secrets preparation for Gondolin
console.log("\n✓ Test 8: Secrets preparation for Gondolin");
process.env.GITHUB_TOKEN = "test_github_token_123";
const secretsToPrep = {
  GITHUB_TOKEN: {
    type: "propagate" as const,
    hosts: ["api.github.com"],
  },
  STATIC_SECRET: {
    type: "static" as const,
    value: "static_secret_value",
    hosts: ["api.internal.com"],
  },
};
const prepared = prepareSecretsForGondolin(secretsToPrep);
console.log("  Prepared secrets keys:", Object.keys(prepared.secrets));
console.log("  Secrets structure sample:", prepared.secrets.GITHUB_TOKEN);
console.log("  Warnings:", prepared.warnings);

// Test 9: Skill path expansion
console.log("\n✓ Test 9: Skill path expansion");
const pathsToExpand = [
  "${HOME}/.pi/agent/skills",
  "~/custom/skills",
  "/absolute/path/skills",
  "./relative/skills",
];
const expanded = expandSkillPaths(pathsToExpand);
console.log("  Expanded paths:");
for (let i = 0; i < expanded.expanded.length; i++) {
  console.log(`    ${pathsToExpand[i]} → ${expanded.expanded[i]}`);
}
console.log("  Warnings:", expanded.warnings);

// Test 10: Secrets runtime validation
console.log("\n✓ Test 10: Secrets runtime validation");
const runtimeSecrets = {
  GITHUB_TOKEN: { type: "propagate" as const, hosts: ["api.github.com"] },
  MISSING_SECRET: {
    type: "propagate" as const,
    hosts: ["api.example.com"],
  },
};
const runtimeValidation = validateSecretsRuntime(runtimeSecrets);
console.log("  Runtime warnings:", runtimeValidation.warnings);

console.log("\n✅ All tests completed!\n");
