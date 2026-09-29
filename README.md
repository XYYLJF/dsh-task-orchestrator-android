# DSH 任务编排（dsh-task-orchestrator）

> Android 手机端 DeepSeek Harness「任务编排」应用 —— 通过无障碍服务像人一样自动化操作任意 App，把多步骤重复操作串成可执行的任务流程，并连接 DeepSeek Harness 宿主完成智能编排。

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)

---

## 简介

本项目是 DeepSeek Harness（DSH）的 Android 移动端，复用 DSH 已成熟的 Agent Loop、Cordis 插件与 ACP（Agent Client Protocol）客户端协议，以 Expo / React Native 轻量客户端连接 DSH 宿主，提供「多步骤、跨应用」的任务编排能力。

核心思路：通过 Android **无障碍服务（AccessibilityService）**，实现「定位控件 → 模拟手势 → 文本输入 → 读屏」四类原语，把「可被无障碍触达的动作」编排成自动化流程。

---

## 功能特性

- **无障碍 UI 自动化**：自动点击、滑动、输入、读屏（`AccessibilityService` + `dispatchGesture` + `AccessibilityNodeInfo` 节点树）。
- **任务编排引擎**：顺序、条件分支、循环、延时、重试、变量传递、执行日志与错误回放。
- **DSH 宿主连接**：基于 `@agentclientprotocol/sdk` 的 ACP 客户端，支持会话建立、消息发送、流式接收。
- **跨平台连接层**：连接层纯 TypeScript，平台无关。

---

## 能力边界（诚实声明）

本项目做的是「编排可被无障碍服务触达的动作」，**不承诺「任意 App 100% 可控」**：

- 核心控制能力来自 Android 无障碍服务，可操作绝大多数普通 App。
- **个别 App 无法完整读取**：采用 Flutter、游戏引擎等自绘界面，或 WebView（网页）渲染的 App，其控件可能无法以标准「控件树」形式被识别，此时读屏定位与自动点击可能受限或失败，将**降级为坐标操作或提示不支持**。
- 目标 App 未响应手势、节点树为空等场景，会明确失败提示，不做虚假成功。

---

## 数据隐私（读屏数据声明）

无障碍服务在「定位要点击的控件」时，会**短暂读取到屏幕上其他 App 的节点文本**。对此本项目作出如下承诺：

| # | 承诺 | 说明 |
|---|---|---|
| 1 | 纯本地处理 | 读到的内容只在设备本地处理，不上传任何服务器 |
| 2 | 仅用于控件定位 | 读取只为定位「要点的按钮在哪」，不采集用户内容 |
| 3 | 不落盘 | 不写入设备存储、不持久化保存 |
| 4 | 不外传 | 不发送给任何第三方 |
| 5 | 即时丢弃 | 用完后立即释放，不做留存 |

> 一句话：**读屏只为「找到该点的控件」，内容即用即丢、本地处理、绝不外传。** 该数据生命周期可通过代码走查与行为复核审计。

---

## 前置条件（用户需手动配置）

本 App 要正常工作，有两件事**无法全自动完成，需用户手动配置一次**：

1. **授权无障碍服务**：首次使用时需在系统设置中手动开启本 App 的无障碍服务（系统安全限制，App 无法自行开启）。
2. **国产 ROM 白名单**：小米、OPPO、vivo、荣耀、华为等国产系统为省电会后台回收 App，需手动开启「自启动、电池优化不受限、后台运行限制、悬浮窗权限、无障碍服务保持」等。

> 不同品牌手机的设置路径与选项名称各不相同，需用户手动逐项配置；未配置可能导致 App 被系统回收、无法稳定自动执行。

---

## 目录结构

```
.
├── app/                        # Expo / React Native 应用
│   ├── App.tsx                 # 入口（聊天 UI + 编排 UI）
│   ├── app.json                # Expo 配置（android.package、config plugin）
│   ├── package.json            # 依赖与脚本
│   ├── .npmrc                  # 国内镜像（npmmirror）
│   ├── plugins/
│   │   └── withAndroidAccessibility  # 无障碍服务 config plugin
│   └── src/
│       ├── config.ts           # 宿主连接配置
│       ├── acp/client.ts       # ACP 客户端（connectToHost + chatOnce）
│       ├── automation/         # 无障碍引擎（engine / locate）
│       └── workflow/           # 编排引擎（executor）
├── README.md
└── LICENSE
```

---

## 构建说明

### 环境要求

- Node.js 18+ / pnpm
- Android SDK（Android Studio 或独立 SDK）
- JDK 17+
- Windows / macOS / Linux 均可本机构建

### 安装依赖（国内镜像）

```bash
# npm / pnpm 走国内镜像
pnpm install
```

### 构建与运行

```bash
# 类型检查
pnpm typecheck

# 运行单元测试
pnpm test

# 启动 Expo（开发）
pnpm start

# 构建并运行 Android（生成原生工程，含无障碍服务 config plugin 注入）
pnpm android
```

> 生成 release APK：`cd app && expo run:android --variant release`（或经 `expo prebuild` 产出原生工程后，用 Gradle 构建）。
>
> **国内镜像**：npm/pnpm 用 npmmirror；Gradle/Maven 用阿里云镜像；Android SDK 用国内镜像。详见 `app/.npmrc` 与 Gradle 配置。

---

## 连接 DSH 宿主

本 App 通过 ACP（Agent Client Protocol）连接自托管的 DSH 宿主，默认局域网直连：

1. 在桌面/服务器运行 DSH 宿主（`dsh-headless` 或桌面端）。
2. 在 App 设置页填写宿主 ACP 端点（形如 `http://<宿主IP>:<端口>/acp`）。
3. 鉴权凭证（Bearer token）经 `expo-secure-store` 本地安全存储。

**安全说明**：不硬编码宿主地址与凭证，不内置任何远程中转；协议版本与 DSH 宿主协商，客户端做版本兼容。

---

## 合规声明

- 依赖全程走国内镜像（npmmirror / 阿里云 / 清华 TUNA）。
- **不接入短信 / 推送类外部服务**。
- 无障碍用途声明诚实涵盖「定位控件需短暂读取他屏节点文本」这一技术事实。
- 不包含任何越界能力或虚假宣传；读屏数据本地处理、不外传。

---

## 许可证

本仓库暂按 [Apache License 2.0](./LICENSE) 出具（兼顾专利条款）；**待用户最终确认**，亦可按用户选择更换为更宽松的 MIT 许可。确认后移除本提示。

> 许可证正文见 [LICENSE](./LICENSE)。
