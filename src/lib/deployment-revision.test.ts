import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { readDeploymentRevision } from "@/lib/deployment-revision";

describe("deployment revision", () => {
  it("ignores a revision that is not a git SHA", () => {
    assert.equal(readDeploymentRevision(""), null);
    assert.equal(readDeploymentRevision("latest"), null);
    assert.equal(readDeploymentRevision("455865506fd0b2dd312ab8092ec22fd8bf84884c"), "455865506fd0b2dd312ab8092ec22fd8bf84884c");
  });

  it("publishes revision from the image env and the deploy script", () => {
    const health = readFileSync("src/app/api/health/route.ts", "utf8");
    assert.match(health, /readDeploymentRevision/);
    assert.match(health, /INFLURIOS_REVISION/);
    const deploy = readFileSync("deploy/scripts/deploy.sh", "utf8");
    assert.match(deploy, /export INFLURIOS_REVISION="\$\(git rev-parse HEAD\)"/);
    const image = readFileSync("Dockerfile", "utf8");
    assert.match(image, /ENV INFLURIOS_REVISION=/);
  });
});
