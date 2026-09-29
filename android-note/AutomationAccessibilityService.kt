/**
 * 原生 AccessibilityService —— R5 选型验证的最小实现
 *
 * 放置位置（expo prebuild 生成 android/ 后）：
 *   android/app/src/main/java/com/dsh/taskorchestrator/AutomationAccessibilityService.kt
 *
 * 功能（最小可验证）：
 * - 作为无障碍服务被系统回调；
 * - onServiceConnected 后即可通过 dispatchGesture 注入手势（R5 判定标准第 3 条）；
 * - 读屏通过 rootInActiveWindow 遍历 AccessibilityNodeInfo 树（仅本地、不落盘、不外发）。
 *
 * 注意：此文件为 R5 验证用最小实现，完整 G3 四类原语（定位/手势/输入/读屏）
 * 在阶段 2 由工部正式实现。
 */

package com.dsh.taskorchestrator

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class AutomationAccessibilityService : AccessibilityService() {

    override fun onServiceConnected() {
        super.onServiceConnected()
        // 声明本服务的能力：读屏（retrieveWindowContent）+ 手势（canPerformGestures）
        serviceInfo = serviceInfo.apply {
            flags = flags or AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
            capabilityNames = listOf(
                "android.accessibilityservice.AccessibilityServiceInfo.capabilityCanPerformGestures",
            )
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // 最小实现：暂不处理事件，阶段 2 实现完整引擎
    }

    override fun onInterrupt() {
        // 服务中断时的清理
    }

    /**
     * R5 验证：dispatchGesture 点击注入一例（判定标准第 3 条）
     * 真机验证时通过无障碍服务执行一次坐标点击。
     */
    fun performTap(x: Float, y: Float): Boolean {
        val path = Path().apply { moveTo(x, y) }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 100))
            .build()
        return dispatchGesture(gesture, null, null)
    }

    /**
     * 读屏：抓取当前窗口根节点文本（仅本地，即时丢弃，不落盘不外发）
     */
    fun dumpActiveWindowText(): String {
        val root = rootInActiveWindow ?: return ""
        val sb = StringBuilder()
        collectText(root, sb)
        return sb.toString()
    }

    private fun collectText(node: AccessibilityNodeInfo, sb: StringBuilder) {
        if (!node.text.isNullOrEmpty()) {
            sb.append(node.text).append('\n')
        }
        for (i in 0 until node.childCount) {
            node.getChild(i)?.let { collectText(it, sb) }
        }
    }
}
