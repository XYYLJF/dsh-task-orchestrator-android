/**
 * Expo config plugin —— 注入原生 Android 无障碍服务 + 桥接模块（阶段2 G3 引擎）
 *
 * 在 `expo prebuild` 时完成：
 * 1. 向 AndroidManifest.xml 注入 BIND_ACCESSIBILITY_SERVICE 权限；
 * 2. 向 AndroidManifest.xml 注入 <service> 节点（无障碍服务声明 + intent-filter + meta-data）；
 * 3. 从 android-note/ 读取 Kotlin 源码（AutomationAccessibilityService.kt /
 *    AutomationAccessibilityModule.kt）写入 android 工程，并写 res/xml 配置 + strings。
 *
 * 单一来源原则：Kotlin 源码以 android-note/ 为准（plugin 运行时读取注入），
 * 避免内嵌字符串与源文件漂移。
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
  // 在 expo manifest 合成环节会丢失 application 子节点引用）。
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

      if (manifestContent.includes("AutomationAccessibilityService")) {
        return config;
      }

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
      const mainDir = path.join(projectRoot, "android", "app", "src", "main");
      const kotlinDir = path.join(mainDir, "java", "com", "dsh", "taskorchestrator");
      const xmlDir = path.join(mainDir, "res", "xml");
      const valuesDir = path.join(mainDir, "res", "values");

      fs.mkdirSync(kotlinDir, { recursive: true });
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.mkdirSync(valuesDir, { recursive: true });

      // 单一来源：从 android-note/ 读取 Kotlin 源码注入
      const noteDir = path.join(projectRoot, "android-note");
      const serviceSrc = path.join(noteDir, "AutomationAccessibilityService.kt");
      const moduleSrc = path.join(noteDir, "AutomationAccessibilityModule.kt");
      const packageSrc = path.join(noteDir, "AutomationAccessibilityPackage.kt");

      if (fs.existsSync(serviceSrc)) {
        fs.writeFileSync(
          path.join(kotlinDir, "AutomationAccessibilityService.kt"),
          fs.readFileSync(serviceSrc, "utf8"),
        );
      }
      if (fs.existsSync(moduleSrc)) {
        fs.writeFileSync(
          path.join(kotlinDir, "AutomationAccessibilityModule.kt"),
          fs.readFileSync(moduleSrc, "utf8"),
        );
      }
      if (fs.existsSync(packageSrc)) {
        fs.writeFileSync(
          path.join(kotlinDir, "AutomationAccessibilityPackage.kt"),
          fs.readFileSync(packageSrc, "utf8"),
        );
      }

      // 注册 AutomationAccessibilityPackage 到 MainApplication.getPackages
      const mainAppPath = path.join(kotlinDir, "MainApplication.kt");
      if (fs.existsSync(mainAppPath)) {
        let mainContent = fs.readFileSync(mainAppPath, "utf8");
        if (
          !mainContent.includes("AutomationAccessibilityPackage()") &&
          mainContent.includes("val packages = PackageList(this).packages")
        ) {
          mainContent = mainContent.replace(
            "val packages = PackageList(this).packages",
            "val packages = PackageList(this).packages\n            packages.add(AutomationAccessibilityPackage())",
          );
          fs.writeFileSync(mainAppPath, mainContent);
        }
      }

      // 写入无障碍服务配置 XML
      fs.writeFileSync(
        path.join(xmlDir, "accessibility_service_config.xml"),
        ACCESSIBILITY_SERVICE_CONFIG_XML,
      );

      // 追加字符串资源（accessibility_service_description / accessibility_service_label）
      const stringsPath = path.join(valuesDir, "strings.xml");
      let stringsContent;
      if (fs.existsSync(stringsPath)) {
        stringsContent = fs.readFileSync(stringsPath, "utf8");
      } else {
        stringsContent = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n`;
      }
      if (!stringsContent.includes("accessibility_service_description")) {
        stringsContent = stringsContent.replace(
          "</resources>",
          `    <string name="accessibility_service_description">帮助用户自动化重复操作，读屏数据仅本地处理、不外传</string>\n</resources>`,
        );
      }
      if (!stringsContent.includes("accessibility_service_label")) {
        stringsContent = stringsContent.replace(
          "</resources>",
          `    <string name="accessibility_service_label">DSH 任务编排无障碍服务</string>\n</resources>`,
        );
      }
      fs.writeFileSync(stringsPath, stringsContent);

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
