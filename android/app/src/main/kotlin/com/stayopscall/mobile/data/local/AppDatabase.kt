package com.stayopscall.mobile.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.stayopscall.mobile.data.local.dao.AppSettingDao
import com.stayopscall.mobile.data.local.dao.CallRecordingDao
import com.stayopscall.mobile.data.local.dao.DeviceDao
import com.stayopscall.mobile.data.local.entity.AppSettingEntity
import com.stayopscall.mobile.data.local.entity.CallRecordingEntity
import com.stayopscall.mobile.data.local.entity.DeviceRegistrationEntity

@Database(
    entities = [CallRecordingEntity::class, DeviceRegistrationEntity::class, AppSettingEntity::class],
    version = 3,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun callRecordingDao(): CallRecordingDao
    abstract fun deviceDao(): DeviceDao
    abstract fun appSettingDao(): AppSettingDao

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
    }
}
