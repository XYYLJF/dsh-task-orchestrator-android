/**
 * 阶段4 国产 ROM 白名单引导页 —— 引导用户手动配置保活白名单
 *
 * 职责：展示各厂商 ROM 的自启动/电池优化/后台限制/悬浮窗/无障碍服务保持配置步骤。
 * 诚实声明：不同品牌路径不同，无法全自动，需用户手动逐项配置（对应《能力边界确认书》边界 B）。
 *
 * 对应方案 G5、④-4 保活验收。
 */

import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface RomGuide {
  brand: string;
  steps: { title: string; detail: string }[];
}

const ROM_GUIDES: RomGuide[] = [
  {
    brand: "小米 / Redmi（MIUI / HyperOS）",
    steps: [
      { title: "自启动", detail: "设置 → 应用设置 → 应用管理 → 本应用 → 自启动 → 开启" },
      { title: "省电策略", detail: "本应用 → 省电策略 → 无限制" },
      { title: "后台弹出界面", detail: "本应用 → 其他权限 → 后台弹出界面 → 允许" },
      { title: "无障碍服务保持", detail: "更多设置 → 无障碍 → 本应用 → 保持开启（关掉 MIUI 优化杀后台）" },
    ],
  },
  {
    brand: "OPPO / realme / 一加（ColorOS / OxygenOS）",
    steps: [
      { title: "自启动", detail: "设置 → 应用管理 → 自启动管理 → 本应用 → 允许" },
      { title: "电池优化", detail: "设置 → 电池 → 更多设置 → 本应用 → 允许后台运行 / 不优化" },
      { title: "悬浮窗", detail: "设置 → 应用管理 → 本应用 → 显示悬浮窗 → 允许" },
      { title: "无障碍保持", detail: "设置 → 无障碍 → 本应用 → 开启（锁屏后仍保持）" },
    ],
  },
  {
    brand: "vivo / iQOO（OriginOS）",
    steps: [
      { title: "自启动", detail: "设置 → 应用与权限 → 权限管理 → 自启动 → 本应用 → 允许" },
      { title: "后台高耗电", detail: "设置 → 电池 → 后台耗电管理 → 本应用 → 允许后台高耗电" },
      { title: "悬浮窗", detail: "设置 → 应用与权限 → 本应用 → 显示悬浮窗 → 允许" },
      { title: "无障碍保持", detail: "设置 → 无障碍 → 本应用 → 开启" },
    ],
  },
  {
    brand: "三星（One UI）",
    steps: [
      { title: "后台限制", detail: "设置 → 应用程序 → 本应用 → 电池 → 后台使用限制 → 不受限制" },
      { title: "无障碍", detail: "设置 → 辅助功能 → 已安装的应用 → 本应用 → 开启" },
    ],
  },
  {
    brand: "华为 / 荣耀（HarmonyOS / EMUI / MagicUI）",
    steps: [
      { title: "应用启动管理", detail: "设置 → 应用 → 应用启动管理 → 本应用 → 手动管理（允许自启动 / 关联启动 / 后台活动）" },
      { title: "电池优化", detail: "设置 → 电池 → 本应用 → 允许后台活动 / 不优化" },
      { title: "悬浮窗", detail: "设置 → 应用 → 本应用 → 权限 → 悬浮窗 → 允许" },
      { title: "无障碍", detail: "设置 → 辅助功能 → 无障碍 → 本应用 → 开启" },
    ],
  },
];

export default function WhitelistGuide() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>白名单配置引导</Text>
      <Text style={styles.notice}>
        为保持无障碍服务在后台稳定运行，需要你手动完成以下配置。不同品牌手机的设置路径不同，本应用无法自动替你完成，请逐项操作。
      </Text>
      {ROM_GUIDES.map((rom) => (
        <View key={rom.brand} style={styles.romBlock}>
          <Text style={styles.brand}>{rom.brand}</Text>
          {rom.steps.map((step) => (
            <View key={step.title} style={styles.step}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDetail}>{step.detail}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "600", marginBottom: 8 },
  notice: { color: "#b26a00", marginBottom: 16, lineHeight: 20 },
  romBlock: { marginBottom: 20 },
  brand: { fontSize: 16, fontWeight: "600", marginBottom: 6, color: "#1565c0" },
  step: { marginBottom: 8, paddingLeft: 8 },
  stepTitle: { fontWeight: "500", marginBottom: 2 },
  stepDetail: { color: "#555", lineHeight: 18 },
});
