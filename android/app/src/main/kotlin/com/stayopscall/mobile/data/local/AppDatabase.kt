package com.stayopscall.mobile.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.stayopscall.mobile.data.local.dao.AppSettingDao
import com.stayopscall.mobile.data.local.dao.CallLogOutboxDao
import com.stayopscall.mobile.data.local.dao.CallRecordingDao
import com.stayopscall.mobile.data.local.dao.DeviceDao
import com.stayopscall.mobile.data.local.entity.AppSettingEntity
import com.stayopscall.mobile.data.local.entity.CallLogOutboxEntity
import com.stayopscall.mobile.data.local.entity.CallRecordingEntity
import com.stayopscall.mobile.data.local.entity.DeviceRegistrationEntity

@Database(
    entities = [
        CallRecordingEntity::class,
        DeviceRegistrationEntity::class,
        AppSettingEntity::class,
        CallLogOutboxEntity::class,
    ],
    version = 7,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun callRecordingDao(): CallRecordingDao
    abstract fun deviceDao(): DeviceDao
    abstract fun appSettingDao(): AppSettingDao
    abstract fun callLogOutboxDao(): CallLogOutboxDao

    companion object {
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE UNIQUE INDEX IF NOT EXISTS index_call_recordings_fileUri ON call_recordings (fileUri)"
                )
            }
        }

        // sha256 NOT NULL → NULL 허용으로 변경 (스캔 시 파일 읽기 없이 insert 가능)
        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `call_recordings_new` (
                        `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                        `fileName` TEXT NOT NULL,
                        `fileUri` TEXT NOT NULL,
                        `fileSize` INTEGER NOT NULL,
                        `lastModifiedAt` INTEGER NOT NULL,
                        `sha256` TEXT,
                        `status` TEXT NOT NULL,
                        `retryCount` INTEGER NOT NULL DEFAULT 0,
                        `remoteCallId` TEXT,
                        `remoteStatus` TEXT,
                        `errorMessage` TEXT,
                        `createdAt` INTEGER NOT NULL,
                        `updatedAt` INTEGER NOT NULL
                    )
                """.trimIndent())
                db.execSQL("INSERT INTO `call_recordings_new` SELECT * FROM `call_recordings`")
                db.execSQL("DROP TABLE `call_recordings`")
                db.execSQL("ALTER TABLE `call_recordings_new` RENAME TO `call_recordings`")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_call_recordings_fileUri` ON `call_recordings` (`fileUri`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_call_recordings_sha256` ON `call_recordings` (`sha256`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_call_recordings_status` ON `call_recordings` (`status`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_call_recordings_createdAt` ON `call_recordings` (`createdAt`)")
            }
        }

        val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `call_recordings` ADD COLUMN `phoneNumber` TEXT")
                db.execSQL("ALTER TABLE `call_recordings` ADD COLUMN `normalizedPhone` TEXT")
                db.execSQL("ALTER TABLE `call_recordings` ADD COLUMN `direction` TEXT")
                db.execSQL("ALTER TABLE `call_recordings` ADD COLUMN `contactName` TEXT")
                db.execSQL("ALTER TABLE `call_recordings` ADD COLUMN `recordedAtFromFilename` INTEGER")
                db.execSQL("ALTER TABLE `call_recordings` ADD COLUMN `callLogMatchedAt` INTEGER")
                db.execSQL("ALTER TABLE `call_recordings` ADD COLUMN `callLogMatchDeltaSec` INTEGER")
            }
        }

        // CallLog.Calls.DURATION(초) 보존 — 업로드 시 multipart duration_sec 로 전송한다.
        // 기존 행은 NULL 유지(과거 통화는 CallLog 재조회가 불가하므로 소급하지 않는다).
        val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `call_recordings` ADD COLUMN `durationSec` INTEGER")
            }
        }

        val MIGRATION_5_6 = object : Migration(5, 6) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `call_log_outbox` (
                        `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                        `androidCallLogId` INTEGER NOT NULL,
                        `sourceEventId` TEXT NOT NULL,
                        `phoneNumber` TEXT NOT NULL,
                        `contactName` TEXT,
                        `direction` TEXT NOT NULL,
                        `startedAtMs` INTEGER NOT NULL,
                        `endedAtMs` INTEGER NOT NULL,
                        `durationSeconds` INTEGER NOT NULL,
                        `eventType` TEXT NOT NULL,
                        `status` TEXT NOT NULL,
                        `attemptCount` INTEGER NOT NULL,
                        `lastAttemptAt` INTEGER,
                        `lastError` TEXT,
                        `createdAt` INTEGER NOT NULL,
                        `updatedAt` INTEGER NOT NULL,
                        `ackedAt` INTEGER
                    )
                    """.trimIndent(),
                )
                db.execSQL(
                    "CREATE UNIQUE INDEX IF NOT EXISTS `index_call_log_outbox_androidCallLogId` " +
                        "ON `call_log_outbox` (`androidCallLogId`)",
                )
                db.execSQL(
                    "CREATE INDEX IF NOT EXISTS `index_call_log_outbox_status` ON `call_log_outbox` (`status`)",
                )
                db.execSQL(
                    "CREATE INDEX IF NOT EXISTS `index_call_log_outbox_startedAtMs` " +
                        "ON `call_log_outbox` (`startedAtMs`)",
                )
                db.execSQL(
                    "CREATE INDEX IF NOT EXISTS `index_call_log_outbox_sourceEventId` " +
                        "ON `call_log_outbox` (`sourceEventId`)",
                )
            }
        }

        /**
         * Backoff column + status rename.
         * Does NOT requeue historical `failed_upload` rows (CALL-RELIABILITY-03 recovery track).
         */
        val MIGRATION_6_7 = object : Migration(6, 7) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "ALTER TABLE `call_log_outbox` ADD COLUMN `nextAttemptAt` INTEGER NOT NULL DEFAULT 0",
                )
                db.execSQL(
                    "ALTER TABLE `call_recordings` ADD COLUMN `nextAttemptAt` INTEGER NOT NULL DEFAULT 0",
                )
                db.execSQL(
                    "UPDATE `call_log_outbox` SET status = 'RETRYABLE' WHERE status = 'FAILED_RETRYABLE'",
                )
                db.execSQL(
                    "UPDATE `call_recordings` SET status = 'retryable' WHERE status = 'retry_pending'",
                )
            }
        }

        val ALL_MIGRATIONS: Array<Migration> = arrayOf(
            MIGRATION_1_2,
            MIGRATION_2_3,
            MIGRATION_3_4,
            MIGRATION_4_5,
            MIGRATION_5_6,
            MIGRATION_6_7,
        )
    }
}
