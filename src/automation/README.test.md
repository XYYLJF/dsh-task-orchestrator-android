# 阶段2 G3 无障碍引擎 —— 测试执行说明

## 一、测试文件清单

| 文件 | 归属 | 用例数 | 说明 |
|---|---|---|---|
| `app/src/automation/locate.test.ts` | 工部已产出 | 16 | 定位 10 + 手势 3 + 输入 2 + 读屏 1 |
| `app/src/workflow/executor.test.ts` | 工部已产出 | 8 | 编排引擎 FlowExecutor |
| `app/src/automation/locate.gap.test.ts` | **兵部本次新增** | 23 test | 补缺口（边界/攻防/降级） |

## 二、兵部补缺口测试内容（locate.gap.test.ts）

- **定位补缺口（9）**：byRegex 零匹配/多候选置信度/部分匹配、byId 未命中、byDesc 未命中、byCoord 边界值/无坐标、byText 空值/特殊正则字符字面量。
- **手势补缺口（5）**：longPress 时长、未知类型、multiSegment 空段、默认时长、swipe 原点缺省。
- **输入决策补缺口（5）**：空对象节点、无节点降级剪贴板带原因、editable=false 降级剪贴板、editable=true 走 setText、editable 未标注乐观走 setText。
- **读屏补缺口（4）**：空树、仅 desc 无 text、无副作用、返回新字符串。

> 说明：坐标越界裁剪、时长 ≥1ms 归一化两项边界，经工部确认归属**原生层**（Kotlin 构造 GestureDescription 时系统 coerce），TS 纯函数层不测，兵部已在文件内以注释说明，无 skip/todo 残留。TreeNode 已补 `editable` 字段，输入降级（TXT-02/03）已转真实测试用例。

## 三、执行方式

```bash
cd D:\deepseek_working\1\app
npm test                 # 运行全部 jest
npm run typecheck        # tsc --noEmit 类型检查
npx jest src/automation/locate.gap.test.ts   # 仅跑本文件
```

## 四、环境说明（重要）

- **jest 已配置**：`package.json` 已含 `"test": "jest"` + `jest-expo` preset（`"preset": "jest-expo", "transformIgnorePatterns": []`）。
- **TS 侧纯函数无需 Robolectric**：`locate.ts` 已与 Android API 解耦为纯函数，jest 即可跑；Robolectric 仅用于阶段2 原生 Kotlin Service 层（dispatchGesture 真机行为），届时由工部原生侧引入。
- **本机阻塞**：teammates 侧 `pwsh` 受工作区 ACL 异常（`grantWrite(D:\deepseek_working\1)` Win32 5）无法执行 jest/typecheck，本次仅产出测试文件 + 执行说明，由 **lead 代跑**验证。

## 五、lead 代跑核对点

1. `npm test` 全绿（工部 24 条 + 兵部 23 条 = 47 条 test 通过，无 skip/todo）。
2. `npm run typecheck` 无类型错误（重点核对 `as unknown as GestureSpec` 断言与 TreeNode 的 `editable` 字段）。
3. 若兵部补缺口测试有红，记录具体失败用例回兵部复核。

## 六、覆盖率口径（对齐④-2 命中率/覆盖率 ≥90%）

- 五类定位策略：工部 10 + 兵部 9 = 19 条，覆盖 byText/byId/byDesc/byCoord/byRegex 全部策略及边界。
- 手势：工部 3 + 兵部 5 = 8 条，覆盖 tap/swipe/longPress/multiSegment 全部类型及边界。
- 输入：工部 2 + 兵部 5 = 7 条，覆盖 setText/clipboard 降级路径（含 editable=false 不可编辑降级）。
- 读屏：工部 1 + 兵部 4 = 5 条，覆盖展平/空树/desc/无副作用。
