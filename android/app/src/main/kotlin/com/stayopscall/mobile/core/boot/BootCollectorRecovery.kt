package com.stayopscall.mobile.core.boot

/**
 * Pure BOOT recovery plan. WorkManager is a trigger, not source of truth —
 * reboot must re-enqueue collectors even if the user never opens the app.
 */
object BootCollectorRecovery {
    enum class Action {
        SCHEDULE_PERIODIC_SYNC,
        SCHEDULE_HEARTBEAT,
        ENQUEUE_HEARTBEAT_NOW,
        START_CALLLOG_MONITOR,
        ENQUEUE_CALLLOG_DISCOVER,
        ENQUEUE_CALLLOG_RELAY,
        ENQUEUE_RECORDING_SCAN,
        ENQUEUE_RECORDING_UPLOAD,
    }

    fun actions(): List<Action> = Action.entries.toList()

    fun restoresWorkersWithoutForeground(): Boolean =
        actions().containsAll(
            listOf(
                Action.SCHEDULE_PERIODIC_SYNC,
                Action.SCHEDULE_HEARTBEAT,
                Action.ENQUEUE_CALLLOG_RELAY,
                Action.ENQUEUE_RECORDING_SCAN,
                Action.ENQUEUE_RECORDING_UPLOAD,
            ),
        )
}
