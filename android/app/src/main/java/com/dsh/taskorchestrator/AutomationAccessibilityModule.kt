package com.dsh.taskorchestrator

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap

/**
 * 阶段2 桥接原生模块 —— 连接 JS 编排引擎与 AutomationAccessibilityService。
 *
 * 通过 AutomationAccessibilityService.getInstance() 获取服务实例（companion object 单例，
 * onServiceConnected 时赋值），无需显式 bindService，避免生命周期错配。
 *
 * 读屏数据合规（④-7）：readScreen 返回的文本仅内存态传递，不落盘、不外发、即时丢弃。
 */
class AutomationAccessibilityModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AutomationAccessibility"

  private val service: AutomationAccessibilityService?
    get() = AutomationAccessibilityService.getInstance()

  @ReactMethod
  fun locate(req: ReadableMap, promise: Promise) {
    try {
      val strategy = req.getString("strategy") ?: "text"
      val value = if (req.hasKey("value")) req.getString("value") else null
      val x = if (req.hasKey("x")) req.getDouble("x").toFloat() else null
      val y = if (req.hasKey("y")) req.getDouble("y").toFloat() else null
      val result: WritableMap = service?.locate(strategy, value, x, y)
        ?: Arguments.createMap().also { it.putBoolean("found", false) }
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
