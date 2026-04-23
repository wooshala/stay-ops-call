package com.stayopscall.mobile.data.local.dao;

import android.database.Cursor;
import android.os.CancellationSignal;
import androidx.annotation.NonNull;
import androidx.room.CoroutinesRoom;
import androidx.room.EntityDeletionOrUpdateAdapter;
import androidx.room.EntityInsertionAdapter;
import androidx.room.RoomDatabase;
import androidx.room.RoomSQLiteQuery;
import androidx.room.SharedSQLiteStatement;
import androidx.room.util.CursorUtil;
import androidx.room.util.DBUtil;
import androidx.room.util.StringUtil;
import androidx.sqlite.db.SupportSQLiteStatement;
import com.stayopscall.mobile.data.local.entity.CallRecordingEntity;
import java.lang.Class;
import java.lang.Exception;
import java.lang.Integer;
import java.lang.Long;
import java.lang.Object;
import java.lang.Override;
import java.lang.String;
import java.lang.StringBuilder;
import java.lang.SuppressWarnings;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Callable;
import javax.annotation.processing.Generated;
import kotlin.Unit;
import kotlin.coroutines.Continuation;
import kotlinx.coroutines.flow.Flow;

@Generated("androidx.room.RoomProcessor")
@SuppressWarnings({"unchecked", "deprecation"})
public final class CallRecordingDao_Impl implements CallRecordingDao {
  private final RoomDatabase __db;

  private final EntityInsertionAdapter<CallRecordingEntity> __insertionAdapterOfCallRecordingEntity;

  private final EntityDeletionOrUpdateAdapter<CallRecordingEntity> __updateAdapterOfCallRecordingEntity;

  private final SharedSQLiteStatement __preparedStmtOfDeleteAll;

  public CallRecordingDao_Impl(@NonNull final RoomDatabase __db) {
    this.__db = __db;
    this.__insertionAdapterOfCallRecordingEntity = new EntityInsertionAdapter<CallRecordingEntity>(__db) {
      @Override
      @NonNull
      protected String createQuery() {
        return "INSERT OR IGNORE INTO `call_recordings` (`id`,`fileName`,`fileUri`,`fileSize`,`lastModifiedAt`,`sha256`,`status`,`retryCount`,`remoteCallId`,`remoteStatus`,`errorMessage`,`createdAt`,`updatedAt`) VALUES (nullif(?, 0),?,?,?,?,?,?,?,?,?,?,?,?)";
      }

      @Override
      protected void bind(@NonNull final SupportSQLiteStatement statement,
          @NonNull final CallRecordingEntity entity) {
        statement.bindLong(1, entity.getId());
        statement.bindString(2, entity.getFileName());
        statement.bindString(3, entity.getFileUri());
        statement.bindLong(4, entity.getFileSize());
        statement.bindLong(5, entity.getLastModifiedAt());
        if (entity.getSha256() == null) {
          statement.bindNull(6);
        } else {
          statement.bindString(6, entity.getSha256());
        }
        statement.bindString(7, entity.getStatus());
        statement.bindLong(8, entity.getRetryCount());
        if (entity.getRemoteCallId() == null) {
          statement.bindNull(9);
        } else {
          statement.bindString(9, entity.getRemoteCallId());
        }
        if (entity.getRemoteStatus() == null) {
          statement.bindNull(10);
        } else {
          statement.bindString(10, entity.getRemoteStatus());
        }
        if (entity.getErrorMessage() == null) {
          statement.bindNull(11);
        } else {
          statement.bindString(11, entity.getErrorMessage());
        }
        statement.bindLong(12, entity.getCreatedAt());
        statement.bindLong(13, entity.getUpdatedAt());
      }
    };
    this.__updateAdapterOfCallRecordingEntity = new EntityDeletionOrUpdateAdapter<CallRecordingEntity>(__db) {
      @Override
      @NonNull
      protected String createQuery() {
        return "UPDATE OR ABORT `call_recordings` SET `id` = ?,`fileName` = ?,`fileUri` = ?,`fileSize` = ?,`lastModifiedAt` = ?,`sha256` = ?,`status` = ?,`retryCount` = ?,`remoteCallId` = ?,`remoteStatus` = ?,`errorMessage` = ?,`createdAt` = ?,`updatedAt` = ? WHERE `id` = ?";
      }

      @Override
      protected void bind(@NonNull final SupportSQLiteStatement statement,
          @NonNull final CallRecordingEntity entity) {
        statement.bindLong(1, entity.getId());
        statement.bindString(2, entity.getFileName());
        statement.bindString(3, entity.getFileUri());
        statement.bindLong(4, entity.getFileSize());
        statement.bindLong(5, entity.getLastModifiedAt());
        if (entity.getSha256() == null) {
          statement.bindNull(6);
        } else {
          statement.bindString(6, entity.getSha256());
        }
        statement.bindString(7, entity.getStatus());
        statement.bindLong(8, entity.getRetryCount());
        if (entity.getRemoteCallId() == null) {
          statement.bindNull(9);
        } else {
          statement.bindString(9, entity.getRemoteCallId());
        }
        if (entity.getRemoteStatus() == null) {
          statement.bindNull(10);
        } else {
          statement.bindString(10, entity.getRemoteStatus());
        }
        if (entity.getErrorMessage() == null) {
          statement.bindNull(11);
        } else {
          statement.bindString(11, entity.getErrorMessage());
        }
        statement.bindLong(12, entity.getCreatedAt());
        statement.bindLong(13, entity.getUpdatedAt());
        statement.bindLong(14, entity.getId());
      }
    };
    this.__preparedStmtOfDeleteAll = new SharedSQLiteStatement(__db) {
      @Override
      @NonNull
      public String createQuery() {
        final String _query = "DELETE FROM call_recordings";
        return _query;
      }
    };
  }

  @Override
  public Object insert(final CallRecordingEntity recording,
      final Continuation<? super Long> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Long>() {
      @Override
      @NonNull
      public Long call() throws Exception {
        __db.beginTransaction();
        try {
          final Long _result = __insertionAdapterOfCallRecordingEntity.insertAndReturnId(recording);
          __db.setTransactionSuccessful();
          return _result;
        } finally {
          __db.endTransaction();
        }
      }
    }, $completion);
  }

  @Override
  public Object update(final CallRecordingEntity recording,
      final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        __db.beginTransaction();
        try {
          __updateAdapterOfCallRecordingEntity.handle(recording);
          __db.setTransactionSuccessful();
          return Unit.INSTANCE;
        } finally {
          __db.endTransaction();
        }
      }
    }, $completion);
  }

  @Override
  public Object deleteAll(final Continuation<? super Integer> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Integer>() {
      @Override
      @NonNull
      public Integer call() throws Exception {
        final SupportSQLiteStatement _stmt = __preparedStmtOfDeleteAll.acquire();
        try {
          __db.beginTransaction();
          try {
            final Integer _result = _stmt.executeUpdateDelete();
            __db.setTransactionSuccessful();
            return _result;
          } finally {
            __db.endTransaction();
          }
        } finally {
          __preparedStmtOfDeleteAll.release(_stmt);
        }
      }
    }, $completion);
  }

  @Override
  public Flow<List<CallRecordingEntity>> observeRecent(final int limit) {
    final String _sql = "SELECT * FROM call_recordings ORDER BY createdAt DESC LIMIT ?";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 1);
    int _argIndex = 1;
    _statement.bindLong(_argIndex, limit);
    return CoroutinesRoom.createFlow(__db, false, new String[] {"call_recordings"}, new Callable<List<CallRecordingEntity>>() {
      @Override
      @NonNull
      public List<CallRecordingEntity> call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfId = CursorUtil.getColumnIndexOrThrow(_cursor, "id");
          final int _cursorIndexOfFileName = CursorUtil.getColumnIndexOrThrow(_cursor, "fileName");
          final int _cursorIndexOfFileUri = CursorUtil.getColumnIndexOrThrow(_cursor, "fileUri");
          final int _cursorIndexOfFileSize = CursorUtil.getColumnIndexOrThrow(_cursor, "fileSize");
          final int _cursorIndexOfLastModifiedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "lastModifiedAt");
          final int _cursorIndexOfSha256 = CursorUtil.getColumnIndexOrThrow(_cursor, "sha256");
          final int _cursorIndexOfStatus = CursorUtil.getColumnIndexOrThrow(_cursor, "status");
          final int _cursorIndexOfRetryCount = CursorUtil.getColumnIndexOrThrow(_cursor, "retryCount");
          final int _cursorIndexOfRemoteCallId = CursorUtil.getColumnIndexOrThrow(_cursor, "remoteCallId");
          final int _cursorIndexOfRemoteStatus = CursorUtil.getColumnIndexOrThrow(_cursor, "remoteStatus");
          final int _cursorIndexOfErrorMessage = CursorUtil.getColumnIndexOrThrow(_cursor, "errorMessage");
          final int _cursorIndexOfCreatedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "createdAt");
          final int _cursorIndexOfUpdatedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "updatedAt");
          final List<CallRecordingEntity> _result = new ArrayList<CallRecordingEntity>(_cursor.getCount());
          while (_cursor.moveToNext()) {
            final CallRecordingEntity _item;
            final long _tmpId;
            _tmpId = _cursor.getLong(_cursorIndexOfId);
            final String _tmpFileName;
            _tmpFileName = _cursor.getString(_cursorIndexOfFileName);
            final String _tmpFileUri;
            _tmpFileUri = _cursor.getString(_cursorIndexOfFileUri);
            final long _tmpFileSize;
            _tmpFileSize = _cursor.getLong(_cursorIndexOfFileSize);
            final long _tmpLastModifiedAt;
            _tmpLastModifiedAt = _cursor.getLong(_cursorIndexOfLastModifiedAt);
            final String _tmpSha256;
            if (_cursor.isNull(_cursorIndexOfSha256)) {
              _tmpSha256 = null;
            } else {
              _tmpSha256 = _cursor.getString(_cursorIndexOfSha256);
            }
            final String _tmpStatus;
            _tmpStatus = _cursor.getString(_cursorIndexOfStatus);
            final int _tmpRetryCount;
            _tmpRetryCount = _cursor.getInt(_cursorIndexOfRetryCount);
            final String _tmpRemoteCallId;
            if (_cursor.isNull(_cursorIndexOfRemoteCallId)) {
              _tmpRemoteCallId = null;
            } else {
              _tmpRemoteCallId = _cursor.getString(_cursorIndexOfRemoteCallId);
            }
            final String _tmpRemoteStatus;
            if (_cursor.isNull(_cursorIndexOfRemoteStatus)) {
              _tmpRemoteStatus = null;
            } else {
              _tmpRemoteStatus = _cursor.getString(_cursorIndexOfRemoteStatus);
            }
            final String _tmpErrorMessage;
            if (_cursor.isNull(_cursorIndexOfErrorMessage)) {
              _tmpErrorMessage = null;
            } else {
              _tmpErrorMessage = _cursor.getString(_cursorIndexOfErrorMessage);
            }
            final long _tmpCreatedAt;
            _tmpCreatedAt = _cursor.getLong(_cursorIndexOfCreatedAt);
            final long _tmpUpdatedAt;
            _tmpUpdatedAt = _cursor.getLong(_cursorIndexOfUpdatedAt);
            _item = new CallRecordingEntity(_tmpId,_tmpFileName,_tmpFileUri,_tmpFileSize,_tmpLastModifiedAt,_tmpSha256,_tmpStatus,_tmpRetryCount,_tmpRemoteCallId,_tmpRemoteStatus,_tmpErrorMessage,_tmpCreatedAt,_tmpUpdatedAt);
            _result.add(_item);
          }
          return _result;
        } finally {
          _cursor.close();
        }
      }

      @Override
      protected void finalize() {
        _statement.release();
      }
    });
  }

  @Override
  public Object loadByStatuses(final List<String> statuses, final int limit,
      final Continuation<? super List<CallRecordingEntity>> $completion) {
    final StringBuilder _stringBuilder = StringUtil.newStringBuilder();
    _stringBuilder.append("SELECT * FROM call_recordings WHERE status IN (");
    final int _inputSize = statuses.size();
    StringUtil.appendPlaceholders(_stringBuilder, _inputSize);
    _stringBuilder.append(") ORDER BY createdAt ASC LIMIT ");
    _stringBuilder.append("?");
    final String _sql = _stringBuilder.toString();
    final int _argCount = 1 + _inputSize;
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, _argCount);
    int _argIndex = 1;
    for (String _item : statuses) {
      _statement.bindString(_argIndex, _item);
      _argIndex++;
    }
    _argIndex = 1 + _inputSize;
    _statement.bindLong(_argIndex, limit);
    final CancellationSignal _cancellationSignal = DBUtil.createCancellationSignal();
    return CoroutinesRoom.execute(__db, false, _cancellationSignal, new Callable<List<CallRecordingEntity>>() {
      @Override
      @NonNull
      public List<CallRecordingEntity> call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfId = CursorUtil.getColumnIndexOrThrow(_cursor, "id");
          final int _cursorIndexOfFileName = CursorUtil.getColumnIndexOrThrow(_cursor, "fileName");
          final int _cursorIndexOfFileUri = CursorUtil.getColumnIndexOrThrow(_cursor, "fileUri");
          final int _cursorIndexOfFileSize = CursorUtil.getColumnIndexOrThrow(_cursor, "fileSize");
          final int _cursorIndexOfLastModifiedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "lastModifiedAt");
          final int _cursorIndexOfSha256 = CursorUtil.getColumnIndexOrThrow(_cursor, "sha256");
          final int _cursorIndexOfStatus = CursorUtil.getColumnIndexOrThrow(_cursor, "status");
          final int _cursorIndexOfRetryCount = CursorUtil.getColumnIndexOrThrow(_cursor, "retryCount");
          final int _cursorIndexOfRemoteCallId = CursorUtil.getColumnIndexOrThrow(_cursor, "remoteCallId");
          final int _cursorIndexOfRemoteStatus = CursorUtil.getColumnIndexOrThrow(_cursor, "remoteStatus");
          final int _cursorIndexOfErrorMessage = CursorUtil.getColumnIndexOrThrow(_cursor, "errorMessage");
          final int _cursorIndexOfCreatedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "createdAt");
          final int _cursorIndexOfUpdatedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "updatedAt");
          final List<CallRecordingEntity> _result = new ArrayList<CallRecordingEntity>(_cursor.getCount());
          while (_cursor.moveToNext()) {
            final CallRecordingEntity _item_1;
            final long _tmpId;
            _tmpId = _cursor.getLong(_cursorIndexOfId);
            final String _tmpFileName;
            _tmpFileName = _cursor.getString(_cursorIndexOfFileName);
            final String _tmpFileUri;
            _tmpFileUri = _cursor.getString(_cursorIndexOfFileUri);
            final long _tmpFileSize;
            _tmpFileSize = _cursor.getLong(_cursorIndexOfFileSize);
            final long _tmpLastModifiedAt;
            _tmpLastModifiedAt = _cursor.getLong(_cursorIndexOfLastModifiedAt);
            final String _tmpSha256;
            if (_cursor.isNull(_cursorIndexOfSha256)) {
              _tmpSha256 = null;
            } else {
              _tmpSha256 = _cursor.getString(_cursorIndexOfSha256);
            }
            final String _tmpStatus;
            _tmpStatus = _cursor.getString(_cursorIndexOfStatus);
            final int _tmpRetryCount;
            _tmpRetryCount = _cursor.getInt(_cursorIndexOfRetryCount);
            final String _tmpRemoteCallId;
            if (_cursor.isNull(_cursorIndexOfRemoteCallId)) {
              _tmpRemoteCallId = null;
            } else {
              _tmpRemoteCallId = _cursor.getString(_cursorIndexOfRemoteCallId);
            }
            final String _tmpRemoteStatus;
            if (_cursor.isNull(_cursorIndexOfRemoteStatus)) {
              _tmpRemoteStatus = null;
            } else {
              _tmpRemoteStatus = _cursor.getString(_cursorIndexOfRemoteStatus);
            }
            final String _tmpErrorMessage;
            if (_cursor.isNull(_cursorIndexOfErrorMessage)) {
              _tmpErrorMessage = null;
            } else {
              _tmpErrorMessage = _cursor.getString(_cursorIndexOfErrorMessage);
            }
            final long _tmpCreatedAt;
            _tmpCreatedAt = _cursor.getLong(_cursorIndexOfCreatedAt);
            final long _tmpUpdatedAt;
            _tmpUpdatedAt = _cursor.getLong(_cursorIndexOfUpdatedAt);
            _item_1 = new CallRecordingEntity(_tmpId,_tmpFileName,_tmpFileUri,_tmpFileSize,_tmpLastModifiedAt,_tmpSha256,_tmpStatus,_tmpRetryCount,_tmpRemoteCallId,_tmpRemoteStatus,_tmpErrorMessage,_tmpCreatedAt,_tmpUpdatedAt);
            _result.add(_item_1);
          }
          return _result;
        } finally {
          _cursor.close();
          _statement.release();
        }
      }
    }, $completion);
  }

  @Override
  public Object countAll(final Continuation<? super Integer> $completion) {
    final String _sql = "SELECT COUNT(*) FROM call_recordings";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 0);
    final CancellationSignal _cancellationSignal = DBUtil.createCancellationSignal();
    return CoroutinesRoom.execute(__db, false, _cancellationSignal, new Callable<Integer>() {
      @Override
      @NonNull
      public Integer call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final Integer _result;
          if (_cursor.moveToFirst()) {
            final int _tmp;
            _tmp = _cursor.getInt(0);
            _result = _tmp;
          } else {
            _result = 0;
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
