import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { calculateWidgetContentHash } from "./contentHash.js";

function withTempDirectory(run: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bar-widget-hash-"));
  try {
    run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("hash format has a stable test vector", () => {
  withTempDirectory((dir) => {
    fs.writeFileSync(path.join(dir, "widget.lua"), "return true\n");
    assert.equal(
      calculateWidgetContentHash(dir),
      "sha512:6d81e5bb5e7fcbb9f8e5324116d0dc5cc42e6b4b68687b1d51070c99971e5c3390e5e4f1b432cb605472dd728e43e11dc330e73bbcbab4a73be77d5e89f1ac49"
    );
  });
});

test("hash is stable and covers file paths and bytes", () => {
  withTempDirectory((dir) => {
    fs.mkdirSync(path.join(dir, "nested"));
    fs.writeFileSync(path.join(dir, "widget.lua"), "return true\n");
    fs.writeFileSync(path.join(dir, "nested", "data.txt"), "value");

    const original = calculateWidgetContentHash(dir);
    assert.match(original, /^sha512:[0-9a-f]{128}$/);
    assert.equal(calculateWidgetContentHash(dir), original);

    fs.writeFileSync(path.join(dir, "nested", "data.txt"), "changed");
    assert.notEqual(calculateWidgetContentHash(dir), original);

    fs.writeFileSync(path.join(dir, "nested", "data.txt"), "value");
    fs.renameSync(
      path.join(dir, "nested", "data.txt"),
      path.join(dir, "nested", "renamed.txt")
    );
    assert.notEqual(calculateWidgetContentHash(dir), original);
  });
});

test("empty directories do not affect distributable content hash", () => {
  withTempDirectory((dir) => {
    fs.writeFileSync(path.join(dir, "widget.lua"), "return true\n");
    const original = calculateWidgetContentHash(dir);
    fs.mkdirSync(path.join(dir, "empty"));
    assert.equal(calculateWidgetContentHash(dir), original);
  });
});

test("symbolic links are rejected", { skip: process.platform === "win32" }, () => {
  withTempDirectory((dir) => {
    fs.writeFileSync(path.join(dir, "target.lua"), "return true\n");
    fs.symlinkSync("target.lua", path.join(dir, "link.lua"));
    assert.throws(
      () => calculateWidgetContentHash(dir),
      /Symbolic links are not supported/
    );
  });
});