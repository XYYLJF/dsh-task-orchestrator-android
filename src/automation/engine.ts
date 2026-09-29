/**
 * 阶段2 无障碍自动化引擎（G3）—— TS 侧桥接层
 *
 * 职责：将 JS 侧（编排引擎动作）桥接到原生 AccessibilityService。
 * 原生侧实现见 android-note/AutomationAccessibilityService.kt（prebuild 时由
 * config plugin 注入），本层通过 NativeModule/TurboModule 调用其四类原语：
 * 1. 定位控件（节点树读屏，by text/id/desc/坐标/正则）
 * 2. 手势（dispatchGesture：点击/滑动/长按/多段）
 * 3. 文本输入（ACTION_SET_TEXT + 剪贴板兜底）
 * 4. 读屏（抓取窗口节点文本，仅本地、不落盘、不外发、即时丢弃）
 *
 * 注意：本文件为 TS 侧接口与调度骨架，原生 Service 的桥接通过自定义
 * TurboModule 实现（阶段2 正式落地），此处先定义类型与调用契约。
 */

/** 控件定位策略 */
export type LocatorStrategy = "text" | "id" | "desc" | "coordinate" | "regex";

/** 定位请求 */
export interface LocateRequest {
  strategy: LocatorStrategy;
  /** text/id/desc/regex 的匹配值 */
  value?: string;
  /** coordinate 策略的坐标 */
  x?: number;
  y?: number;
}

/** 定位结果 */
export interface LocateResult {
  found: boolean;
  nodeId?: string;
  bounds?: { left: number; top: number; right: number; bottom: number };
  text?: string;
  /** 降级提示：目标 App 不可读（Flutter/自绘/WebView）时给出 */
  degraded?: boolean;
}

/** 手势类型 */
export type GestureType = "tap" | "swipe" | "longPress" | "multiStroke";

/** 手势请求 */
export interface GestureRequest {
  type: GestureType;
  /** 点击/长按中心点 */
  x?: number;
  y?: number;
  /** 滑动起止点 */
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  durationMs?: number;
}

/** 输入请求 */
export interface InputRequest {
  text: string;
  /** 优先 ACTION_SET_TEXT，失败时剪贴板粘贴兜底 */
  fallbackToClipboard?: boolean;
}

/** 无障碍引擎统一接口（原生 Service 桥接实现） */
export interface AccessibilityEngine {
  /** 定位控件 */
  locate(req: LocateRequest): Promise<LocateResult>;
  /** 执行手势 */
  gesture(req: GestureRequest): Promise<{ success: boolean }>;
  /** 文本输入 */
  input(req: InputRequest): Promise<{ success: boolean; fallbackUsed?: boolean }>;
  /** 读屏：抓取当前窗口节点文本（仅本地、即时丢弃） */
  readScreen(): Promise<{ text: string }>;
}

/**
 * 引擎单例获取（阶段2 正式落地时返回 TurboModule 桥接实例；
 * 当前返回占位实现，供编排引擎阶段3 联调接口契约）。
 */
export function getAccessibilityEngine(): AccessibilityEngine {
  // TODO(阶段2): 返回 NativeModules.AutomationAccessibility 桥接实例
  return placeholderEngine;
}

/** 占位实现（供阶段3 编排引擎联调，阶段2 替换为真实桥接） */
const placeholderEngine: AccessibilityEngine = {
  async locate(_req) {
    return { found: false };
  },
  async gesture(_req) {
    return { success: false };
  },
  async input(_req) {
    return { success: false };
  },
  async readScreen() {
    return { text: "" };
  },
};
