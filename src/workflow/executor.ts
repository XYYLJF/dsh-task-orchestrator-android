/**
 * 阶段3 编排引擎（G4）—— 编排模型与执行器
 *
 * 职责：定义步骤编排模型（顺序/条件/循环/延时/重试/变量/日志），
 * 动作类型映射到 G3 无障碍原语（点击/滑动/输入/读屏/条件/延时/循环/重试）。
 * 对齐 dsh-workflow 语义，纯本地可执行，单测覆盖 ≥90%。
 */

import type { AccessibilityEngine } from "../automation/engine";

/** 步骤类型 */
export type StepType =
  | "tap"
  | "swipe"
  | "input"
  | "readScreen"
  | "condition"
  | "delay"
  | "loop"
  | "retry";

/** 单个编排步骤 */
export interface Step {
  id: string;
  type: StepType;
  /** 动作参数（按类型） */
  params?: Record<string, unknown>;
  /** 条件分支（condition 类型） */
  branches?: { when: string; steps: Step[] }[];
  /** 循环体（loop 类型） */
  loopBody?: Step[];
  loopCount?: number;
  /** 重试次数（retry 类型） */
  retryCount?: number;
  retryBody?: Step[];
  /** 延时毫秒（delay 类型） */
  delayMs?: number;
}

/** 编排流程 */
export interface Flow {
  id: string;
  name: string;
  steps: Step[];
  /** 变量作用域 */
  variables?: Record<string, unknown>;
}

/** 执行日志条目 */
export interface LogEntry {
  stepId: string;
  status: "started" | "success" | "failed" | "skipped";
  message?: string;
  timestamp: number;
}

/** 执行结果 */
export interface FlowResult {
  success: boolean;
  logs: LogEntry[];
  error?: string;
}

/**
 * 编排执行器：按步骤顺序执行，支持条件/循环/延时/重试/变量/日志。
 * 动作类型经 getAccessibilityEngine 映射到 G3 原语。
 */
export class FlowExecutor {
  constructor(
    private engine: AccessibilityEngine,
    private now: () => number = Date.now,
  ) {}

  async run(flow: Flow): Promise<FlowResult> {
    const logs: LogEntry[] = [];
    const vars: Record<string, unknown> = { ...(flow.variables ?? {}) };
    const log = (stepId: string, status: LogEntry["status"], message?: string) =>
      logs.push({ stepId, status, message, timestamp: this.now() });

    try {
      await this.runSteps(flow.steps, vars, log);
      return { success: true, logs };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, logs, error: msg };
    }
  }

  private async runSteps(
    steps: Step[],
    vars: Record<string, unknown>,
    log: (id: string, s: LogEntry["status"], m?: string) => void,
  ): Promise<void> {
    for (const step of steps) {
      log(step.id, "started");
      try {
        await this.runStep(step, vars, log);
        log(step.id, "success");
      } catch (err) {
        log(step.id, "failed", err instanceof Error ? err.message : String(err));
        throw err;
      }
    }
  }

  private async runStep(
    step: Step,
    vars: Record<string, unknown>,
    log: (id: string, s: LogEntry["status"], m?: string) => void,
  ): Promise<void> {
    switch (step.type) {
      case "delay": {
        await new Promise((r) => setTimeout(r, step.delayMs ?? 0));
        return;
      }
      case "tap": {
        const { x, y } = step.params ?? {};
        await this.engine.gesture({
          type: "tap",
          x: Number(x),
          y: Number(y),
        });
        return;
      }
      case "swipe": {
        const { fromX, fromY, toX, toY } = step.params ?? {};
        await this.engine.gesture({
          type: "swipe",
          fromX: Number(fromX),
          fromY: Number(fromY),
          toX: Number(toX),
          toY: Number(toY),
        });
        return;
      }
      case "input": {
        await this.engine.input({ text: String(step.params?.text ?? "") });
        return;
      }
      case "readScreen": {
        const { text } = await this.engine.readScreen();
        vars[step.id] = text;
        return;
      }
      case "condition": {
        for (const branch of step.branches ?? []) {
          if (this.evalWhen(branch.when, vars)) {
            await this.runSteps(branch.steps, vars, log);
            return;
          }
        }
        return;
      }
      case "loop": {
        const count = step.loopCount ?? 0;
        for (let i = 0; i < count; i++) {
          await this.runSteps(step.loopBody ?? [], vars, log);
        }
        return;
      }
      case "retry": {
        const max = step.retryCount ?? 1;
        let lastErr: unknown;
        for (let i = 0; i <= max; i++) {
          try {
            await this.runSteps(step.retryBody ?? [], vars, log);
            return;
          } catch (err) {
            lastErr = err;
            if (i === max) throw err;
          }
        }
        throw lastErr;
      }
      default:
        throw new Error(`未知步骤类型: ${(step as Step).type}`);
    }
  }

  /**
   * 条件求值：支持简单表达式，如 "vars.step1.includes('x')" 或布尔值。
   * 此处实现极简求值（变量引用 + 真值判断），阶段3 正式版可扩展为安全 DSL。
   */
  private evalWhen(when: string, vars: Record<string, unknown>): boolean {
    const trimmed = when.trim();
    if (!trimmed) return true;
    // 支持 ${var} 引用
    const ref = trimmed.match(/^\$\{(\w+)\}$/);
    if (ref) {
      return Boolean(vars[ref[1]]);
    }
    // 兜底：直接布尔解析
    return trimmed === "true" || Boolean(vars[trimmed]);
  }
}
