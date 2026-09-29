/**
 * 阶段5 编排 UI —— 流程列表 + 步骤编辑 + 执行
 *
 * 职责：编排画布/列表、步骤编辑、模板库、执行进度与日志、权限引导。
 * 对应方案 G1/G4、④-5 验收（用户零代码搭建 ≥3 步跨 App 流程平均 <3 分钟）。
 *
 * 本文件为阶段5 UI 骨架，与 FlowExecutor（阶段3）+ AccessibilityEngine（阶段2）衔接。
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { FlowExecutor, Flow, Step } from "../workflow/executor";
import { getBridgedEngine } from "../automation/bridge";

/** 模板库：零代码可选的预置流程模板 */
const TEMPLATES: { id: string; name: string; steps: Step[] }[] = [
  {
    id: "tpl-open-app",
    name: "打开应用并点击",
    steps: [
      { id: "s1", type: "delay", delayMs: 1000 },
      { id: "s2", type: "tap", params: { x: 100, y: 200 } },
    ],
  },
  {
    id: "tpl-fill-form",
    name: "填写表单",
    steps: [
      { id: "s1", type: "tap", params: { x: 50, y: 60 } },
      { id: "s2", type: "input", params: { text: "" } },
      { id: "s3", type: "tap", params: { x: 300, y: 400 } },
    ],
  },
];

interface ExecLog {
  stepId: string;
  status: string;
  message?: string;
}

export default function WorkflowEditor() {
  const [flowName, setFlowName] = useState("我的流程");
  const [steps, setSteps] = useState<Step[]>([]);
  const [logs, setLogs] = useState<ExecLog[]>([]);
  const [running, setRunning] = useState(false);
  const executorRef = useRef(new FlowExecutor(getBridgedEngine()));

  const addStep = useCallback((type: Step["type"]) => {
    setSteps((prev) => [
      ...prev,
      { id: `step-${prev.length + 1}`, type },
    ]);
  }, []);

  const applyTemplate = useCallback((tpl: (typeof TEMPLATES)[number]) => {
    setFlowName(tpl.name);
    setSteps(tpl.steps.map((s, i) => ({ ...s, id: `${s.id}-${i}` })));
  }, []);

  const runFlow = useCallback(async () => {
    if (running || steps.length === 0) return;
    setRunning(true);
    setLogs([]);
    const flow: Flow = { id: "flow-1", name: flowName, steps };
    const result = await executorRef.current.run(flow);
    setLogs(
      result.logs.map((l) => ({
        stepId: l.stepId,
        status: l.status,
        message: l.message,
      })),
    );
    setRunning(false);
  }, [steps, flowName, running]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>任务编排</Text>

      {/* 流程名 */}
      <TextInput
        style={styles.input}
        value={flowName}
        onChangeText={setFlowName}
        placeholder="流程名称"
      />

      {/* 模板库 */}
      <Text style={styles.section}>模板库（零代码）</Text>
      <ScrollView horizontal style={styles.templates}>
        {TEMPLATES.map((tpl) => (
          <View key={tpl.id} style={styles.tplCard}>
            <Text style={styles.tplName}>{tpl.name}</Text>
            <Button title="使用" onPress={() => applyTemplate(tpl)} />
          </View>
        ))}
      </ScrollView>

      {/* 步骤列表 */}
      <Text style={styles.section}>步骤（{steps.length} 步）</Text>
      <FlatList
        data={steps}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <View style={styles.stepRow}>
            <Text style={styles.stepIdx}>{index + 1}.</Text>
            <Text style={styles.stepType}>{item.type}</Text>
          </View>
        )}
        style={styles.stepList}
      />

      {/* 添加步骤 */}
      <View style={styles.addRow}>
        {(["tap", "swipe", "input", "delay", "loop"] as const).map((t) => (
          <View key={t} style={styles.addBtn}>
            <Button title={`+${t}`} onPress={() => addStep(t)} />
          </View>
        ))}
      </View>

      {/* 执行 */}
      <Button
        title={running ? "执行中…" : "运行流程"}
        onPress={runFlow}
        disabled={running || steps.length === 0}
      />

      {/* 执行日志 */}
      {logs.length > 0 && (
        <>
          <Text style={styles.section}>执行日志</Text>
          <ScrollView style={styles.logs}>
            {logs.map((l, i) => (
              <Text key={i} style={styles.logLine}>
                [{l.status}] {l.stepId}
                {l.message ? ` - ${l.message}` : ""}
              </Text>
            ))}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "600", marginBottom: 8 },
  section: { fontSize: 15, fontWeight: "600", marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    marginBottom: 4,
  },
  templates: { flexGrow: 0, marginBottom: 4 },
  tplCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 8,
    marginRight: 8,
    alignItems: "center",
  },
  tplName: { marginBottom: 4 },
  stepList: { flexGrow: 0, maxHeight: 200 },
  stepRow: { flexDirection: "row", paddingVertical: 4, gap: 8 },
  stepIdx: { fontWeight: "600", width: 24 },
  stepType: { color: "#333" },
  addRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 },
  addBtn: { flexGrow: 0 },
  logs: { maxHeight: 150, backgroundColor: "#f7f7f7", padding: 8, borderRadius: 6 },
  logLine: { fontFamily: "monospace", fontSize: 12, lineHeight: 18 },
});
