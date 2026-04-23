package com.stayopscall.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.stayopscall.mobile.data.local.entity.CallRecordingEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CallRecordingDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(recording: CallRecordingEntity): Long

    @Update
    suspend fun update(recording: CallRecordingEntity)

    @Query("SELECT * FROM call_recordings ORDER BY createdAt DESC LIMIT :limit")
    fun observeRecent(limit: Int = 50): Flow<List<CallRecordingEntity>>

    @Query("SELECT * FROM call_recordings WHERE status IN (:statuses) ORDER BY createdAt ASC LIMIT :limit")
    suspend fun loadByStatuses(statuses: List<String>, limit: Int = 30): List<CallRecordingEntity>

    @Query("SELECT COUNT(*) FROM call_recordings")
    suspend fun countAll(): Int

    @Query("DELETE FROM call_recordings")
    suspend fun deleteAll(): Int
}
