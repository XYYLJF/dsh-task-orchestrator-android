/**
 * ACP 客户端连接层（阶段1 宿主连接 MVP · 跨平台，Android 方案下同样适用）
 *
 * 职责：封装 @agentclientprotocol/sdk，建立到 DSH 宿主的 ACP 连接，
 * 提供「会话建立 → 发送消息 → 流式接收」最小能力。
 *
 * SDK 1.5.0 真实 API（lead 代跑 typecheck 取证，权威）：
 * - 主入口 `@agentclientprotocol/sdk` 导出 `client(options?: AppOptions): ClientApp`（函数，非 new Client）。
 *   AppOptions 仅 { name?: string }，无 version 字段。
 * - `createHttpStream(serverUrl, options?: {fetch?, headers?, cookies?, cookieStore?}): Stream`
 *   在子路径 `@agentclientprotocol/sdk/experimental/http-client` 导出。
 *   · 无 authToken/timeoutMs 参数：鉴权用 headers.Authorization；超时由调用方 AbortSignal 控制。
 *   · options.fetch 注入 expo/fetch（RN 默认 fetch 不支持流式 body，刑部 B1 落地要点）。
 * - 连接：`client({name}).connect(stream)` 返回 ClientConnection（含 agent: ClientContext）。
 * - 会话：`ctx.buildSession(cwd | NewSessionRequest): SessionBuilder`；`await builder.start(): Promise<ActiveSession>`。
 * - 交互：`await session.prompt(text): Promise<PromptResponse>`；
 *   流式增量 `await session.nextUpdate(): ActiveSessionMessage` —— kind="session_update" 且
 *   update.sessionUpdate === "agent_message_chunk" 时取 ContentChunk.text 增量；kind="stop" 回合结束。
 */

import { client } from "@agentclientprotocol/sdk";
import { createHttpStream } from "@agentclientprotocol/sdk/experimental/http-client";
import { fetch as expoFetch } from "expo/fetch";

/** 宿主连接配置 */
export interface HostConfig {
  /** ACP 端点，如 http://192.168.1.10:PORT/acp（局域网直连） */
  serverUrl: string;
  /** 可选 Bearer token（用户自托管宿主的端到端凭证，来自 SecureStore） */
  authToken?: string;
  /** 协议版本（SDK 1.5.0 自动协商，此字段保留兼容、暂不参与） */
  protocolVersion?: number;
  /** 连接超时（SDK 无此参数，需 AbortSignal 控制，MVP 暂用 SDK 默认） */
  timeoutMs?: number;
}

/** 流式响应回调：逐 token 增量输出 */
export type OnChunk = (chunk: { text: string; raw?: unknown }) => void;

/**
 * 建立 ACP 连接并返回客户端侧连接（ClientConnection）。
 * 失败时抛出异常（调用方捕获后做断线重连/降级）。
 */
export function connectToHost(config: HostConfig) {
  // B1 落地：options.fetch 注入 expo/fetch，解决 RN 默认 fetch 流式 body 不支持问题
  const stream = createHttpStream(config.serverUrl, {
    fetch: expoFetch as unknown as typeof fetch,
    headers: config.authToken
      ? { Authorization: `Bearer ${config.authToken}` }
      : undefined,
  });

  const app = client({ name: "dsh-task-orchestrator" });
  return app.connect(stream);
}

/** 连接类型（由 connectToHost 返回类型推断，避免显式依赖 SDK 内部类型名） */
export type AcpConnection = ReturnType<typeof connectToHost>;

/**
 * 建立会话并发送一条消息，流式返回助手回复。
 * 对应阶段1 验收：iOS App 对 DSH 宿主完成一次「问-答」流式对话。
 */
export async function chatOnce(
  connection: AcpConnection,
  message: string,
  onChunk: OnChunk,
  opts?: { cwd?: string; signal?: AbortSignal },
): Promise<void> {
  const session = await connection.agent
    .buildSession(opts?.cwd ?? "/")
    .start();

  // 发起 prompt（流式增量经 nextUpdate 读取）
  const promptPromise = session.prompt(message);

  for (;;) {
    const update = await session.nextUpdate();
    const u = update as unknown as {
      kind?: string;
      update?: { sessionUpdate?: string; content?: { text?: string }; text?: string };
    };

    if (u.kind === "stop") break;

    if (
      u.kind === "session_update" &&
      u.update?.sessionUpdate === "agent_message_chunk"
    ) {
      // ContentChunk.text 为增量文本
      const text = u.update?.content?.text ?? u.update?.text ?? "";
      if (text) onChunk({ text, raw: update });
    }
  }

  await promptPromise;
}
