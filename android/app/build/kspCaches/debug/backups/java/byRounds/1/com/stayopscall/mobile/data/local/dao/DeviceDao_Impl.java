package com.stayopscall.mobile.data.local.dao;

import android.database.Cursor;
import android.os.CancellationSignal;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.room.CoroutinesRoom;
import androidx.room.EntityInsertionAdapter;
import androidx.room.RoomDatabase;
import androidx.room.RoomSQLiteQuery;
import androidx.room.util.CursorUtil;
import androidx.room.util.DBUtil;
import androidx.sqlite.db.SupportSQLiteStatement;
import com.stayopscall.mobile.data.local.entity.DeviceRegistrationEntity;
import java.lang.Class;
import java.lang.Exception;
import java.lang.Long;
import java.lang.Object;
import java.lang.Override;
import java.lang.String;
import java.lang.SuppressWarnings;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Callable;
import javax.annotation.processing.Generated;
import kotlin.Unit;
import kotlin.coroutines.Continuation;

@Generated("androidx.room.RoomProcessor")
@SuppressWarnings({"unchecked", "deprecation"})
public final class DeviceDao_Impl implements DeviceDao {
  private final RoomDatabase __db;

  private final EntityInsertionAdapter<DeviceRegistrationEntity> __insertionAdapterOfDeviceRegistrationEntity;

  public DeviceDao_Impl(@NonNull final RoomDatabase __db) {
    this.__db = __db;
    this.__insertionAdapterOfDeviceRegistrationEntity = new EntityInsertionAdapter<DeviceRegistrationEntity>(__db) {
      @Override
      @NonNull
      protected String createQuery() {
        return "INSERT OR REPLACE INTO `device_registration` (`deviceUuid`,`androidId`,`model`,`osVersion`,`registeredAt`,`accessToken`,`refreshToken`) VALUES (?,?,?,?,?,?,?)";
      }

      @Override
      protected void bind(@NonNull final SupportSQLiteStatement statement,
          @NonNull final DeviceRegistrationEntity entity) {
        statement.bindString(1, entity.getDeviceUuid());
        if (entity.getAndroidId() == null) {
          statement.bindNull(2);
        } else {
          statement.bindString(2, entity.getAndroidId());
        }
        statement.bindString(3, entity.getModel());
        statement.bindString(4, entity.getOsVersion());
        if (entity.getRegisteredAt() == null) {
          statement.bindNull(5);
        } else {
          statement.bindLong(5, entity.getRegisteredAt());
        }
        if (entity.getAccessToken() == null) {
          statement.bindNull(6);
        } else {
          statement.bindString(6, entity.getAccessToken());
        }
        if (entity.getRefreshToken() == null) {
          statement.bindNull(7);
        } else {
          statement.bindString(7, entity.getRefreshToken());
        }
      }
    };
  }

  @Override
  public Object upsert(final DeviceRegistrationEntity device,
      final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        __db.beginTransaction();
        try {
          __insertionAdapterOfDeviceRegistrationEntity.insert(device);
          __db.setTransactionSuccessful();
          return Unit.INSTANCE;
        } finally {
          __db.endTransaction();
        }
      }
    }, $completion);
  }

  @Override
  public Object get(final Continuation<? super DeviceRegistrationEntity> $completion) {
    final String _sql = "SELECT * FROM device_registration LIMIT 1";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 0);
    final CancellationSignal _cancellationSignal = DBUtil.createCancellationSignal();
    return CoroutinesRoom.execute(__db, false, _cancellationSignal, new Callable<DeviceRegistrationEntity>() {
      @Override
      @Nullable
      public DeviceRegistrationEntity call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfDeviceUuid = CursorUtil.getColumnIndexOrThrow(_cursor, "deviceUuid");
          final int _cursorIndexOfAndroidId = CursorUtil.getColumnIndexOrThrow(_cursor, "androidId");
          final int _cursorIndexOfModel = CursorUtil.getColumnIndexOrThrow(_cursor, "model");
          final int _cursorIndexOfOsVersion = CursorUtil.getColumnIndexOrThrow(_cursor, "osVersion");
          final int _cursorIndexOfRegisteredAt = CursorUtil.getColumnIndexOrThrow(_cursor, "registeredAt");
          final int _cursorIndexOfAccessToken = CursorUtil.getColumnIndexOrThrow(_cursor, "accessToken");
          final int _cursorIndexOfRefreshToken = CursorUtil.getColumnIndexOrThrow(_cursor, "refreshToken");
          final DeviceRegistrationEntity _result;
          if (_cursor.moveToFirst()) {
            final String _tmpDeviceUuid;
            _tmpDeviceUuid = _cursor.getString(_cursorIndexOfDeviceUuid);
            final String _tmpAndroidId;
            if (_cursor.isNull(_cursorIndexOfAndroidId)) {
              _tmpAndroidId = null;
            } else {
              _tmpAndroidId = _cursor.getString(_cursorIndexOfAndroidId);
            }
            final String _tmpModel;
            _tmpModel = _cursor.getString(_cursorIndexOfModel);
            final String _tmpOsVersion;
            _tmpOsVersion = _cursor.getString(_cursorIndexOfOsVersion);
            final Long _tmpRegisteredAt;
            if (_cursor.isNull(_cursorIndexOfRegisteredAt)) {
              _tmpRegisteredAt = null;
            } else {
              _tmpRegisteredAt = _cursor.getLong(_cursorIndexOfRegisteredAt);
            }
            final String _tmpAccessToken;
            if (_cursor.isNull(_cursorIndexOfAccessToken)) {
              _tmpAccessToken = null;
            } else {
              _tmpAccessToken = _cursor.getString(_cursorIndexOfAccessToken);
            }
            final String _tmpRefreshToken;
            if (_cursor.isNull(_cursorIndexOfRefreshToken)) {
              _tmpRefreshToken = null;
            } else {
              _tmpRefreshToken = _cursor.getString(_cursorIndexOfRefreshToken);
            }
            _result = new DeviceRegistrationEntity(_tmpDeviceUuid,_tmpAndroidId,_tmpModel,_tmpOsVersion,_tmpRegisteredAt,_tmpAccessToken,_tmpRefreshToken);
          } else {
            _result = null;
          }
          return _result;
        } finally {
          _cursor.close();
          _statement.release();
        }
      }
    }, $completion);
  }

  @NonNull
  public static List<Class<?>> getRequiredConverters() {
    return Collections.emptyList();
  }
}
