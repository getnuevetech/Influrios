import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inboxSourcesFromRecords, inboxTaskKey, projectInboxTasks, taskStateAfterNoticeRead, tasksForTab } from "./action-inbox";

const review = {
  workspaceId: "ws-1",
  recordId: "mile-1",
  version: "1",
  action: "review_delivery" as const,
  title: "Campaign",
  counterparty: "Influencer",
  dueLabel: "Due tomorrow",
  href: "/collaboration/work/deal-1?version=1",
  mine: true,
};

describe("action inbox", () => {
  it("keeps one task per record version and action, and a replay updates that task", () => {
    const first = projectInboxTasks([review]);
    const replay = projectInboxTasks([review, { ...review, dueLabel: "Due today" }]);
    assert.equal(first.length, 1);
    assert.equal(replay.length, 1);
    assert.equal(replay[0]?.key, inboxTaskKey(review));
    assert.equal(replay[0]?.dueLabel, "Due today");
    assert.equal(replay[0]?.cta, "Review delivery");
  });

  it("leaves the task open when a notification is read", () => {
    const [task] = projectInboxTasks([review]);
    assert.equal(task?.state, "Open");
    assert.equal(taskStateAfterNoticeRead(task!.state), "Open");
  });

  it("supersedes the older delivery review and withholds the other party's action", () => {
    const tasks = projectInboxTasks([
      review,
      { ...review, version: "2", href: "/collaboration/work/deal-1?version=2" },
      {
        ...review,
        recordId: "fund-1",
        version: "current",
        action: "review_funding",
        mine: false,
        href: "/payments",
      },
    ]);
    const old = tasks.find((task) => task.version === "1");
    const current = tasks.find((task) => task.version === "2");
    const waiting = tasks.find((task) => task.action === "review_funding");
    assert.equal(old?.state, "Superseded");
    assert.equal(old?.cta, null);
    assert.equal(current?.state, "Open");
    assert.equal(current?.cta, "Review delivery");
    assert.equal(waiting?.cta, null);
    assert.equal(tasksForTab(tasks, "assigned").some((task) => task.version === "1"), false);
    assert.equal(tasksForTab(tasks, "waiting").length, 1);
    assert.equal(tasksForTab(tasks, "resolved").some((task) => task.state === "Superseded"), true);
    assert.equal(tasks.some((task) => task.cta === "Complete" as never), false);
  });

  it("keeps signature, funding, and payout tasks separate from a read notification", () => {
    const tasks = projectInboxTasks(
      inboxSourcesFromRecords({
        workspaceId: "ws",
        audience: "business",
        contracts: [{ id: "c1", title: "Agreement", href: "/collaboration/contracts/c1" }],
        invitations: [],
        funding: [
          {
            id: "f-open",
            title: "Open collaboration",
            counterparty: "Influencer",
            href: "/payments?deal=f-open",
            needsFunding: false,
            blocked: true,
          },
        ],
        submissions: [
          {
            fundingId: "f1",
            milestoneId: "m1",
            version: 1,
            status: "approved",
            title: "Delivery",
            counterparty: "Influencer",
          },
        ],
        payouts: [{ id: "f1", title: "Delivery", counterparty: "Influencer", bankReturned: true }],
        creatorDeliverables: [],
      }),
    );
    const signature = tasks.find((task) => task.action === "review_contract");
    const funding = tasks.find((task) => task.action === "review_funding");
    const payout = tasks.find((task) => task.action === "update_payout");
    assert.equal(signature?.state, "Open");
    assert.equal(taskStateAfterNoticeRead(signature!.state), "Open");
    assert.equal(funding?.state, "Blocked");
    assert.equal(funding?.cta, null);
    assert.equal(payout?.mine, false);
    assert.equal(payout?.cta, null);
    assert.equal(tasksForTab(tasks, "waiting").some((task) => task.action === "update_payout"), true);
    assert.equal(tasks.find((task) => task.version === "1")?.state, "Resolved");
  });
});
