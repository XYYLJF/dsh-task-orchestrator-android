/**
 * 宿主连接配置（阶段1）
 *
 * 默认走「局域网直连桌面 DSH 宿主」，本地 LLM 后置（方案阶段0已冻结）。
 * 生产环境应通过 SecureStore 保存自托管宿主地址与凭证，不硬编码、不内置远程中转。
 */

export interface AppConfig {
  /** ACP 端点，可在设置页覆盖 */
  serverUrl: string;
  /** 协议版本，与 DSH 0.2.0-rc.1 对齐 */
  protocolVersion: number;
  /** 连接超时（毫秒） */
  timeoutMs: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  // 占位：用户自托管 DSH 宿主地址，首次使用时需在设置页配置后保存
  // （N3 修正：不再用字面量 PORT，改为明确占位提示）
  serverUrl: "http://<宿主IP>:<端口>/acp",
  protocolVersion: 1,
  timeoutMs: 10_000,
};
