/**
 * 阶段2 定位层纯函数单测（locate / buildGesture / decideInputMode / captureTree）
 * 覆盖五类定位策略 + 手势 + 输入决策 + 读屏（本机可测，兵部测试桩接口已双签）。
 */

import {
  TreeNode,
  locate,
  buildGesture,
  decideInputMode,
  captureTree,
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
        text: "用户名",
        viewId: "input_user",
        bounds: { left: 0, top: 60, right: 200, bottom: 100 },
        children: [],
      },
      {
        text: "欢迎使用本应用",
        viewId: "label_welcome",
        bounds: { left: 0, top: 120, right: 300, bottom: 160 },
        children: [],
      },
    ],
  };
}

describe("locate 定位策略", () => {
  const tree = makeTree();

  test("byText 精确匹配", () => {
    const r = locate(tree, "byText", "登录");
    expect(r.found).toBe(true);
    expect(r.node?.viewId).toBe("btn_login");
    expect(r.confidence).toBe(1);
  });

  test("byText 子串匹配置信度降低", () => {
    const r = locate(tree, "byText", "欢迎");
    expect(r.found).toBe(true);
    expect(r.confidence).toBeLessThan(1);
    expect(r.confidence).toBeGreaterThan(0);
  });

  test("byText 未命中", () => {
    const r = locate(tree, "byText", "不存在");
    expect(r.found).toBe(false);
  });

  test("byId 精确匹配", () => {
    const r = locate(tree, "byId", "input_user");
    expect(r.found).toBe(true);
    expect(r.node?.text).toBe("用户名");
  });

  test("byDesc 匹配", () => {
    const r = locate(tree, "byDesc", "登录按钮");
    expect(r.found).toBe(true);
    expect(r.node?.viewId).toBe("btn_login");
  });

  test("byCoord 命中边界内节点", () => {
    const r = locate(tree, "byCoord", undefined, { x: 50, y: 25 });
    expect(r.found).toBe(true);
    expect(r.node?.viewId).toBe("btn_login");
  });

  test("byCoord 边界外未命中", () => {
    const r = locate(tree, "byCoord", undefined, { x: 999, y: 999 });
    expect(r.found).toBe(false);
  });

  test("byRegex 匹配", () => {
    const r = locate(tree, "byRegex", "^登录");
    expect(r.found).toBe(true);
    expect(r.node?.viewId).toBe("btn_login");
  });

  test("byRegex 非法正则返回未命中", () => {
    const r = locate(tree, "byRegex", "[");
    expect(r.found).toBe(false);
  });

  test("空节点树未命中", () => {
    const r = locate(undefined, "byText", "x");
    expect(r.found).toBe(false);
  });
});

describe("buildGesture 手势", () => {
  test("tap 单点", () => {
    const s = buildGesture({ type: "tap", x: 10, y: 20 });
    expect(s).toHaveLength(1);
    expect(s[0].points).toEqual([{ x: 10, y: 20 }]);
  });

  test("swipe 两点", () => {
    const s = buildGesture({
      type: "swipe",
      fromX: 0,
      fromY: 0,
      toX: 100,
      toY: 200,
    });
    expect(s[0].points).toHaveLength(2);
    expect(s[0].points[1]).toEqual({ x: 100, y: 200 });
  });

  test("multiSegment 多段", () => {
    const s = buildGesture({
      type: "multiSegment",
      segments: [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
    });
    expect(s).toHaveLength(2);
  });
});

describe("decideInputMode 输入决策", () => {
  test("有节点默认 setText", () => {
    expect(decideInputMode({ text: "x" }).mode).toBe("setText");
  });
  test("无节点降级剪贴板", () => {
    expect(decideInputMode(undefined).mode).toBe("clipboard");
  });
});

describe("captureTree 读屏", () => {
  test("展平节点文本", () => {
    const text = captureTree(makeTree());
    expect(text).toContain("登录");
    expect(text).toContain("用户名");
    expect(text).toContain("登录按钮");
  });
});
