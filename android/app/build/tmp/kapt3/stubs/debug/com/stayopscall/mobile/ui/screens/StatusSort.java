package com.stayopscall.mobile.ui.screens;

import androidx.lifecycle.ViewModel;
import com.stayopscall.mobile.data.local.RecordingStatus;
import com.stayopscall.mobile.data.local.dao.CallRecordingDao;
import com.stayopscall.mobile.data.local.entity.CallRecordingEntity;
import dagger.hilt.android.lifecycle.HiltViewModel;
import kotlinx.coroutines.flow.SharingStarted;
import kotlinx.coroutines.flow.StateFlow;
import javax.inject.Inject;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\u0012\n\u0002\u0018\u0002\n\u0002\u0010\u0010\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0007\b\u0086\u0081\u0002\u0018\u00002\b\u0012\u0004\u0012\u00020\u00000\u0001B\u000f\b\u0002\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0002\u0010\u0004R\u0011\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0005\u0010\u0006j\u0002\b\u0007j\u0002\b\bj\u0002\b\t\u00a8\u0006\n"}, d2 = {"Lcom/stayopscall/mobile/ui/screens/StatusSort;", "", "label", "", "(Ljava/lang/String;ILjava/lang/String;)V", "getLabel", "()Ljava/lang/String;", "Newest", "Oldest", "RetryHigh", "app_debug"})
public enum StatusSort {
    /*public static final*/ Newest /* = new Newest(null) */,
    /*public static final*/ Oldest /* = new Oldest(null) */,
    /*public static final*/ RetryHigh /* = new RetryHigh(null) */;
    @org.jetbrains.annotations.NotNull()
    private final java.lang.String label = null;
    
    StatusSort(java.lang.String label) {
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.lang.String getLabel() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public static kotlin.enums.EnumEntries<com.stayopscall.mobile.ui.screens.StatusSort> getEntries() {
        return null;
    }
}