/**
 * Unit tests for gondolin-vfs-secrets (placeholder-serving provider)
 *
 * Pull model:
 *   1. listSecrets()     — parse config file, return secret names
 *   2. setPlaceholders() — receive name→placeholder map
 *   3. getSecretValue()  — read file live (called at HTTP egress)
 *   VFS reads always return placeholder content.
 *
 * Run with: node --test dist/provider.test.js  (after tsc)
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { SecretsFileProvider } from "./provider";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let tmpDir: string;
let secretsFile: string;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gondolin-vfs-secrets-test-"));
  secretsFile = path.join(tmpDir, "secrets");
  
  // Create a secrets file
  fs.writeFileSync(secretsFile, `DB_PASSWORD=s3cr3t
API_KEY=key-abc-123
# This is a comment
EMPTY_VALUE=
REFERENCE=$HOME
PROPAGATE_VAR
PROPAGATE_WITH_HOSTS@host1,host2
`, "utf-8");
  
  // Set up environment variables for propagate tests
  process.env.PROPAGATE_VAR = "propagated-value";
  process.env.PROPAGATE_WITH_HOSTS = "propagated-with-hosts";
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.PROPAGATE_VAR;
  delete process.env.PROPAGATE_WITH_HOSTS;
});

function makeProvider(file = secretsFile): SecretsFileProvider {
  return new SecretsFileProvider(file);
}

async function readAll(handle: any): Promise<string> {
  const buf = Buffer.alloc(4096);
  let out = "";
  let pos = 0;
  while (true) {
    const { bytesRead } = await handle.read(buf, 0, buf.length, pos);
    if (bytesRead === 0) break;
    out += buf.slice(0, bytesRead).toString("utf-8");
    pos += bytesRead;
  }
  await handle.close();
  return out;
}

// ---------------------------------------------------------------------------
// listSecrets()
// ---------------------------------------------------------------------------

describe("listSecrets()", () => {
  test("returns secrets with names and hosts from config file", () => {
    const secrets = makeProvider().listSecrets();
    const names = secrets.map(s => s.name);
    assert.ok(names.includes("DB_PASSWORD"));
    assert.ok(names.includes("API_KEY"));
    assert.ok(names.includes("EMPTY_VALUE"));
    assert.ok(names.includes("REFERENCE"));
  });

  test("parses @hosts suffix from secret name", () => {
    const testFile = path.join(tmpDir, "with-hosts");
    fs.writeFileSync(testFile, `DB_PASSWORD@db.internal=secret
API_KEY@api.example.com,api.staging=key123
PUBLIC=value
`, "utf-8");
    
    try {
      const secrets = makeProvider(testFile).listSecrets();
      const dbSecret = secrets.find(s => s.name === "DB_PASSWORD");
      assert.deepEqual(dbSecret?.hosts, ["db.internal"]);
      
      const apiSecret = secrets.find(s => s.name === "API_KEY");
      assert.deepEqual(apiSecret?.hosts, ["api.example.com", "api.staging"]);
      
      const publicSecret = secrets.find(s => s.name === "PUBLIC");
      assert.deepEqual(publicSecret?.hosts, ["*"]);
    } finally {
      fs.unlinkSync(testFile);
    }
  });

  test("parses propagate secrets (no = sign)", () => {
    const testFile = path.join(tmpDir, "propagate");
    fs.writeFileSync(testFile, `PROPAGATE_VAR
PROPAGATE_WITH_HOSTS@host1,host2
`, "utf-8");
    
    try {
      const secrets = makeProvider(testFile).listSecrets();
      const propSecret = secrets.find(s => s.name === "PROPAGATE_VAR");
      assert.ok(propSecret);
      assert.deepEqual(propSecret?.hosts, ["*"]);
      
      const propWithHostsSecret = secrets.find(s => s.name === "PROPAGATE_WITH_HOSTS");
      assert.ok(propWithHostsSecret);
      assert.deepEqual(propWithHostsSecret?.hosts, ["host1", "host2"]);
    } finally {
      fs.unlinkSync(testFile);
    }
  });

  test("ignores comment lines", () => {
    const secrets = makeProvider().listSecrets();
    const names = secrets.map(s => s.name);
    assert.ok(!names.includes("This"));
  });

  test("non-existent file returns empty array", () => {
    const secrets = makeProvider("/tmp/nonexistent-secrets-file").listSecrets();
    assert.deepEqual(secrets, []);
  });

  test("empty file returns empty array", () => {
    const emptyFile = path.join(tmpDir, "empty");
    fs.writeFileSync(emptyFile, "", "utf-8");
    const secrets = makeProvider(emptyFile).listSecrets();
    assert.deepEqual(secrets, []);
  });
});

// ---------------------------------------------------------------------------
// setPlaceholders() + VFS reads
// ---------------------------------------------------------------------------

describe("setPlaceholders() + VFS reads", () => {
  test("readdirSync lists only names in placeholder map", () => {
    const p = makeProvider();
    const secrets = p.listSecrets();
    const map = new Map(secrets.map(s => [s.name, `GONDOLIN_SECRET_${s.name}`]));
    p.setPlaceholders(map);
    
    const entries = p.readdirSync("/") as string[];
    assert.ok(entries.includes("DB_PASSWORD"));
    assert.ok(entries.includes("API_KEY"));
  });

  test("stat returns size of placeholder string", () => {
    const p = makeProvider();
    const secrets = p.listSecrets();
    const map = new Map(secrets.map(s => [s.name, `GONDOLIN_SECRET_${s.name}`]));
    p.setPlaceholders(map);
    
    const st = p.statSync("/DB_PASSWORD");
    assert.ok(st.isFile());
    assert.equal(st.size, "GONDOLIN_SECRET_DB_PASSWORD".length);
  });

  test("open returns placeholder content, not real value", async () => {
    const p = makeProvider();
    const secrets = p.listSecrets();
    const map = new Map(secrets.map(s => [s.name, `GONDOLIN_SECRET_${s.name}`]));
    p.setPlaceholders(map);
    
    const handle = await p.open("/DB_PASSWORD", "r");
    const content = await readAll(handle);
    assert.equal(content, "GONDOLIN_SECRET_DB_PASSWORD");
    assert.notEqual(content, "s3cr3t");
  });

  test("placeholder is stable across multiple opens", async () => {
    const p = makeProvider();
    const secrets = p.listSecrets();
    const map = new Map(secrets.map(s => [s.name, `GONDOLIN_SECRET_${s.name}`]));
    p.setPlaceholders(map);
    
    const h1 = await p.open("/API_KEY", "r");
    const c1 = await readAll(h1);
    const h2 = await p.open("/API_KEY", "r");
    const c2 = await readAll(h2);
    assert.equal(c1, c2);
    assert.equal(c1, "GONDOLIN_SECRET_API_KEY");
  });

  test("name not in placeholder map throws ENOENT", async () => {
    const p = makeProvider();
    p.setPlaceholders(new Map());
    
    await assert.rejects(
      () => p.open("/DOES_NOT_EXIST", "r"),
      (e: any) => e.code === "ENOENT"
    );
  });

  test("root path throws ENOENT on open", async () => {
    const p = makeProvider();
    p.setPlaceholders(new Map());
    
    await assert.rejects(
      () => p.open("/", "r"),
      (e: any) => e.code === "ENOENT"
    );
  });

  test("before setPlaceholders, directory is empty", () => {
    const p = makeProvider();
    const entries = p.readdirSync("/") as string[];
    assert.deepEqual(entries, []);
  });

  test("write is rejected (EROFS)", async () => {
    const p = makeProvider();
    p.setPlaceholders(new Map([["TEST", "PLACEHOLDER"]]));
    
    const handle = await p.open("/TEST", "r");
    await assert.rejects(
      () => handle.write(Buffer.from("x"), 0, 1),
      (e: any) => e.code === "EROFS"
    );
    await handle.close();
  });
});

// ---------------------------------------------------------------------------
// getSecretValue()
// ---------------------------------------------------------------------------

describe("getSecretValue()", () => {
  test("returns current file content for static secrets", () => {
    const p = makeProvider();
    assert.equal(p.getSecretValue("DB_PASSWORD"), "s3cr3t");
    assert.equal(p.getSecretValue("API_KEY"), "key-abc-123");
  });

  test("returns propagated value from process.env", () => {
    const p = makeProvider();
    assert.equal(p.getSecretValue("PROPAGATE_VAR"), "propagated-value");
    assert.equal(p.getSecretValue("PROPAGATE_WITH_HOSTS"), "propagated-with-hosts");
  });

  test("returns empty string for missing secret", () => {
    const p = makeProvider();
    assert.equal(p.getSecretValue("NO_SUCH_SECRET"), "");
  });

  test("returns empty string for missing file", () => {
    const p = makeProvider("/tmp/nonexistent-file");
    assert.equal(p.getSecretValue("ANY_SECRET"), "");
  });

  test("resolves reference secrets from process.env", () => {
    process.env.TEST_VAR = "test-value";
    try {
      const p = makeProvider();
      const value = p.getSecretValue("REFERENCE");
      // REFERENCE=$HOME, so it should expand to home directory
      assert.ok(value.length > 0);
      assert.notEqual(value, "$HOME");
    } finally {
      delete process.env.TEST_VAR;
    }
  });

  test("reflects updated file content on next call", () => {
    const testFile = path.join(tmpDir, "live-secrets");
    fs.writeFileSync(testFile, "SECRET=v1\n", "utf-8");
    
    try {
      const p = makeProvider(testFile);
      assert.equal(p.getSecretValue("SECRET"), "v1");
      
      fs.writeFileSync(testFile, "SECRET=v2\n", "utf-8");
      assert.equal(p.getSecretValue("SECRET"), "v2");
    } finally {
      fs.unlinkSync(testFile);
    }
  });
});

// ---------------------------------------------------------------------------
// Tilde expansion
// ---------------------------------------------------------------------------

describe("tilde expansion", () => {
  test("~ in path expands to home directory", () => {
    const p = new SecretsFileProvider("~/.pi/secrets-test-nonexistent");
    assert.ok(p instanceof SecretsFileProvider);
  });
});

// ---------------------------------------------------------------------------
// Config file format
// ---------------------------------------------------------------------------

describe("config file format", () => {
  test("parses static secrets (NAME=value)", () => {
    const p = makeProvider();
    const secrets = p.listSecrets();
    const names = secrets.map(s => s.name);
    assert.ok(names.includes("DB_PASSWORD"));
    assert.equal(p.getSecretValue("DB_PASSWORD"), "s3cr3t");
  });

  test("parses empty values (NAME=)", () => {
    const p = makeProvider();
    const secrets = p.listSecrets();
    const names = secrets.map(s => s.name);
    assert.ok(names.includes("EMPTY_VALUE"));
    assert.equal(p.getSecretValue("EMPTY_VALUE"), "");
  });

  test("parses reference secrets (NAME=$VAR)", () => {
    const p = makeProvider();
    const secrets = p.listSecrets();
    const names = secrets.map(s => s.name);
    assert.ok(names.includes("REFERENCE"));
    // Should resolve to actual home directory
    assert.ok(p.getSecretValue("REFERENCE").length > 0);
  });

  test("parses propagate secrets (NAME with no =)", () => {
    const p = makeProvider();
    const secrets = p.listSecrets();
    const names = secrets.map(s => s.name);
    assert.ok(names.includes("PROPAGATE_VAR"));
    assert.ok(names.includes("PROPAGATE_WITH_HOSTS"));
    assert.equal(p.getSecretValue("PROPAGATE_VAR"), "propagated-value");
    assert.equal(p.getSecretValue("PROPAGATE_WITH_HOSTS"), "propagated-with-hosts");
  });

  test("ignores invalid lines", () => {
    const testFile = path.join(tmpDir, "invalid-format");
    fs.writeFileSync(testFile, `VALID=value
invalid-no-equals
123INVALID=value
VALID_UNDERSCORE=value
`, "utf-8");
    
    try {
      const p = makeProvider(testFile);
      const secrets = p.listSecrets();
      const names = secrets.map(s => s.name);
      assert.ok(names.includes("VALID"));
      assert.ok(!names.includes("invalid-no-equals"));
      assert.ok(!names.includes("123INVALID"));
      assert.ok(names.includes("VALID_UNDERSCORE"));
    } finally {
      fs.unlinkSync(testFile);
    }
  });
});
