/**
 * 阶段2 无障碍引擎（G3）—— 定位层纯函数实现
 *
 * 与 Android API 解耦：输入为「节点树」抽象（可注入 mock），输出 LocateResult。
 * 本机可测（兵部测试桩接口已双签：locate(rootNode, strategy)→LocateResult）。
 *
 * 五类定位策略：byText / byId / byDesc / byCoord / byRegex。
 * 读屏数据承诺：内存态、不落盘、不外传、用完即弃（配合刑部④-7）。
 */

/** 抽象节点树节点（与 AccessibilityNodeInfo 解耦，可注入 mock） */
export interface TreeNode {
  text?: string;
  viewId?: string;
  contentDescription?: string;
  /** 是否可编辑（用于输入降级判断：不可编辑则走剪贴板） */
  editable?: boolean;
  bounds?: { left: number; top: number; right: number; bottom: number };
  children?: TreeNode[];
}

export type LocatorStrategy =
  | "byText"
  | "byId"
  | "byDesc"
  | "byCoord"
  | "byRegex";

export interface LocateResult {
  found: boolean;
  /** 命中节点引用（内存态） */
  node?: TreeNode;
  bounds?: { left: number; top: number; right: number; bottom: number };
  /** 命中置信度 0~1（文本/描述精确匹配=1，坐标命中=1，正则匹配按长度比） */
  confidence: number;
  /** 降级提示：节点不可读（Flutter/自绘/WebView） */
  degraded?: boolean;
}

/** 广度优先遍历节点树 */
function* traverse(root: TreeNode | undefined): Generator<TreeNode> {
  if (!root) return;
  const queue: TreeNode[] = [root];
  while (queue.length) {
    const node = queue.shift()!;
    yield node;
    if (node.children) queue.push(...node.children);
  }
}

/**
 * 定位控件（纯函数）：按策略在节点树中查找，返回命中结果。
 * 不落盘、不持有全局状态、用完即弃。
 */
export function locate(
  rootNode: TreeNode | undefined,
  strategy: LocatorStrategy,
  value?: string,
  coord?: { x: number; y: number },
): LocateResult {
  if (!rootNode) {
    return { found: false, confidence: 0 };
  }

  switch (strategy) {
    case "byText": {
      for (const node of traverse(rootNode)) {
        if (node.text && node.text === value) {
          return { found: true, node, bounds: node.bounds, confidence: 1 };
        }
      }
      // 部分匹配兜底（含子串），置信度降低
      for (const node of traverse(rootNode)) {
        if (node.text && value && node.text.includes(value)) {
          const confidence = value.length / node.text.length;
          return { found: true, node, bounds: node.bounds, confidence };
        }
      }
      return { found: false, confidence: 0 };
    }

    case "byId": {
      for (const node of traverse(rootNode)) {
        if (node.viewId && node.viewId === value) {
          return { found: true, node, bounds: node.bounds, confidence: 1 };
        }
      }
      return { found: false, confidence: 0 };
    }

    case "byDesc": {
      for (const node of traverse(rootNode)) {
        if (node.contentDescription && node.contentDescription === value) {
          return { found: true, node, bounds: node.bounds, confidence: 1 };
        }
      }
      return { found: false, confidence: 0 };
    }

    case "byCoord": {
      if (!coord) return { found: false, confidence: 0 };
      for (const node of traverse(rootNode)) {
        const b = node.bounds;
        if (
          b &&
          coord.x >= b.left &&
          coord.x <= b.right &&
          coord.y >= b.top &&
          coord.y <= b.bottom
        ) {
          return { found: true, node, bounds: b, confidence: 1 };
        }
      }
      return { found: false, confidence: 0 };
    }

    case "byRegex": {
      if (!value) return { found: false, confidence: 0 };
      let regex: RegExp;
      try {
        regex = new RegExp(value);
      } catch {
        return { found: false, confidence: 0 };
      }
      let best: LocateResult = { found: false, confidence: 0 };
      for (const node of traverse(rootNode)) {
        if (node.text && regex.test(node.text)) {
          const m = node.text.match(regex);
          const confidence = m && m[0] ? m[0].length / node.text.length : 0.5;
          if (confidence > best.confidence) {
            best = { found: true, node, bounds: node.bounds, confidence };
          }
        }
      }
      return best;
    }

    default:
      return { found: false, confidence: 0 };
  }
}

/** 手势规格 */
export interface GestureSpec {
  type: "tap" | "swipe" | "longPress" | "multiSegment";
  x?: number;
  y?: number;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  durationMs?: number;
  segments?: { x: number; y: number }[];
}

/**
 * 构建手势描述（纯函数）：将手势规格转为可派发的手势段列表。
 * 与 Android GestureDescription 解耦，返回抽象手势段供 Robolectric 断言。
 */
export interface GestureStroke {
  points: { x: number; y: number }[];
  durationMs: number;
}

export function buildGesture(spec: GestureSpec): GestureStroke[] {
  const duration = spec.durationMs ?? 100;
  switch (spec.type) {
    case "tap":
      return [
        { points: [{ x: spec.x ?? 0, y: spec.y ?? 0 }], durationMs: duration },
      ];
    case "longPress":
      return [
        { points: [{ x: spec.x ?? 0, y: spec.y ?? 0 }], durationMs: duration },
      ];
    case "swipe":
      return [
        {
          points: [
            { x: spec.fromX ?? 0, y: spec.fromY ?? 0 },
            { x: spec.toX ?? 0, y: spec.toY ?? 0 },
          ],
          durationMs: duration,
        },
      ];
    case "multiSegment":
      return (spec.segments ?? []).map((p) => ({
        points: [p],
        durationMs: duration,
      }));
    default:
      return [];
  }
}

/**
 * 文本输入（纯函数决策）：返回输入方式决策（优先 ACTION_SET_TEXT，
 * 不可编辑节点则降级剪贴板）。实际 ACTION_SET_TEXT 由原生层执行。
 * editable 字段由节点树提供（对应兵部测试契约 TXT-02/03）。
 */
export function decideInputMode(node: TreeNode | undefined): {
  mode: "setText" | "clipboard";
  reason?: string;
} {
  if (!node) return { mode: "clipboard", reason: "节点不存在" };
  if (node.editable === false) {
    return { mode: "clipboard", reason: "节点不可编辑" };
  }
  return { mode: "setText" };
}

/**
 * 读屏捕获（纯函数）：将节点树展平为文本（内存态，返回后由调用方丢弃，
 * 不落盘、不外发）。
 */
export function captureTree(root: TreeNode | undefined): string {
  const parts: string[] = [];
  for (const node of traverse(root)) {
    if (node.text) parts.push(node.text);
    if (node.contentDescription) parts.push(node.contentDescription);
  }
  return parts.join("\n");
}
