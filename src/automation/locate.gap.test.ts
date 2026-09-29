/**
 * 阶段2 G3 无障碍引擎 —— 兵部补缺口测试（边界/攻防/降级）
 *
 * 与工部已有 locate.test.ts（16 条）对照去重后，补充缺口用例，
 * 覆盖五类定位边界、手势边界、输入降级（editable）、读屏无副作用。
 *
 * 执行方式（本机可跑，无需 Robolectric）：
 *   cd app && npm test
 * 依赖：jest + jest-expo（package.json 已配置 preset）。
 * 说明：TS 侧 locate.ts 已与 Android API 解耦为纯函数，故用 jest 即可，
 *       无需 Robolectric（Robolectric 仅用于原生 Kotlin Service 层的
 *       dispatchGesture 真机行为，属阶段2 工部原生实现时再引入）。
 */

import {
  TreeNode,
  locate,
  buildGesture,
  decideInputMode,
  captureTree,
  GestureSpec,
} from "./locate";

function makeTree(): TreeNode {
  return {
    viewId: "root",
    children: [
      {
        text: "登录",
        viewId: "btn_login",
        contentDescription: "登录按钮",
        bounds: { left: 0, top: 0, right: 100, bottom: 50 },
        children: [],
      },
      {
        text: "确认",
        viewId: "btn_confirm",
        bounds: { left: 0, top: 60, right: 100, bottom: 110 },
        children: [],
      },
      {
        text: "确认按钮",
        viewId: "btn_confirm_full",
        bounds: { left: 0, top: 120, right: 200, bottom: 170 },
        children: [],
      },
    ],
  };
}

describe("定位策略补缺口（边界/攻防）", () => {
  const tree = makeTree();

  test("byRegex 合法正则零匹配返回未命中", () => {
    const r = locate(tree, "byRegex", "^不存在的文本$");
    expect(r.found).toBe(false);
    expect(r.confidence).toBe(0);
  });

  test("byRegex 多候选时取最高置信度", () => {
    // "确认" 精确匹配 confidence=1，优于 "确认按钮" 的 2/4=0.5
    const r = locate(tree, "byRegex", "确认");
    expect(r.found).toBe(true);
    expect(r.node?.viewId).toBe("btn_confirm");
    expect(r.confidence).toBe(1);
  });

  test("byRegex 部分匹配置信度降低（<1）", () => {
    // "按钮$" 仅命中 btn_confirm_full（text="确认按钮"），match="按钮" 长度 2 < text 长度 4
    const r = locate(tree, "byRegex", "按钮$");
    expect(r.found).toBe(true);
    expect(r.node?.viewId).toBe("btn_confirm_full");
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThan(1);
  });

  test("byId 未命中返回未命中", () => {
    const r = locate(tree, "byId", "nonexistent_id");
    expect(r.found).toBe(false);
  });

  test("byDesc 未命中返回未命中", () => {
    const r = locate(tree, "byDesc", "不存在的描述");
    expect(r.found).toBe(false);
  });

  test("byCoord 坐标恰好落在边界值上（含边界）", () => {
    // btn_login bounds = (0,0)-(100,50)，(0,0) 恰在左上角边界
    const r = locate(tree, "byCoord", undefined, { x: 0, y: 0 });
    expect(r.found).toBe(true);
    expect(r.node?.viewId).toBe("btn_login");
  });

  test("byCoord 未提供坐标返回未命中", () => {
    const r = locate(tree, "byCoord");
    expect(r.found).toBe(false);
  });

  test("byText 空值不误命中（不崩溃）", () => {
    const r = locate(tree, "byText", "");
    expect(r.found).toBe(false);
  });

  test("byText 精确匹配带特殊正则字符的文本（不当作正则）", () => {
    const specialTree: TreeNode = {
      text: "",
      children: [{ text: "a.b", viewId: "v", children: [] }],
    };
    const r = locate(specialTree, "byText", "a.b");
    expect(r.found).toBe(true);
    expect(r.node?.viewId).toBe("v");
  });
});

describe("手势构建补缺口（边界）", () => {
  test("longPress 单点且时长生效", () => {
    const s = buildGesture({ type: "longPress", x: 5, y: 6, durationMs: 500 });
    expect(s).toHaveLength(1);
    expect(s[0].points).toEqual([{ x: 5, y: 6 }]);
    expect(s[0].durationMs).toBe(500);
  });

  test("未知手势类型返回空数组（不崩溃）", () => {
    const s = buildGesture({ type: "unknown" } as unknown as GestureSpec);
    expect(s).toEqual([]);
  });

  test("multiSegment 空段列表返回空数组", () => {
    const s = buildGesture({ type: "multiSegment", segments: [] });
    expect(s).toEqual([]);
  });

  test("未指定时长使用默认 100ms", () => {
    const s = buildGesture({ type: "tap", x: 1, y: 1 });
    expect(s[0].durationMs).toBe(100);
  });

  test("swipe 未指定起止点使用原点（不崩溃）", () => {
    const s = buildGesture({ type: "swipe" });
    expect(s[0].points).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]);
  });
});

describe("文本输入决策补缺口", () => {
  test("空对象节点默认走 setText", () => {
    expect(decideInputMode({}).mode).toBe("setText");
  });

  test("无节点降级剪贴板并带原因", () => {
    const r = decideInputMode(undefined);
    expect(r.mode).toBe("clipboard");
    expect(r.reason).toBeTruthy();
  });

  test("editable=false 节点降级剪贴板（TXT-02 不可编辑/只读）", () => {
    const r = decideInputMode({ text: "只读标签", editable: false });
    expect(r.mode).toBe("clipboard");
    expect(r.reason).toBe("节点不可编辑");
  });

  test("editable=true 节点走 setText", () => {
    expect(decideInputMode({ text: "输入框", editable: true }).mode).toBe("setText");
  });

  test("editable 未标注（undefined）默认走 setText（乐观，真机可编辑性由原生层判）", () => {
    expect(decideInputMode({ text: "x" }).mode).toBe("setText");
  });
});

describe("读屏捕获补缺口（无副作用/合规）", () => {
  test("空节点树返回空字符串", () => {
    expect(captureTree(undefined)).toBe("");
  });

  test("仅含 contentDescription 无 text 的节点也能捕获", () => {
    const tree: TreeNode = {
      text: "",
      children: [{ contentDescription: "图标", children: [] }],
    };
    expect(captureTree(tree)).toBe("图标");
  });

  test("捕获不修改输入树（无副作用，配合④-7 用完即弃）", () => {
    const tree = makeTree();
    const snapshot = JSON.stringify(tree);
    captureTree(tree);
    expect(JSON.stringify(tree)).toBe(snapshot);
  });

  test("捕获返回值为新字符串（非节点引用，即时丢弃语义）", () => {
    const tree = makeTree();
    const text = captureTree(tree);
    expect(typeof text).toBe("string");
    expect(text).toContain("登录");
  });
});

// ---------------------------------------------------------------------------
// 边界缺口（已由工部确认归属原生层，本层不测；保留说明性注释）。
// 坐标越界裁剪、时长 ≥1ms 归一化：归属原生层（Kotlin 构造 GestureDescription
// 时由系统 coerce），工部在 AutomationAccessibilityService.kt 手势构造层落实。
// 兵部无需在 TS 纯函数层断言，已移除 skip 用例避免误导 lead 代跑。
// ---------------------------------------------------------------------------
