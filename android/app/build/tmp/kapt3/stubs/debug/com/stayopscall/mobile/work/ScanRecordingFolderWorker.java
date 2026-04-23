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

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000V\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0010\b\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\u000b\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0002\b\u0007\u0018\u00002\u00020\u0001:\u0001\u001cB\u0015\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005\u00a2\u0006\u0002\u0010\u0006J\b\u0010\u0007\u001a\u00020\bH\u0016Jc\u0010\t\u001a\b\u0012\u0004\u0012\u00020\u000b0\n2\u0006\u0010\f\u001a\u00020\u000b2K\u0010\r\u001aG\u0012\u0013\u0012\u00110\u000f\u00a2\u0006\f\b\u0010\u0012\b\b\u0011\u0012\u0004\b\b(\u0012\u0012\u0013\u0012\u00110\u0013\u00a2\u0006\f\b\u0010\u0012\b\b\u0011\u0012\u0004\b\b(\u0011\u0012\u0013\u0012\u00110\u000f\u00a2\u0006\f\b\u0010\u0012\b\b\u0011\u0012\u0004\b\b(\u0014\u0012\u0004\u0012\u00020\u00150\u000eH\u0002J\u0010\u0010\u0016\u001a\u00020\u00172\u0006\u0010\u0018\u001a\u00020\u000bH\u0002J\u0010\u0010\u0019\u001a\u00020\b2\u0006\u0010\u001a\u001a\u00020\u001bH\u0002\u00a8\u0006\u001d"}, d2 = {"Lcom/stayopscall/mobile/work/ScanRecordingFolderWorker;", "Landroidx/work/Worker;", "appContext", "Landroid/content/Context;", "params", "Landroidx/work/WorkerParameters;", "(Landroid/content/Context;Landroidx/work/WorkerParameters;)V", "doWork", "Landroidx/work/ListenableWorker$Result;", "flattenFiles", "", "Landroidx/documentfile/provider/DocumentFile;", "root", "onProgress", "Lkotlin/Function3;", "", "Lkotlin/ParameterName;", "name", "index", "", "queueSize", "", "isAudioFile", "", "file", "runScan", "debugStore", "Lcom/stayopscall/mobile/core/storage/WorkerDebugStore;", "ScanWorkerDeps", "app_debug"})
public final class ScanRecordingFolderWorker extends androidx.work.Worker {
    
    public ScanRecordingFolderWorker(@org.jetbrains.annotations.NotNull()
    android.content.Context appContext, @org.jetbrains.annotations.NotNull()
    androidx.work.WorkerParameters params) {
        super(null, null);
    }
    
    @java.lang.Override()
    @org.jetbrains.annotations.NotNull()
    public androidx.work.ListenableWorker.Result doWork() {
        return null;
    }
    
    private final androidx.work.ListenableWorker.Result runScan(com.stayopscall.mobile.core.storage.WorkerDebugStore debugStore) {
        return null;
    }
    
    private final java.util.List<androidx.documentfile.provider.DocumentFile> flattenFiles(androidx.documentfile.provider.DocumentFile root, kotlin.jvm.functions.Function3<? super java.lang.Integer, ? super java.lang.String, ? super java.lang.Integer, kotlin.Unit> onProgress) {
        return null;
    }
    
    private final boolean isAudioFile(androidx.documentfile.provider.DocumentFile file) {
        return false;
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\u001a\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\b\u00c2\u0002\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002J\u000e\u0010\u0005\u001a\u00020\u00042\u0006\u0010\u0006\u001a\u00020\u0007R\u0010\u0010\u0003\u001a\u0004\u0018\u00010\u0004X\u0082\u000e\u00a2\u0006\u0002\n\u0000\u00a8\u0006\b"}, d2 = {"Lcom/stayopscall/mobile/work/ScanRecordingFolderWorker$ScanWorkerDeps;", "", "()V", "db", "Lcom/stayopscall/mobile/data/local/AppDatabase;", "get", "context", "Landroid/content/Context;", "app_debug"})
    static final class ScanWorkerDeps {
        @kotlin.jvm.Volatile()
        @org.jetbrains.annotations.Nullable()
        private static volatile com.stayopscall.mobile.data.local.AppDatabase db;
        @org.jetbrains.annotations.NotNull()
        public static final com.stayopscall.mobile.work.ScanRecordingFolderWorker.ScanWorkerDeps INSTANCE = null;
        
        private ScanWorkerDeps() {
            super();
        }
        
        @org.jetbrains.annotations.NotNull()
        public final com.stayopscall.mobile.data.local.AppDatabase get(@org.jetbrains.annotations.NotNull()
        android.content.Context context) {
            return null;
        }
    }
}