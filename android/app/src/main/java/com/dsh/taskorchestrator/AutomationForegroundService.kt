/**
 * 阶段4 前台服务保活 —— AutomationForegroundService
 *
 * 放置位置（由 config plugin 注入）：android/app/src/main/java/com/dsh/taskorchestrator/
 *
 * 职责：前台服务保活（常驻通知），防止无障碍服务 + App 进程被国产 ROM 后台回收。
 * 对应方案 G5、④-4 保活验收（实际执行任务中持续 ≥30 分钟不被回收）。
 *
 * 注意：需在 AndroidManifest 声明 FOREGROUND_SERVICE 权限（targetSdk 34 还需
 * foregroundServiceType），由 config plugin 阶段4 注入（刑部 P1 落地）。
 */

package com.dsh.taskorchestrator

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder

class AutomationForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "dsh_task_automation"
        const val NOTIFICATION_ID = 1001
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(
            NOTIFICATION_ID,
            buildNotification(),
        )
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "DSH 任务自动化",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "保持任务编排服务在后台运行"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("DSH 任务编排运行中")
            .setContentText("正在执行自动化任务")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .build()
    }
}
