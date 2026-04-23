package com.stayopscall.mobile.work;

import android.content.Context;
import android.util.Log;
import androidx.documentfile.provider.DocumentFile;
import androidx.room.Room;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import com.stayopscall.mobile.core.storage.RecordingFolderStore;
import com.stayopscall.mobile.core.storage.WorkerDebugStore;
import com.stayopscall.mobile.data.local.AppDatabase;
import com.stayopscall.mobile.data.local.RecordingStatus;
import com.stayopscall.mobile.data.local.entity.CallRecordingEntity;

@kotlin.Metadata(mv = {1, 9, 0}, k = 2, xi = 48, d1 = {"\u0000\b\n\u0000\n\u0002\u0010\u000e\n\u0000\"\u000e\u0010\u0000\u001a\u00020\u0001X\u0082T\u00a2\u0006\u0002\n\u0000\u00a8\u0006\u0002"}, d2 = {"TAG_SCAN", "", "app_debug"})
public final class ScanRecordingFolderWorkerKt {
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String TAG_SCAN = "StayOpsScan";
}