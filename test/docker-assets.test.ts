import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("docker deployment assets exist", () => {
  for (const relativePath of [
    "Dockerfile",
    ".dockerignore",
    "compose.yml",
    "compose.openclaw-overlay.yml",
  ]) {
    assert.equal(existsSync(path.join(ROOT, relativePath)), true, `${relativePath} should exist.`);
  }
});

test("Dockerfile uses the official OpenClaw runtime and health endpoint", () => {
  const dockerfile = read("Dockerfile");
  assert.match(dockerfile, /ARG OPENCLAW_RUNTIME_IMAGE=ghcr\.io\/openclaw\/openclaw:latest/);
  assert.match(dockerfile, /FROM node:24-bookworm-slim AS builder/);
  assert.match(dockerfile, /FROM \$\{OPENCLAW_RUNTIME_IMAGE\} AS runtime/);
  assert.match(dockerfile, /HEALTHCHECK[\s\S]*\/healthz/);
  assert.match(dockerfile, /CMD \["node", "dist\/index\.js"\]/);
  assert.match(dockerfile, /OPENCLAW_WORKSPACE_ROOT=\/home\/node\/\.openclaw\/workspace/);
});

test(".dockerignore keeps local runtime artifacts out of the image context", () => {
  const dockerignore = read(".dockerignore");
  assert.match(dockerignore, /(^|\n)node_modules(\n|$)/);
  assert.match(dockerignore, /(^|\n)dist(\n|$)/);
  assert.match(dockerignore, /(^|\n)runtime(\n|$)/);
  assert.match(dockerignore, /(^|\n)\.env(\n|$)/);
});

test("standalone compose expects host gateway wiring and OpenClaw bind mounts", () => {
  const compose = read("compose.yml");
  assert.match(compose, /host\.docker\.internal:host-gateway/);
  assert.match(compose, /DOCKER_GATEWAY_URL:-ws:\/\/host\.docker\.internal:18789/);
  assert.match(compose, /OPENCLAW_CONFIG_DIR/);
  assert.match(compose, /OPENCLAW_WORKSPACE_DIR/);
  assert.match(compose, /restart: unless-stopped/);
});

test("overlay compose targets the official openclaw-gateway service", () => {
  const overlay = read("compose.openclaw-overlay.yml");
  assert.match(overlay, /build\.context: \.|context: \./);
  assert.match(overlay, /openclaw-gateway/);
  assert.match(overlay, /ws:\/\/openclaw-gateway:18789/);
  assert.match(overlay, /depends_on:[\s\S]*openclaw-gateway/);
});
