import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  explainCollaborationMatch,
  extractProfileDraft,
  matchCreatorsForBrief,
  setAiFailureRecorderForTests,
} from "./ai-runtime";

const route = {
  endpoint: "https://api.openai.com/v1/chat/completions",
  secret: "sk-test",
  model: "gpt-4o-mini",
};

function completion(content: string) {
  return async () =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
}

describe("AI provider functions", () => {
  it("parses a fixture completion for the three assigned functions", async () => {
    const explanation = await explainCollaborationMatch([{ label: "Niche", value: 80 }], {
      route,
      fetchImpl: completion('{"explanation":"Shared niche overlap."}'),
    });
    assert.equal(explanation.source, "provider");
    assert.equal(explanation.explanation, "Shared niche overlap.");

    const match = await matchCreatorsForBrief(
      {
        brief: "beauty launch",
        creators: [
          { slug: "ada", specialties: ["beauty"] },
          { slug: "ben", specialties: ["finance"] },
        ],
      },
      { route, fetchImpl: completion('{"slugs":["ada","unknown"]}') },
    );
    assert.equal(match.source, "provider");
    assert.deepEqual(match.slugs, ["ada"]);

    const draft = await extractProfileDraft("public bio", {
      route,
      fetchImpl: completion('{"title":"Host","bio":"Short form","specialties":["beauty"]}'),
    });
    assert.equal(draft.source, "provider");
    assert.equal(draft.title, "Host");
    assert.deepEqual(draft.specialties, ["beauty"]);
  });

  it("returns the rules result and records a failed provider job when the call fails", async () => {
    const failures: string[] = [];
    setAiFailureRecorderForTests(async (functionKey, message) => {
      failures.push(`${functionKey}:${message}`);
    });
    try {
      const explanation = await explainCollaborationMatch([{ label: "Niche", value: 80 }], {
        route,
        fetchImpl: async () => {
          throw new Error("provider down");
        },
      });
      assert.equal(explanation.source, "rules");
      assert.match(explanation.explanation, /Strongest signal: Niche/);

      const match = await matchCreatorsForBrief(
        { brief: "beauty launch", creators: [{ slug: "ada", specialties: ["beauty"] }] },
        { route: null },
      );
      assert.equal(match.source, "rules");
      assert.deepEqual(match.slugs, ["ada"]);

      const draft = await extractProfileDraft("anything", {
        route,
        fetchImpl: completion("not json"),
      });
      assert.equal(draft.source, "rules");
      assert.equal(draft.title, "");
      assert.equal(draft.bio, "");
    } finally {
      setAiFailureRecorderForTests(null);
    }
    assert.ok(failures.some((row) => row.startsWith("collaboration_match_explanation:")));
    assert.ok(failures.some((row) => row.startsWith("profile_draft_extraction:")));
    assert.equal(failures.some((row) => row.startsWith("business_creator_match:")), false);
  });
});
