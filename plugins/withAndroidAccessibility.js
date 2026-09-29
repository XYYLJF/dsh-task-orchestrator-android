/**
 * Expo config plugin —— 注入原生 Android 无障碍服务（R5 选型验证 · 真实实现）
 *
 * 在 `expo prebuild` 时完成三件事：
 * 1. 向 AndroidManifest.xml 注入 BIND_ACCESSIBILITY_SERVICE 权限；
 * 2. 向 AndroidManifest.xml 注入 <service> 节点（无障碍服务声明 + intent-filter + meta-data）；
 * 3. 写入 Kotlin 服务类 + res/xml/accessibility_service_config.xml（通过 withDangerousMod 直接操作 android/ 工程）。
 *
 * 用法：app.json 的 plugins 数组已注册 "./plugins/withAndroidAccessibility"。
 */

const fs = require("fs");
const path = require("path");
const {
  withAndroidManifest,
  withDangerousMod,
} = require("@expo/config-plugins");

const ACCESSIBILITY_PERMISSION =
  "android.permission.BIND_ACCESSIBILITY_SERVICE";
const SERVICE_NAME = ".AutomationAccessibilityService";

// 无障碍服务配置 XML（accessibilityEventTypes / feedbackType / canRetrieveWindowContent 等）
const ACCESSIBILITY_SERVICE_CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowStateChanged|typeWindowContentChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagDefault|flagRetrieveInteractiveWindows|flagReportViewIds"
    android:canRetrieveWindowContent="true"
    android:canPerformGestures="true"
    android:description="@string/accessibility_service_description"
    android:notificationTimeout="100" />
`;

// Kotlin 无障碍服务类（最小可验证实现）
const ACCESSIBILITY_SERVICE_KOTLIN = `package com.dsh.taskorchestrator

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class AutomationAccessibilityService : AccessibilityService() {

    override fun onServiceConnected() {
        super.onServiceConnected()
        serviceInfo = serviceInfo.apply {
            flags = flags or AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // 阶段 2 实现完整引擎，此处为最小占位
    }

    override fun onInterrupt() {}

    /** R5 判定标准③：dispatchGesture 点击注入一例 */
    fun performTap(x: Float, y: Float): Boolean {
        val path = Path().apply { moveTo(x, y) }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 100))
            .build()
        return dispatchGesture(gesture, null, null)
    }

    /** 读屏：抓取当前窗口根节点文本（仅本地、即时丢弃、不落盘不外发） */
    fun dumpActiveWindowText(): String {
        val root = rootInActiveWindow ?: return ""
        val sb = StringBuilder()
        collectText(root, sb)
        return sb.toString()
    }

    private fun collectText(node: AccessibilityNodeInfo, sb: StringBuilder) {
        if (!node.text.isNullOrEmpty()) {
            sb.append(node.text).append('\\n')
        }
        for (i in 0 until node.childCount) {
            node.getChild(i)?.let { collectText(it, sb) }
        }
    }
}
`;

function withAccessibilityServicePermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!Array.isArray(manifest["uses-permission"])) {
      manifest["uses-permission"] = [];
    }
    const has = manifest["uses-permission"].some(
      (p) => p.$ && p.$["android:name"] === ACCESSIBILITY_PERMISSION,
    );
    if (!has) {
      manifest["uses-permission"].push({
        $: { "android:name": ACCESSIBILITY_PERMISSION },
      });
    }
    return config;
  });
}

function withAccessibilityServiceNode(config) {
  // 改用 withDangerousMod 直接文本操作 manifest（withAndroidManifest 写 service 节点
  // 在 expo manifest 合成环节会丢失 application 子节点引用，见 lead 二验诊断）。
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const manifestPath = path.join(
        projectRoot,
        "android",
        "app",
        "src",
        "main",
        "AndroidManifest.xml",
      );
      const serviceXml = `    <service android:name=".AutomationAccessibilityService"
        android:exported="true"
        android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
        android:label="@string/accessibility_service_label">
        <intent-filter>
            <action android:name="android.accessibilityservice.AccessibilityService"/>
        </intent-filter>
        <meta-data android:name="android.accessibilityservice"
            android:resource="@xml/accessibility_service_config"/>
    </service>
`;

      let manifestContent = fs.readFileSync(manifestPath, "utf8");

      // 若已存在则跳过，避免重复插入
      if (manifestContent.includes("AutomationAccessibilityService")) {
        return config;
      }

      // 在 </application> 前插入 service 节点
      const closeTag = "</application>";
      const idx = manifestContent.lastIndexOf(closeTag);
      if (idx === -1) {
        throw new Error("AndroidManifest.xml 中未找到 </application> 节点");
      }
      manifestContent =
        manifestContent.slice(0, idx) +
        serviceXml +
        manifestContent.slice(idx);

      fs.writeFileSync(manifestPath, manifestContent);
      return config;
    },
  ]);
}

function withAccessibilityNativeFiles(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const mainDir = path.join(
        projectRoot,
        "android",
        "app",
        "src",
        "main",
      );
      const kotlinDir = path.join(
        mainDir,
        "java",
        "com",
        "dsh",
        "taskorchestrator",
      );
      const xmlDir = path.join(mainDir, "res", "xml");
      const valuesDir = path.join(mainDir, "res", "values");

      fs.mkdirSync(kotlinDir, { recursive: true });
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.mkdirSync(valuesDir, { recursive: true });

      // 写入 Kotlin 服务类
      fs.writeFileSync(
        path.join(kotlinDir, "AutomationAccessibilityService.kt"),
        ACCESSIBILITY_SERVICE_KOTLIN,
      );

      // 写入无障碍服务配置 XML
      fs.writeFileSync(
        path.join(xmlDir, "accessibility_service_config.xml"),
        ACCESSIBILITY_SERVICE_CONFIG_XML,
      );

      // 追加字符串资源（accessibility_service_description）
      const stringsPath = path.join(valuesDir, "strings.xml");
      let stringsContent;
      if (fs.existsSync(stringsPath)) {
        stringsContent = fs.readFileSync(stringsPath, "utf8");
      } else {
        stringsContent = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n`;
      }
      if (!stringsContent.includes("accessibility_service_description")) {
        const injected = `<string name="accessibility_service_description">帮助用户自动化重复操作，读屏数据仅本地处理、不外传</string>`;
        stringsContent = stringsContent.replace(
          "</resources>",
          `    ${injected}\n</resources>`,
        );
        fs.writeFileSync(stringsPath, stringsContent);
      }

      // 追加 service label 字符串（供 <service android:label> 引用，避免中文直写 AAPT 告警）
      stringsContent = fs.readFileSync(stringsPath, "utf8");
      if (!stringsContent.includes("accessibility_service_label")) {
        const labelXml = `<string name="accessibility_service_label">DSH 任务编排无障碍服务</string>`;
        stringsContent = stringsContent.replace(
          "</resources>",
          `    ${labelXml}\n</resources>`,
        );
        fs.writeFileSync(stringsPath, stringsContent);
      }

      return config;
    },
  ]);
}

module.exports = function withAndroidAccessibility(config) {
  config = withAccessibilityServicePermission(config);
  config = withAccessibilityServiceNode(config);
  config = withAccessibilityNativeFiles(config);
  return config;
};
