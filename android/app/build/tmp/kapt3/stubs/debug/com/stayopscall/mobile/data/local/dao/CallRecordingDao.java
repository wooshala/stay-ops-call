package com.stayopscall.mobile.data.local.dao;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import androidx.room.Update;
import com.stayopscall.mobile.data.local.entity.CallRecordingEntity;
import kotlinx.coroutines.flow.Flow;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000:\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\b\n\u0002\b\u0003\n\u0002\u0010\t\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010 \n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0002\n\u0000\bg\u0018\u00002\u00020\u0001J\u000e\u0010\u0002\u001a\u00020\u0003H\u00a7@\u00a2\u0006\u0002\u0010\u0004J\u000e\u0010\u0005\u001a\u00020\u0003H\u00a7@\u00a2\u0006\u0002\u0010\u0004J\u0016\u0010\u0006\u001a\u00020\u00072\u0006\u0010\b\u001a\u00020\tH\u00a7@\u00a2\u0006\u0002\u0010\nJ,\u0010\u000b\u001a\b\u0012\u0004\u0012\u00020\t0\f2\f\u0010\r\u001a\b\u0012\u0004\u0012\u00020\u000e0\f2\b\b\u0002\u0010\u000f\u001a\u00020\u0003H\u00a7@\u00a2\u0006\u0002\u0010\u0010J\u001e\u0010\u0011\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\t0\f0\u00122\b\b\u0002\u0010\u000f\u001a\u00020\u0003H\'J\u0016\u0010\u0013\u001a\u00020\u00142\u0006\u0010\b\u001a\u00020\tH\u00a7@\u00a2\u0006\u0002\u0010\n\u00a8\u0006\u0015"}, d2 = {"Lcom/stayopscall/mobile/data/local/dao/CallRecordingDao;", "", "countAll", "", "(Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "deleteAll", "insert", "", "recording", "Lcom/stayopscall/mobile/data/local/entity/CallRecordingEntity;", "(Lcom/stayopscall/mobile/data/local/entity/CallRecordingEntity;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "loadByStatuses", "", "statuses", "", "limit", "(Ljava/util/List;ILkotlin/coroutines/Continuation;)Ljava/lang/Object;", "observeRecent", "Lkotlinx/coroutines/flow/Flow;", "update", "", "app_debug"})
@androidx.room.Dao()
public abstract interface CallRecordingDao {
    
    @androidx.room.Insert(onConflict = 5)
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object insert(@org.jetbrains.annotations.NotNull()
    com.stayopscall.mobile.data.local.entity.CallRecordingEntity recording, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super java.lang.Long> $completion);
    
    @androidx.room.Update()
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object update(@org.jetbrains.annotations.NotNull()
    com.stayopscall.mobile.data.local.entity.CallRecordingEntity recording, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super kotlin.Unit> $completion);
    
    @androidx.room.Query(value = "SELECT * FROM call_recordings ORDER BY createdAt DESC LIMIT :limit")
    @org.jetbrains.annotations.NotNull()
    public abstract kotlinx.coroutines.flow.Flow<java.util.List<com.stayopscall.mobile.data.local.entity.CallRecordingEntity>> observeRecent(int limit);
    
    @androidx.room.Query(value = "SELECT * FROM call_recordings WHERE status IN (:statuses) ORDER BY createdAt ASC LIMIT :limit")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object loadByStatuses(@org.jetbrains.annotations.NotNull()
    java.util.List<java.lang.String> statuses, int limit, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super java.util.List<com.stayopscall.mobile.data.local.entity.CallRecordingEntity>> $completion);
    
    @androidx.room.Query(value = "SELECT COUNT(*) FROM call_recordings")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object countAll(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super java.lang.Integer> $completion);
    
    @androidx.room.Query(value = "DELETE FROM call_recordings")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object deleteAll(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super java.lang.Integer> $completion);
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 3, xi = 48)
    public static final class DefaultImpls {
    }
}