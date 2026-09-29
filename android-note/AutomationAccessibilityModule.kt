package com.dsh.taskorchestrator

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

/**
 * 阶段2 TurboModule/桥接原生模块 —— 连接 JS 编排引擎与 AutomationAccessibilityService。
 *
 * 注意：本类通过 RN NativeModules 机制注册（newArchEnabled=false 时），
 * 由 config plugin 在 prebuild 时写入 android 工程（见 plugins/withAndroidAccessibility.js
 * 的 withAccessibilityNativeFiles 扩展）。当前为文件产出，实际挂载待 lead 代跑
 * prebuild + assembleDebug 验证。
 *
 * 读屏数据合规（④-7）：readScreen 返回的文本仅内存态传递，不落盘、不外发、即时丢弃。
 */
class AutomationAccessibilityModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AutomationAccessibility"

  /** 单例服务引用（由 AutomationAccessibilityService 绑定后注入） */
  private var service: AutomationAccessibilityService? = null

  fun bindService(s: AutomationAccessibilityService) {
    service = s
  }

  @ReactMethod
  fun locate(req: ReadableMap, promise: Promise) {
    try {
      val strategy = req.getString("strategy") ?: "text"
      val value = req.getString("value")
      val x = if (req.hasKey("x")) req.getDouble("x") else null
      val y = if (req.hasKey("y")) req.getDouble("y") else null
      val result = service?.locate(strategy, value, x?.toFloat(), y?.toFloat())
        ?: mapOf("found" to false)
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("LOCATE_FAILED", e)
    }
  }

  @ReactMethod
  fun gesture(req: ReadableMap, promise: Promise) {
    try {
      val type = req.getString("type") ?: "tap"
      val success = service?.gesture(type, req) ?: false
      promise.resolve(mapOf("success" to success))
    } catch (e: Exception) {
      promise.reject("GESTURE_FAILED", e)
    }
  }

  @ReactMethod
  fun input(req: ReadableMap, promise: Promise) {
    try {
      val text = req.getString("text") ?: ""
      val r = service?.input(text) ?: false
      promise.resolve(mapOf("success" to r))
    } catch (e: Exception) {
      promise.reject("INPUT_FAILED", e)
    }
  }

  @ReactMethod
  fun readScreen(promise: Promise) {
    try {
      val text = service?.dumpActiveWindowText() ?: ""
      promise.resolve(mapOf("text" to text))
    } catch (e: Exception) {
      promise.reject("READ_FAILED", e)
    }
  }
}
