package com.stayopscall.mobile.ui.screens;

import androidx.lifecycle.ViewModel;
import com.stayopscall.mobile.data.local.RecordingStatus;
import com.stayopscall.mobile.data.local.dao.CallRecordingDao;
import com.stayopscall.mobile.data.local.entity.CallRecordingEntity;
import dagger.hilt.android.lifecycle.HiltViewModel;
import kotlinx.coroutines.flow.SharingStarted;
import kotlinx.coroutines.flow.StateFlow;
import javax.inject.Inject;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000H\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000e\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\u000b\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0006\b\u0007\u0018\u00002\u00020\u0001B\u000f\b\u0007\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0002\u0010\u0004J\u0006\u0010\u0011\u001a\u00020\u0012J\u0018\u0010\u0013\u001a\u00020\u00142\u0006\u0010\u0015\u001a\u00020\u00162\u0006\u0010\u0005\u001a\u00020\u0007H\u0002J\u0018\u0010\u0017\u001a\u00020\u00142\u0006\u0010\u0015\u001a\u00020\u00162\u0006\u0010\u0018\u001a\u00020\tH\u0002J\u000e\u0010\u0019\u001a\u00020\u00122\u0006\u0010\u001a\u001a\u00020\u0007J\u000e\u0010\u001b\u001a\u00020\u00122\u0006\u0010\u001a\u001a\u00020\tR\u0014\u0010\u0005\u001a\b\u0012\u0004\u0012\u00020\u00070\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0014\u0010\b\u001a\b\u0012\u0004\u0012\u00020\t0\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0014\u0010\n\u001a\b\u0012\u0004\u0012\u00020\u000b0\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0017\u0010\f\u001a\b\u0012\u0004\u0012\u00020\u000e0\r\u00a2\u0006\b\n\u0000\u001a\u0004\b\u000f\u0010\u0010\u00a8\u0006\u001c"}, d2 = {"Lcom/stayopscall/mobile/ui/screens/StatusViewModel;", "Landroidx/lifecycle/ViewModel;", "callRecordingDao", "Lcom/stayopscall/mobile/data/local/dao/CallRecordingDao;", "(Lcom/stayopscall/mobile/data/local/dao/CallRecordingDao;)V", "filter", "Lkotlinx/coroutines/flow/MutableStateFlow;", "Lcom/stayopscall/mobile/ui/screens/StatusFilter;", "searchQuery", "", "sort", "Lcom/stayopscall/mobile/ui/screens/StatusSort;", "uiState", "Lkotlinx/coroutines/flow/StateFlow;", "Lcom/stayopscall/mobile/ui/screens/StatusUiState;", "getUiState", "()Lkotlinx/coroutines/flow/StateFlow;", "cycleSort", "", "matchesFilter", "", "item", "Lcom/stayopscall/mobile/data/local/entity/CallRecordingEntity;", "matchesQuery", "query", "setFilter", "next", "setSearchQuery", "app_debug"})
@dagger.hilt.android.lifecycle.HiltViewModel()
public final class StatusViewModel extends androidx.lifecycle.ViewModel {
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<com.stayopscall.mobile.ui.screens.StatusFilter> filter = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<java.lang.String> searchQuery = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<com.stayopscall.mobile.ui.screens.StatusSort> sort = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<com.stayopscall.mobile.ui.screens.StatusUiState> uiState = null;
    
    @javax.inject.Inject()
    public StatusViewModel(@org.jetbrains.annotations.NotNull()
    com.stayopscall.mobile.data.local.dao.CallRecordingDao callRecordingDao) {
        super();
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<com.stayopscall.mobile.ui.screens.StatusUiState> getUiState() {
        return null;
    }
    
    public final void setFilter(@org.jetbrains.annotations.NotNull()
    com.stayopscall.mobile.ui.screens.StatusFilter next) {
    }
    
    public final void setSearchQuery(@org.jetbrains.annotations.NotNull()
    java.lang.String next) {
    }
    
    public final void cycleSort() {
    }
    
    private final boolean matchesQuery(com.stayopscall.mobile.data.local.entity.CallRecordingEntity item, java.lang.String query) {
        return false;
    }
    
    private final boolean matchesFilter(com.stayopscall.mobile.data.local.entity.CallRecordingEntity item, com.stayopscall.mobile.ui.screens.StatusFilter filter) {
        return false;
    }
}