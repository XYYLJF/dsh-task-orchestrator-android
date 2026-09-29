/**
 * 阶段2 TurboModule 桥接 —— JS 侧 NativeModule 声明与调用封装
 *
 * 职责：将编排引擎（G4）的 G3 原语调用桥接到原生 AutomationAccessibilityService。
 * 通过 TurboModule（newArchEnabled=false 时为 NativeModules）调用原生方法。
 * 对应刑部 P5（engine.ts 占位实现 → 真实桥接）。
 */

import { NativeModules } from "react-native";
import type { AccessibilityEngine } from "./engine";
import type {
  LocateRequest,
  LocateResult,
  GestureRequest,
  InputRequest,
} from "./engine";

/** 原生模块名（Kotlin 侧 AutomationAccessibilityModule 注册名） */
const MODULE_NAME = "AutomationAccessibility";

interface NativeAutomationModule {
  locate(req: LocateRequest): Promise<LocateResult>;
  gesture(req: GestureRequest): Promise<{ success: boolean }>;
  input(req: InputRequest): Promise<{ success: boolean; fallbackUsed?: boolean }>;
  readScreen(): Promise<{ text: string }>;
}

const native = NativeModules[MODULE_NAME] as NativeAutomationModule | undefined;

/**
 * 真实桥接引擎：转发到原生 AutomationAccessibilityModule。
 * 若原生模块未就绪（如开发环境/未 prebuild），降级到占位实现。
 */
const bridgedEngine: AccessibilityEngine = {
  async locate(req) {
    if (native?.locate) return native.locate(req);
    return { found: false };
  },
  async gesture(req) {
    if (native?.gesture) return native.gesture(req);
    return { success: false };
  },
  async input(req) {
    if (native?.input) return native.input(req);
    return { success: false };
  },
  async readScreen() {
    if (native?.readScreen) return native.readScreen();
    return { text: "" };
  },
};

export function getBridgedEngine(): AccessibilityEngine {
  return bridgedEngine;
}
