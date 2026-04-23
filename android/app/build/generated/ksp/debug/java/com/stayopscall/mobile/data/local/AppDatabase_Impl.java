package com.stayopscall.mobile.data.local;

import androidx.annotation.NonNull;
import androidx.room.DatabaseConfiguration;
import androidx.room.InvalidationTracker;
import androidx.room.RoomDatabase;
import androidx.room.RoomOpenHelper;
import androidx.room.migration.AutoMigrationSpec;
import androidx.room.migration.Migration;
import androidx.room.util.DBUtil;
import androidx.room.util.TableInfo;
import androidx.sqlite.db.SupportSQLiteDatabase;
import androidx.sqlite.db.SupportSQLiteOpenHelper;
import com.stayopscall.mobile.data.local.dao.AppSettingDao;
import com.stayopscall.mobile.data.local.dao.AppSettingDao_Impl;
import com.stayopscall.mobile.data.local.dao.CallRecordingDao;
import com.stayopscall.mobile.data.local.dao.CallRecordingDao_Impl;
import com.stayopscall.mobile.data.local.dao.DeviceDao;
import com.stayopscall.mobile.data.local.dao.DeviceDao_Impl;
import java.lang.Class;
import java.lang.Override;
import java.lang.String;
import java.lang.SuppressWarnings;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.annotation.processing.Generated;

@Generated("androidx.room.RoomProcessor")
@SuppressWarnings({"unchecked", "deprecation"})
public final class AppDatabase_Impl extends AppDatabase {
  private volatile CallRecordingDao _callRecordingDao;

  private volatile DeviceDao _deviceDao;

  private volatile AppSettingDao _appSettingDao;

  @Override
  @NonNull
  protected SupportSQLiteOpenHelper createOpenHelper(@NonNull final DatabaseConfiguration config) {
    final SupportSQLiteOpenHelper.Callback _openCallback = new RoomOpenHelper(config, new RoomOpenHelper.Delegate(3) {
      @Override
      public void createAllTables(@NonNull final SupportSQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS `call_recordings` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, `fileName` TEXT NOT NULL, `fileUri` TEXT NOT NULL, `fileSize` INTEGER NOT NULL, `lastModifiedAt` INTEGER NOT NULL, `sha256` TEXT, `status` TEXT NOT NULL, `retryCount` INTEGER NOT NULL, `remoteCallId` TEXT, `remoteStatus` TEXT, `errorMessage` TEXT, `createdAt` INTEGER NOT NULL, `updatedAt` INTEGER NOT NULL)");
        db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_call_recordings_fileUri` ON `call_recordings` (`fileUri`)");
        db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_call_recordings_sha256` ON `call_recordings` (`sha256`)");
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_call_recordings_status` ON `call_recordings` (`status`)");
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_call_recordings_createdAt` ON `call_recordings` (`createdAt`)");
        db.execSQL("CREATE TABLE IF NOT EXISTS `device_registration` (`deviceUuid` TEXT NOT NULL, `androidId` TEXT, `model` TEXT NOT NULL, `osVersion` TEXT NOT NULL, `registeredAt` INTEGER, `accessToken` TEXT, `refreshToken` TEXT, PRIMARY KEY(`deviceUuid`))");
        db.execSQL("CREATE TABLE IF NOT EXISTS `app_settings` (`key` TEXT NOT NULL, `value` TEXT NOT NULL, `updatedAt` INTEGER NOT NULL, PRIMARY KEY(`key`))");
        db.execSQL("CREATE TABLE IF NOT EXISTS room_master_table (id INTEGER PRIMARY KEY,identity_hash TEXT)");
        db.execSQL("INSERT OR REPLACE INTO room_master_table (id,identity_hash) VALUES(42, '369482c09837c9cddfec6184cc83913d')");
      }

      @Override
      public void dropAllTables(@NonNull final SupportSQLiteDatabase db) {
        db.execSQL("DROP TABLE IF EXISTS `call_recordings`");
        db.execSQL("DROP TABLE IF EXISTS `device_registration`");
        db.execSQL("DROP TABLE IF EXISTS `app_settings`");
        final List<? extends RoomDatabase.Callback> _callbacks = mCallbacks;
        if (_callbacks != null) {
          for (RoomDatabase.Callback _callback : _callbacks) {
            _callback.onDestructiveMigration(db);
          }
        }
      }

      @Override
      public void onCreate(@NonNull final SupportSQLiteDatabase db) {
        final List<? extends RoomDatabase.Callback> _callbacks = mCallbacks;
        if (_callbacks != null) {
          for (RoomDatabase.Callback _callback : _callbacks) {
            _callback.onCreate(db);
          }
        }
      }

      @Override
      public void onOpen(@NonNull final SupportSQLiteDatabase db) {
        mDatabase = db;
        internalInitInvalidationTracker(db);
        final List<? extends RoomDatabase.Callback> _callbacks = mCallbacks;
        if (_callbacks != null) {
          for (RoomDatabase.Callback _callback : _callbacks) {
            _callback.onOpen(db);
          }
        }
      }

      @Override
      public void onPreMigrate(@NonNull final SupportSQLiteDatabase db) {
        DBUtil.dropFtsSyncTriggers(db);
      }

      @Override
      public void onPostMigrate(@NonNull final SupportSQLiteDatabase db) {
      }

      @Override
      @NonNull
      public RoomOpenHelper.ValidationResult onValidateSchema(
          @NonNull final SupportSQLiteDatabase db) {
        final HashMap<String, TableInfo.Column> _columnsCallRecordings = new HashMap<String, TableInfo.Column>(13);
        _columnsCallRecordings.put("id", new TableInfo.Column("id", "INTEGER", true, 1, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCallRecordings.put("fileName", new TableInfo.Column("fileName", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCallRecordings.put("fileUri", new TableInfo.Column("fileUri", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCallRecordings.put("fileSize", new TableInfo.Column("fileSize", "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCallRecordings.put("lastModifiedAt", new TableInfo.Column("lastModifiedAt", "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCallRecordings.put("sha256", new TableInfo.Column("sha256", "TEXT", false, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCallRecordings.put("status", new TableInfo.Column("status", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCallRecordings.put("retryCount", new TableInfo.Column("retryCount", "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCallRecordings.put("remoteCallId", new TableInfo.Column("remoteCallId", "TEXT", false, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCallRecordings.put("remoteStatus", new TableInfo.Column("remoteStatus", "TEXT", false, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCallRecordings.put("errorMessage", new TableInfo.Column("errorMessage", "TEXT", false, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCallRecordings.put("createdAt", new TableInfo.Column("createdAt", "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCallRecordings.put("updatedAt", new TableInfo.Column("updatedAt", "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        final HashSet<TableInfo.ForeignKey> _foreignKeysCallRecordings = new HashSet<TableInfo.ForeignKey>(0);
        final HashSet<TableInfo.Index> _indicesCallRecordings = new HashSet<TableInfo.Index>(4);
        _indicesCallRecordings.add(new TableInfo.Index("index_call_recordings_fileUri", true, Arrays.asList("fileUri"), Arrays.asList("ASC")));
        _indicesCallRecordings.add(new TableInfo.Index("index_call_recordings_sha256", true, Arrays.asList("sha256"), Arrays.asList("ASC")));
        _indicesCallRecordings.add(new TableInfo.Index("index_call_recordings_status", false, Arrays.asList("status"), Arrays.asList("ASC")));
        _indicesCallRecordings.add(new TableInfo.Index("index_call_recordings_createdAt", false, Arrays.asList("createdAt"), Arrays.asList("ASC")));
        final TableInfo _infoCallRecordings = new TableInfo("call_recordings", _columnsCallRecordings, _foreignKeysCallRecordings, _indicesCallRecordings);
        final TableInfo _existingCallRecordings = TableInfo.read(db, "call_recordings");
        if (!_infoCallRecordings.equals(_existingCallRecordings)) {
          return new RoomOpenHelper.ValidationResult(false, "call_recordings(com.stayopscall.mobile.data.local.entity.CallRecordingEntity).\n"
                  + " Expected:\n" + _infoCallRecordings + "\n"
                  + " Found:\n" + _existingCallRecordings);
        }
        final HashMap<String, TableInfo.Column> _columnsDeviceRegistration = new HashMap<String, TableInfo.Column>(7);
        _columnsDeviceRegistration.put("deviceUuid", new TableInfo.Column("deviceUuid", "TEXT", true, 1, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsDeviceRegistration.put("androidId", new TableInfo.Column("androidId", "TEXT", false, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsDeviceRegistration.put("model", new TableInfo.Column("model", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsDeviceRegistration.put("osVersion", new TableInfo.Column("osVersion", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsDeviceRegistration.put("registeredAt", new TableInfo.Column("registeredAt", "INTEGER", false, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsDeviceRegistration.put("accessToken", new TableInfo.Column("accessToken", "TEXT", false, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsDeviceRegistration.put("refreshToken", new TableInfo.Column("refreshToken", "TEXT", false, 0, null, TableInfo.CREATED_FROM_ENTITY));
        final HashSet<TableInfo.ForeignKey> _foreignKeysDeviceRegistration = new HashSet<TableInfo.ForeignKey>(0);
        final HashSet<TableInfo.Index> _indicesDeviceRegistration = new HashSet<TableInfo.Index>(0);
        final TableInfo _infoDeviceRegistration = new TableInfo("device_registration", _columnsDeviceRegistration, _foreignKeysDeviceRegistration, _indicesDeviceRegistration);
        final TableInfo _existingDeviceRegistration = TableInfo.read(db, "device_registration");
        if (!_infoDeviceRegistration.equals(_existingDeviceRegistration)) {
          return new RoomOpenHelper.ValidationResult(false, "device_registration(com.stayopscall.mobile.data.local.entity.DeviceRegistrationEntity).\n"
                  + " Expected:\n" + _infoDeviceRegistration + "\n"
                  + " Found:\n" + _existingDeviceRegistration);
        }
        final HashMap<String, TableInfo.Column> _columnsAppSettings = new HashMap<String, TableInfo.Column>(3);
        _columnsAppSettings.put("key", new TableInfo.Column("key", "TEXT", true, 1, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsAppSettings.put("value", new TableInfo.Column("value", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsAppSettings.put("updatedAt", new TableInfo.Column("updatedAt", "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        final HashSet<TableInfo.ForeignKey> _foreignKeysAppSettings = new HashSet<TableInfo.ForeignKey>(0);
        final HashSet<TableInfo.Index> _indicesAppSettings = new HashSet<TableInfo.Index>(0);
        final TableInfo _infoAppSettings = new TableInfo("app_settings", _columnsAppSettings, _foreignKeysAppSettings, _indicesAppSettings);
        final TableInfo _existingAppSettings = TableInfo.read(db, "app_settings");
        if (!_infoAppSettings.equals(_existingAppSettings)) {
          return new RoomOpenHelper.ValidationResult(false, "app_settings(com.stayopscall.mobile.data.local.entity.AppSettingEntity).\n"
                  + " Expected:\n" + _infoAppSettings + "\n"
                  + " Found:\n" + _existingAppSettings);
        }
        return new RoomOpenHelper.ValidationResult(true, null);
      }
    }, "369482c09837c9cddfec6184cc83913d", "d09e26bd7ecdfcf54085e54ca3964295");
    final SupportSQLiteOpenHelper.Configuration _sqliteConfig = SupportSQLiteOpenHelper.Configuration.builder(config.context).name(config.name).callback(_openCallback).build();
    final SupportSQLiteOpenHelper _helper = config.sqliteOpenHelperFactory.create(_sqliteConfig);
    return _helper;
  }

  @Override
  @NonNull
  protected InvalidationTracker createInvalidationTracker() {
    final HashMap<String, String> _shadowTablesMap = new HashMap<String, String>(0);
    final HashMap<String, Set<String>> _viewTables = new HashMap<String, Set<String>>(0);
    return new InvalidationTracker(this, _shadowTablesMap, _viewTables, "call_recordings","device_registration","app_settings");
  }

  @Override
  public void clearAllTables() {
    super.assertNotMainThread();
    final SupportSQLiteDatabase _db = super.getOpenHelper().getWritableDatabase();
    try {
      super.beginTransaction();
      _db.execSQL("DELETE FROM `call_recordings`");
      _db.execSQL("DELETE FROM `device_registration`");
      _db.execSQL("DELETE FROM `app_settings`");
      super.setTransactionSuccessful();
    } finally {
      super.endTransaction();
      _db.query("PRAGMA wal_checkpoint(FULL)").close();
      if (!_db.inTransaction()) {
        _db.execSQL("VACUUM");
      }
    }
  }

  @Override
  @NonNull
  protected Map<Class<?>, List<Class<?>>> getRequiredTypeConverters() {
    final HashMap<Class<?>, List<Class<?>>> _typeConvertersMap = new HashMap<Class<?>, List<Class<?>>>();
    _typeConvertersMap.put(CallRecordingDao.class, CallRecordingDao_Impl.getRequiredConverters());
    _typeConvertersMap.put(DeviceDao.class, DeviceDao_Impl.getRequiredConverters());
    _typeConvertersMap.put(AppSettingDao.class, AppSettingDao_Impl.getRequiredConverters());
    return _typeConvertersMap;
  }

  @Override
  @NonNull
  public Set<Class<? extends AutoMigrationSpec>> getRequiredAutoMigrationSpecs() {
    final HashSet<Class<? extends AutoMigrationSpec>> _autoMigrationSpecsSet = new HashSet<Class<? extends AutoMigrationSpec>>();
    return _autoMigrationSpecsSet;
  }

  @Override
  @NonNull
  public List<Migration> getAutoMigrations(
      @NonNull final Map<Class<? extends AutoMigrationSpec>, AutoMigrationSpec> autoMigrationSpecs) {
    final List<Migration> _autoMigrations = new ArrayList<Migration>();
    return _autoMigrations;
  }

  @Override
  public CallRecordingDao callRecordingDao() {
    if (_callRecordingDao != null) {
      return _callRecordingDao;
    } else {
      synchronized(this) {
        if(_callRecordingDao == null) {
          _callRecordingDao = new CallRecordingDao_Impl(this);
        }
        return _callRecordingDao;
      }
    }
  }

  @Override
  public DeviceDao deviceDao() {
    if (_deviceDao != null) {
      return _deviceDao;
    } else {
      synchronized(this) {
        if(_deviceDao == null) {
          _deviceDao = new DeviceDao_Impl(this);
        }
        return _deviceDao;
      }
    }
  }

  @Override
  public AppSettingDao appSettingDao() {
    if (_appSettingDao != null) {
      return _appSettingDao;
    } else {
      synchronized(this) {
        if(_appSettingDao == null) {
          _appSettingDao = new AppSettingDao_Impl(this);
        }
        return _appSettingDao;
      }
    }
  }
}
