/**
 * 阶段5 权限引导页 —— 引导用户授权无障碍服务 + 悬浮窗
 *
 * 职责：首次使用时引导用户开启无障碍服务、授权悬浮窗（对应《能力边界确认书》边界 B）。
 * 诚实声明：无障碍服务需用户在系统设置手动开启，App 无法自动开启。
 */

import React from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";

export default function PermissionGuide() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>权限引导</Text>
      <Text style={styles.notice}>
        本应用需要以下两项权限才能自动操作其他 App。出于系统安全设计，这两项均需你手动开启。
      </Text>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>1. 开启无障碍服务</Text>
        <Text style={styles.detail}>
          路径：设置 → 无障碍（辅助功能）→ 已安装的服务 → 「DSH 任务编排无障碍服务」→ 开启。
        </Text>
        <Text style={styles.detail}>
          本服务用于执行自动点击、滑动、输入、读屏。读屏数据仅本地处理、不外传。
        </Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>2. 授权悬浮窗</Text>
        <Text style={styles.detail}>
          路径：设置 → 应用 → 本应用 → 权限 → 显示悬浮窗 → 允许。
        </Text>
        <Text style={styles.detail}>
          悬浮窗用于展示任务执行状态。
        </Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>3. 国产 ROM 白名单</Text>
        <Text style={styles.detail}>
          小米、OPPO、vivo、华为等国产系统会后台清理应用，需按白名单引导页逐项配置。
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "600", marginBottom: 8 },
  notice: { color: "#b26a00", marginBottom: 16, lineHeight: 20 },
  block: { marginBottom: 20 },
  blockTitle: { fontSize: 16, fontWeight: "600", marginBottom: 6 },
  detail: { color: "#555", lineHeight: 20, marginBottom: 4 },
});
