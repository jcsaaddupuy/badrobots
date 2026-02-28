/**
 * Unit tests for gondolin-vfs-environment (new config-file based provider)
 *
 * Tests EnvironmentDirectoryProvider with the env config file format:
 *   NAME          → propagate from process.env
 *   NAME=value    → static
 *   NAME=$OTHER   → reference
 *
 * Run with: node --test src/provider.test.ts  (Node 20+)
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EnvironmentDirectoryProvider } from "./provider";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gondolin-vfs-env-test-"));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeEnvFile(content: string): string {
  const p = path.join(tmpDir, `env-${Date.now()}-${Math.random()}`);
  fs.writeFileSync(p, content, "utf-8");
  return p;
}

function makeProvider(envFile?: string): EnvironmentDirectoryProvider {
  return new EnvironmentDirectoryProvider(envFile);
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

const PROP_KEY = "GONDOLIN_TEST_PROP_VAR";
const PROP_VAL = "hello-propagated";
const REF_KEY = "GONDOLIN_TEST_REF_SOURCE";
const REF_VAL = "ref-source-value";

before(() => {
  process.env[PROP_KEY] = PROP_VAL;
  process.env[REF_KEY] = REF_VAL;
});

after(() => {
  delete process.env[PROP_KEY];
  delete process.env[REF_KEY];
});

// ---------------------------------------------------------------------------
// No config file
// ---------------------------------------------------------------------------

describe("no envFile configured", () => {
  test("root returns empty directory", () => {
    const p = makeProvider();
    const entries = p.readdirSync("/") as string[];
    assert.deepEqual(entries, []);
  });

  test("stat on root returns directory stats", () => {
    const p = makeProvider();
    const st = p.statSync("/");
    assert.ok(st.isDirectory());
  });

  test("stat on any name throws ENOENT", () => {
    const p = makeProvider();
    assert.throws(() => p.statSync("/ANY"), (e: any) => e.code === "ENOENT");
  });
});

// ---------------------------------------------------------------------------
// Propagate format (NAME)
// ---------------------------------------------------------------------------

describe("propagate declarations", () => {
  test("lists propagated var when set in process.env", () => {
    const f = writeEnvFile(`${PROP_KEY}\n`);
    const p = makeProvider(f);
    const entries = p.readdirSync("/") as string[];
    assert.ok(entries.includes(PROP_KEY));
  });

  test("stat returns correct size", () => {
    const f = writeEnvFile(`${PROP_KEY}\n`);
    const p = makeProvider(f);
    const st = p.statSync(`/${PROP_KEY}`);
    assert.ok(st.isFile());
    assert.equal(st.size, Buffer.byteLength(PROP_VAL, "utf-8"));
  });

  test("open returns value from process.env", async () => {
    const f = writeEnvFile(`${PROP_KEY}\n`);
    const p = makeProvider(f);
    const h = await p.open(`/${PROP_KEY}`, "r");
    assert.equal(await readAll(h), PROP_VAL);
  });

  test("missing env var returns ENOENT", () => {
    const missing = "GONDOLIN_TEST_DEFINITELY_MISSING_VAR";
    delete process.env[missing];
    const f = writeEnvFile(`${missing}\n`);
    const p = makeProvider(f);
    assert.throws(() => p.statSync(`/${missing}`), (e: any) => e.code === "ENOENT");
    const entries = p.readdirSync("/") as string[];
    assert.ok(!entries.includes(missing));
  });
});

// ---------------------------------------------------------------------------
// Static format (NAME=value)
// ---------------------------------------------------------------------------

describe("static declarations", () => {
  test("serves literal value", async () => {
    const f = writeEnvFile("STATIC_VAR=hello-world\n");
    const p = makeProvider(f);
    const h = await p.open("/STATIC_VAR", "r");
    assert.equal(await readAll(h), "hello-world");
  });

  test("serves empty string for NAME=", async () => {
    const f = writeEnvFile("EMPTY_VAR=\n");
    const p = makeProvider(f);
    const h = await p.open("/EMPTY_VAR", "r");
    assert.equal(await readAll(h), "");
  });

  test("value containing = is preserved", async () => {
    const f = writeEnvFile("URL_VAR=https://example.com/path?a=1&b=2\n");
    const p = makeProvider(f);
    const h = await p.open("/URL_VAR", "r");
    assert.equal(await readAll(h), "https://example.com/path?a=1&b=2");
  });

  test("listed in readdirSync", () => {
    const f = writeEnvFile("STATIC_VAR=value\n");
    const p = makeProvider(f);
    const entries = p.readdirSync("/") as string[];
    assert.ok(entries.includes("STATIC_VAR"));
  });
});

// ---------------------------------------------------------------------------
// Reference format (NAME=$OTHER or NAME=${OTHER})
// ---------------------------------------------------------------------------

describe("reference declarations", () => {
  test("resolves $VAR reference", async () => {
    const f = writeEnvFile(`MY_TOKEN=$${REF_KEY}\n`);
    const p = makeProvider(f);
    const h = await p.open("/MY_TOKEN", "r");
    assert.equal(await readAll(h), REF_VAL);
  });

  test("resolves ${VAR} reference", async () => {
    const f = writeEnvFile(`MY_TOKEN=\${${REF_KEY}}\n`);
    const p = makeProvider(f);
    const h = await p.open("/MY_TOKEN", "r");
    assert.equal(await readAll(h), REF_VAL);
  });

  test("missing referenced var returns ENOENT", () => {
    const missing = "GONDOLIN_TEST_MISSING_REF_SRC";
    delete process.env[missing];
    const f = writeEnvFile(`MY_TOKEN=$${missing}\n`);
    const p = makeProvider(f);
    assert.throws(() => p.statSync("/MY_TOKEN"), (e: any) => e.code === "ENOENT");
    const entries = p.readdirSync("/") as string[];
    assert.ok(!entries.includes("MY_TOKEN"));
  });
});

// ---------------------------------------------------------------------------
// Comments and blank lines
// ---------------------------------------------------------------------------

describe("parsing", () => {
  test("skips comment lines", () => {
    const f = writeEnvFile(`# this is a comment\nSTATIC_A=val\n`);
    const p = makeProvider(f);
    const entries = p.readdirSync("/") as string[];
    assert.ok(entries.includes("STATIC_A"));
    assert.ok(!entries.includes("# this is a comment"));
  });

  test("skips blank lines", () => {
    const f = writeEnvFile(`\nSTATIC_A=val\n\n`);
    const p = makeProvider(f);
    const entries = p.readdirSync("/") as string[];
    assert.ok(entries.includes("STATIC_A"));
    assert.equal(entries.length, 1);
  });

  test("multiple declarations listed", () => {
    const f = writeEnvFile(`STATIC_A=a\nSTATIC_B=b\n${PROP_KEY}\n`);
    const p = makeProvider(f);
    const entries = p.readdirSync("/") as string[];
    assert.ok(entries.includes("STATIC_A"));
    assert.ok(entries.includes("STATIC_B"));
    assert.ok(entries.includes(PROP_KEY));
  });
});

// ---------------------------------------------------------------------------
// Live updates
// ---------------------------------------------------------------------------

describe("live updates", () => {
  test("new entry in config file is visible on next access", () => {
    const f = writeEnvFile("STATIC_A=val\n");
    const p = makeProvider(f);
    assert.deepEqual(p.readdirSync("/"), ["STATIC_A"]);
    fs.writeFileSync(f, "STATIC_A=val\nSTATIC_B=val2\n", "utf-8");
    const entries = p.readdirSync("/") as string[];
    assert.ok(entries.includes("STATIC_B"));
  });

  test("updated process.env value is served on next open", async () => {
    const dynKey = "GONDOLIN_TEST_LIVE_ENV";
    process.env[dynKey] = "v1";
    try {
      const f = writeEnvFile(`${dynKey}\n`);
      const p = makeProvider(f);
      const h1 = await p.open(`/${dynKey}`, "r");
      assert.equal(await readAll(h1), "v1");
      process.env[dynKey] = "v2";
      const h2 = await p.open(`/${dynKey}`, "r");
      assert.equal(await readAll(h2), "v2");
    } finally {
      delete process.env[dynKey];
    }
  });
});

// ---------------------------------------------------------------------------
// setSecretNames
// ---------------------------------------------------------------------------

describe("setSecretNames", () => {
  test("excluded secret names are not listed", () => {
    const f = writeEnvFile(`STATIC_A=val\nSECRET_X=hidden\n`);
    const p = makeProvider(f);
    p.setSecretNames(new Set(["SECRET_X"]));
    const entries = p.readdirSync("/") as string[];
    assert.ok(entries.includes("STATIC_A"));
    assert.ok(!entries.includes("SECRET_X"));
  });

  test("excluded name throws ENOENT on stat", () => {
    const f = writeEnvFile(`SECRET_X=hidden\n`);
    const p = makeProvider(f);
    p.setSecretNames(new Set(["SECRET_X"]));
    assert.throws(() => p.statSync("/SECRET_X"), (e: any) => e.code === "ENOENT");
  });

  test("excluded name throws ENOENT on open", async () => {
    const f = writeEnvFile(`SECRET_X=hidden\n`);
    const p = makeProvider(f);
    p.setSecretNames(new Set(["SECRET_X"]));
    await assert.rejects(() => p.open("/SECRET_X", "r"), (e: any) => e.code === "ENOENT");
  });

  test("returns list of conflicting names", () => {
    const f = writeEnvFile(`STATIC_A=val\nCONFLICT_VAR=something\n`);
    const p = makeProvider(f);
    const conflicts = p.setSecretNames(new Set(["CONFLICT_VAR", "UNRELATED"]));
    assert.ok(Array.isArray(conflicts));
    assert.ok(conflicts.includes("CONFLICT_VAR"));
    assert.ok(!conflicts.includes("UNRELATED"));
    assert.ok(!conflicts.includes("STATIC_A"));
  });

  test("no conflicts when secret names don't overlap", () => {
    const f = writeEnvFile(`STATIC_A=val\n`);
    const p = makeProvider(f);
    const conflicts = p.setSecretNames(new Set(["UNRELATED_SECRET"]));
    assert.deepEqual(conflicts, []);
  });
});

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

describe("read", () => {
  test("write is rejected", async () => {
    const f = writeEnvFile("STATIC_A=val\n");
    const p = makeProvider(f);
    const h = await p.open("/STATIC_A", "r");
    await assert.rejects(() => h.write(Buffer.from("x"), 0, 1), (e: any) => e.code === "EROFS");
    await h.close();
  });

  test("readFileSync returns Buffer", async () => {
    const f = writeEnvFile("STATIC_A=hello\n");
    const p = makeProvider(f);
    const h = await p.open("/STATIC_A", "r");
    const content = h.readFileSync();
    await h.close();
    assert.ok(Buffer.isBuffer(content));
    assert.equal(content.toString("utf-8"), "hello");
  });

  test("readFileSync with encoding returns string", async () => {
    const f = writeEnvFile("STATIC_A=hello\n");
    const p = makeProvider(f);
    const h = await p.open("/STATIC_A", "r");
    const content = h.readFileSync("utf-8");
    await h.close();
    assert.equal(typeof content, "string");
    assert.equal(content, "hello");
  });
});
