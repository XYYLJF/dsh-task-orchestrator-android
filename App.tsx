/**
 * 阶段1 宿主连接 MVP —— 最小聊天界面
 *
 * 验收对照（方案④-1 连接）：
 * - iOS App 对 DSH 宿主完成一次「问-答」流式对话
 * - 首字节响应 P50 < 3s（局域网直连）、流式 token 无丢帧
 * - 断线重连成功率 ≥99%（100 次压测，压测命令由 lead 代跑）
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import { connectToHost, chatOnce, AcpConnection } from "./src/acp/client";
import { DEFAULT_CONFIG } from "./src/config";

const KEY_SERVER_URL = "dsh.host.serverUrl";
const KEY_AUTH_TOKEN = "dsh.host.authToken";

interface ChatLine {
  role: "user" | "assistant";
  text: string;
}

export default function App() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_CONFIG.serverUrl);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectionRef = useRef<AcpConnection | null>(null);

  // N4 修正：从 SecureStore 读取已保存的宿主地址与凭证，不硬编码
  useEffect(() => {
    (async () => {
      const savedUrl = await SecureStore.getItemAsync(KEY_SERVER_URL);
      if (savedUrl) setServerUrl(savedUrl);
      const savedToken = await SecureStore.getItemAsync(KEY_AUTH_TOKEN);
      if (savedToken) setAuthToken(savedToken);
    })();
  }, []);

  const persistHost = useCallback(async (url: string, token: string | null) => {
    await SecureStore.setItemAsync(KEY_SERVER_URL, url);
    if (token) {
      await SecureStore.setItemAsync(KEY_AUTH_TOKEN, token);
    } else {
      await SecureStore.deleteItemAsync(KEY_AUTH_TOKEN);
    }
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;

    setBusy(true);
    setError(null);
    setLines((prev) => [...prev, { role: "user", text }]);
    setInput("");

    // 流式累积：当前助手回复行
    // N5 注：update.text 按增量语义累加；若 SDK 为全量语义需改为直接替换
    let assistantAcc = "";
    const assistantLine = (next: string) => {
      assistantAcc = next;
      setLines((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          copy[copy.length - 1] = { role: "assistant", text: next };
        } else {
          copy.push({ role: "assistant", text: next });
        }
        return copy;
      });
    };

    try {
      await persistHost(serverUrl, authToken);
      if (!connectionRef.current) {
        connectionRef.current = connectToHost({
          serverUrl,
          authToken: authToken ?? undefined,
          protocolVersion: DEFAULT_CONFIG.protocolVersion,
          timeoutMs: DEFAULT_CONFIG.timeoutMs,
        });
      }

      const connection = connectionRef.current;
      await chatOnce(connection, text, (chunk) =>
        assistantLine(assistantAcc + chunk.text),
      );
    } catch (err) {
      // 断线重连：失败后重置连接，下次重试重新建立
      connectionRef.current = null;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [input, busy, serverUrl, authToken, persistHost]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>DSH 任务编排 · 阶段1 宿主连接</Text>

      <TextInput
        style={styles.urlInput}
        placeholder="DSH 宿主地址（http://host:port/acp）"
        value={serverUrl}
        onChangeText={setServerUrl}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TextInput
        style={styles.urlInput}
        placeholder="Bearer token（可选，自托管凭证）"
        value={authToken ?? ""}
        onChangeText={setAuthToken}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />

      <ScrollView style={styles.chat} contentContainerStyle={styles.chatContent}>
        {lines.map((line, i) => (
          <Text
            key={i}
            style={line.role === "user" ? styles.userLine : styles.assistantLine}
          >
            {line.role === "user" ? "我：" : "助手："}
            {line.text}
          </Text>
        ))}
        {busy && <ActivityIndicator />}
        {error && <Text style={styles.error}>错误：{error}</Text>}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="输入消息…"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
        />
        <Button title="发送" onPress={handleSend} disabled={busy} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  urlInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  chat: { flex: 1 },
  chatContent: { paddingVertical: 8 },
  userLine: { textAlign: "right", marginBottom: 8, color: "#1565c0" },
  assistantLine: { textAlign: "left", marginBottom: 8, color: "#333" },
  error: { color: "#d32f2f", marginVertical: 8 },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
  },
});
