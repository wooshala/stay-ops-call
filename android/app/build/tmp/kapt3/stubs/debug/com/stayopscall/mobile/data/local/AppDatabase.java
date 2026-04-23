package com.stayopscall.mobile.data.local;

import androidx.room.Database;
import androidx.room.RoomDatabase;
import androidx.sqlite.db.SupportSQLiteDatabase;
import com.stayopscall.mobile.data.local.dao.AppSettingDao;
import com.stayopscall.mobile.data.local.dao.CallRecordingDao;
import com.stayopscall.mobile.data.local.dao.DeviceDao;
import com.stayopscall.mobile.data.local.entity.AppSettingEntity;
import com.stayopscall.mobile.data.local.entity.CallRecordingEntity;
import com.stayopscall.mobile.data.local.entity.DeviceRegistrationEntity;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000 \n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\b\'\u0018\u0000 \t2\u00020\u0001:\u0001\tB\u0005\u00a2\u0006\u0002\u0010\u0002J\b\u0010\u0003\u001a\u00020\u0004H&J\b\u0010\u0005\u001a\u00020\u0006H&J\b\u0010\u0007\u001a\u00020\bH&\u00a8\u0006\n"}, d2 = {"Lcom/stayopscall/mobile/data/local/AppDatabase;", "Landroidx/room/RoomDatabase;", "()V", "appSettingDao", "Lcom/stayopscall/mobile/data/local/dao/AppSettingDao;", "callRecordingDao", "Lcom/stayopscall/mobile/data/local/dao/CallRecordingDao;", "deviceDao", "Lcom/stayopscall/mobile/data/local/dao/DeviceDao;", "Companion", "app_debug"})
@androidx.room.Database(entities = {com.stayopscall.mobile.data.local.entity.CallRecordingEntity.class, com.stayopscall.mobile.data.local.entity.DeviceRegistrationEntity.class, com.stayopscall.mobile.data.local.entity.AppSettingEntity.class}, version = 3, exportSchema = false)
public abstract class AppDatabase extends androidx.room.RoomDatabase {
    @org.jetbrains.annotations.NotNull()
    private static final androidx.room.migration.Migration MIGRATION_1_2 = null;
    @org.jetbrains.annotations.NotNull()
    private static final androidx.room.migration.Migration MIGRATION_2_3 = null;
    @org.jetbrains.annotations.NotNull()
    public static final com.stayopscall.mobile.data.local.AppDatabase.Companion Companion = null;
    
    public AppDatabase() {
        super();
    }
    
    @org.jetbrains.annotations.NotNull()
    public abstract com.stayopscall.mobile.data.local.dao.CallRecordingDao callRecordingDao();
    
    @org.jetbrains.annotations.NotNull()
    public abstract com.stayopscall.mobile.data.local.dao.DeviceDao deviceDao();
    
    @org.jetbrains.annotations.NotNull()
    public abstract com.stayopscall.mobile.data.local.dao.AppSettingDao appSettingDao();
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\u0014\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0005\b\u0086\u0003\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002R\u0011\u0010\u0003\u001a\u00020\u0004\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0005\u0010\u0006R\u0011\u0010\u0007\u001a\u00020\u0004\u00a2\u0006\b\n\u0000\u001a\u0004\b\b\u0010\u0006\u00a8\u0006\t"}, d2 = {"Lcom/stayopscall/mobile/data/local/AppDatabase$Companion;", "", "()V", "MIGRATION_1_2", "Landroidx/room/migration/Migration;", "getMIGRATION_1_2", "()Landroidx/room/migration/Migration;", "MIGRATION_2_3", "getMIGRATION_2_3", "app_debug"})
    public static final class Companion {
        
        private Companion() {
            super();
        }
        
        @org.jetbrains.annotations.NotNull()
        public final androidx.room.migration.Migration getMIGRATION_1_2() {
            return null;
        }
        
        @org.jetbrains.annotations.NotNull()
        public final androidx.room.migration.Migration getMIGRATION_2_3() {
            return null;
        }
    }
}