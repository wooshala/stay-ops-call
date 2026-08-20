package com.stayopscall.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.stayopscall.mobile.data.local.entity.CallLogOutboxEntity

@Dao
interface CallLogOutboxDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertIgnore(entity: CallLogOutboxEntity): Long

    @Update
    suspend fun update(entity: CallLogOutboxEntity)

    @Query("SELECT * FROM call_log_outbox WHERE androidCallLogId = :callLogId LIMIT 1")
    suspend fun findByCallLogId(callLogId: Long): CallLogOutboxEntity?

    @Query(
        """
        SELECT * FROM call_log_outbox
        WHERE status IN (:statuses)
        ORDER BY startedAtMs ASC, androidCallLogId ASC
        LIMIT :limit
        """,
    )
    suspend fun loadByStatuses(statuses: List<String>, limit: Int): List<CallLogOutboxEntity>

    @Query(
        """
        SELECT * FROM call_log_outbox
        WHERE status IN (:statuses)
          AND nextAttemptAt <= :nowMs
        ORDER BY startedAtMs ASC, androidCallLogId ASC
        LIMIT :limit
        """,
    )
    suspend fun loadDue(statuses: List<String>, nowMs: Long, limit: Int): List<CallLogOutboxEntity>

    @Query(
        """
        SELECT COUNT(*) FROM call_log_outbox
        WHERE status IN (:statuses)
        """,
    )
    suspend fun countByStatuses(statuses: List<String>): Int

    @Query("SELECT COUNT(*) FROM call_log_outbox WHERE status = :status")
    suspend fun countByStatus(status: String): Int

    @Query(
        """
        SELECT COUNT(*) FROM call_log_outbox
        WHERE status IN (:statuses) AND lastAttemptAt IS NOT NULL AND lastAttemptAt >= :sinceMs
        """,
    )
    suspend fun countRecentAttempts(statuses: List<String>, sinceMs: Long): Int

    @Query(
        """
        SELECT MIN(createdAt) FROM call_log_outbox
        WHERE status IN (:statuses)
        """,
    )
    suspend fun oldestCreatedAt(statuses: List<String>): Long?

    @Query(
        """
        SELECT MIN(lastAttemptAt) FROM call_log_outbox
        WHERE status = :status AND lastAttemptAt IS NOT NULL
        """,
    )
    suspend fun oldestAttemptAt(status: String): Long?

    @Query(
        """
        UPDATE call_log_outbox
        SET status = :toStatus, updatedAt = :now, nextAttemptAt = 0
        WHERE status = :fromStatus AND (lastAttemptAt IS NULL OR lastAttemptAt < :staleBefore)
        """,
    )
    suspend fun requeueStaleSending(
        fromStatus: String,
        toStatus: String,
        staleBefore: Long,
        now: Long,
    ): Int
}
