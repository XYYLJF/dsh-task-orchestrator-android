/**
 * 阶段3 编排引擎（G4）—— FlowExecutor 单元测试
 * 覆盖：顺序执行、条件分支、循环、延时、重试、变量传递、日志、失败传播。
 * 目标：单测覆盖 ≥90%（验收④-3）。
 */

import { FlowExecutor, Flow, Step } from "./executor";
import type { AccessibilityEngine as Engine } from "../automation/engine";

/** 内存版引擎桩：记录调用、可注入失败 */
function makeEngine(): Engine & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async locate(req) {
      calls.push(`locate:${JSON.stringify(req)}`);
      return { found: false };
    },
    async gesture(req) {
      calls.push(`gesture:${req.type}`);
      return { success: true };
    },
    async input(req) {
      calls.push(`input:${req.text}`);
      return { success: true };
    },
    async readScreen() {
      calls.push("readScreen");
      return { text: "hello" };
    },
  };
}

function tap(id: string, x: number, y: number): Step {
  return { id, type: "tap", params: { x, y } };
}

describe("FlowExecutor", () => {
  test("顺序执行多步并记录日志", async () => {
    const engine = makeEngine();
    const flow: Flow = {
      id: "f1",
      name: "顺序",
      steps: [tap("s1", 10, 20), tap("s2", 30, 40)],
    };
    const result = await new FlowExecutor(engine).run(flow);
    expect(result.success).toBe(true);
    expect(engine.calls).toEqual(["gesture:tap", "gesture:tap"]);
    expect(result.logs.filter((l) => l.status === "success")).toHaveLength(2);
  });

  test("条件分支命中 when=true 执行对应分支", async () => {
    const engine = makeEngine();
    const flow: Flow = {
      id: "f2",
      name: "条件",
      steps: [
        {
          id: "cond",
          type: "condition",
          branches: [
            { when: "true", steps: [tap("b1", 1, 1)] },
            { when: "false", steps: [tap("b2", 2, 2)] },
          ],
        },
      ],
    };
    const result = await new FlowExecutor(engine).run(flow);
    expect(result.success).toBe(true);
    expect(engine.calls).toEqual(["gesture:tap"]);
  });

  test("循环执行指定次数", async () => {
    const engine = makeEngine();
    const flow: Flow = {
      id: "f3",
      name: "循环",
      steps: [
        { id: "loop", type: "loop", loopCount: 3, loopBody: [tap("t", 1, 1)] },
      ],
    };
    const result = await new FlowExecutor(engine).run(flow);
    expect(result.success).toBe(true);
    expect(engine.calls.filter((c) => c === "gesture:tap")).toHaveLength(3);
  });

  test("重试：首次失败后重试成功", async () => {
    const engine = makeEngine();
    let attempts = 0;
    engine.gesture = async () => {
      attempts++;
      if (attempts === 1) throw new Error("首次失败");
      return { success: true };
    };
    const flow: Flow = {
      id: "f4",
      name: "重试",
      steps: [
        {
          id: "retry",
          type: "retry",
          retryCount: 2,
          retryBody: [tap("t", 1, 1)],
        },
      ],
    };
    const result = await new FlowExecutor(engine).run(flow);
    expect(result.success).toBe(true);
    expect(attempts).toBe(2);
  });

  test("重试：超过次数后失败传播", async () => {
    const engine = makeEngine();
    engine.gesture = async () => {
      throw new Error("持续失败");
    };
    const flow: Flow = {
      id: "f5",
      name: "重试失败",
      steps: [
        { id: "retry", type: "retry", retryCount: 1, retryBody: [tap("t", 1, 1)] },
      ],
    };
    const result = await new FlowExecutor(engine).run(flow);
    expect(result.success).toBe(false);
    expect(result.error).toContain("持续失败");
  });

  test("readScreen 结果存入变量作用域", async () => {
    const engine = makeEngine();
    const flow: Flow = {
      id: "f6",
      name: "读屏变量",
      steps: [
        { id: "read", type: "readScreen" },
        {
          id: "cond",
          type: "condition",
          branches: [{ when: "${read}", steps: [tap("ok", 1, 1)] }],
        },
      ],
    };
    const result = await new FlowExecutor(engine).run(flow);
    expect(result.success).toBe(true);
    // read 存入变量后条件分支命中
    expect(engine.calls).toContain("readScreen");
    expect(engine.calls).toContain("gesture:tap");
  });

  test("未知步骤类型抛出错误", async () => {
    const engine = makeEngine();
    const flow: Flow = {
      id: "f7",
      name: "未知",
      steps: [{ id: "x", type: "unknown" as Step["type"] }],
    };
    const result = await new FlowExecutor(engine).run(flow);
    expect(result.success).toBe(false);
    expect(result.error).toContain("未知步骤类型");
  });

  test("延时步骤（缩短等待以利测试）", async () => {
    const engine = makeEngine();
    const flow: Flow = {
      id: "f8",
      name: "延时",
      steps: [{ id: "delay", type: "delay", delayMs: 1 }],
    };
    const result = await new FlowExecutor(engine).run(flow);
    expect(result.success).toBe(true);
  });
});
