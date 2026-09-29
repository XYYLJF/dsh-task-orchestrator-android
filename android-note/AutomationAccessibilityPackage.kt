package com.dsh.taskorchestrator

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * 注册 AutomationAccessibilityModule 的 ReactPackage（旧架构 newArchEnabled=false）。
 * 由 config plugin 在 prebuild 时注入 MainApplication.getPackages 注册。
 */
class AutomationAccessibilityPackage : ReactPackage {
    override fun createNativeModules(
        reactContext: ReactApplicationContext,
    ): List<NativeModule> = listOf(AutomationAccessibilityModule(reactContext))

    override fun createViewManagers(
        reactContext: ReactApplicationContext,
    ): List<ViewManager<*, *>> = emptyList()
}
