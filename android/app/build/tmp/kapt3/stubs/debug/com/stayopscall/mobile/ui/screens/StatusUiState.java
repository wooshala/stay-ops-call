package com.stayopscall.mobile.ui.screens;

import androidx.lifecycle.ViewModel;
import com.stayopscall.mobile.data.local.RecordingStatus;
import com.stayopscall.mobile.data.local.dao.CallRecordingDao;
import com.stayopscall.mobile.data.local.entity.CallRecordingEntity;
import dagger.hilt.android.lifecycle.HiltViewModel;
import kotlinx.coroutines.flow.SharingStarted;
import kotlinx.coroutines.flow.StateFlow;
import javax.inject.Inject;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u00008\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000e\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0002\b\u000f\n\u0002\u0010\u000b\n\u0002\b\u0002\n\u0002\u0010\b\n\u0002\b\u0002\b\u0087\b\u0018\u00002\u00020\u0001B3\u0012\b\b\u0002\u0010\u0002\u001a\u00020\u0003\u0012\b\b\u0002\u0010\u0004\u001a\u00020\u0005\u0012\b\b\u0002\u0010\u0006\u001a\u00020\u0007\u0012\u000e\b\u0002\u0010\b\u001a\b\u0012\u0004\u0012\u00020\n0\t\u00a2\u0006\u0002\u0010\u000bJ\t\u0010\u0014\u001a\u00020\u0003H\u00c6\u0003J\t\u0010\u0015\u001a\u00020\u0005H\u00c6\u0003J\t\u0010\u0016\u001a\u00020\u0007H\u00c6\u0003J\u000f\u0010\u0017\u001a\b\u0012\u0004\u0012\u00020\n0\tH\u00c6\u0003J7\u0010\u0018\u001a\u00020\u00002\b\b\u0002\u0010\u0002\u001a\u00020\u00032\b\b\u0002\u0010\u0004\u001a\u00020\u00052\b\b\u0002\u0010\u0006\u001a\u00020\u00072\u000e\b\u0002\u0010\b\u001a\b\u0012\u0004\u0012\u00020\n0\tH\u00c6\u0001J\u0013\u0010\u0019\u001a\u00020\u001a2\b\u0010\u001b\u001a\u0004\u0018\u00010\u0001H\u00d6\u0003J\t\u0010\u001c\u001a\u00020\u001dH\u00d6\u0001J\t\u0010\u001e\u001a\u00020\u0005H\u00d6\u0001R\u0017\u0010\b\u001a\b\u0012\u0004\u0012\u00020\n0\t\u00a2\u0006\b\n\u0000\u001a\u0004\b\f\u0010\rR\u0011\u0010\u0004\u001a\u00020\u0005\u00a2\u0006\b\n\u0000\u001a\u0004\b\u000e\u0010\u000fR\u0011\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0010\u0010\u0011R\u0011\u0010\u0006\u001a\u00020\u0007\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0012\u0010\u0013\u00a8\u0006\u001f"}, d2 = {"Lcom/stayopscall/mobile/ui/screens/StatusUiState;", "", "selectedFilter", "Lcom/stayopscall/mobile/ui/screens/StatusFilter;", "searchQuery", "", "selectedSort", "Lcom/stayopscall/mobile/ui/screens/StatusSort;", "items", "", "Lcom/stayopscall/mobile/data/local/entity/CallRecordingEntity;", "(Lcom/stayopscall/mobile/ui/screens/StatusFilter;Ljava/lang/String;Lcom/stayopscall/mobile/ui/screens/StatusSort;Ljava/util/List;)V", "getItems", "()Ljava/util/List;", "getSearchQuery", "()Ljava/lang/String;", "getSelectedFilter", "()Lcom/stayopscall/mobile/ui/screens/StatusFilter;", "getSelectedSort", "()Lcom/stayopscall/mobile/ui/screens/StatusSort;", "component1", "component2", "component3", "component4", "copy", "equals", "", "other", "hashCode", "", "toString", "app_debug"})
public final class StatusUiState {
    @org.jetbrains.annotations.NotNull()
    private final com.stayopscall.mobile.ui.screens.StatusFilter selectedFilter = null;
    @org.jetbrains.annotations.NotNull()
    private final java.lang.String searchQuery = null;
    @org.jetbrains.annotations.NotNull()
    private final com.stayopscall.mobile.ui.screens.StatusSort selectedSort = null;
    @org.jetbrains.annotations.NotNull()
    private final java.util.List<com.stayopscall.mobile.data.local.entity.CallRecordingEntity> items = null;
    
    public StatusUiState(@org.jetbrains.annotations.NotNull()
    com.stayopscall.mobile.ui.screens.StatusFilter selectedFilter, @org.jetbrains.annotations.NotNull()
    java.lang.String searchQuery, @org.jetbrains.annotations.NotNull()
    com.stayopscall.mobile.ui.screens.StatusSort selectedSort, @org.jetbrains.annotations.NotNull()
    java.util.List<com.stayopscall.mobile.data.local.entity.CallRecordingEntity> items) {
        super();
    }
    
    @org.jetbrains.annotations.NotNull()
    public final com.stayopscall.mobile.ui.screens.StatusFilter getSelectedFilter() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.lang.String getSearchQuery() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final com.stayopscall.mobile.ui.screens.StatusSort getSelectedSort() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.util.List<com.stayopscall.mobile.data.local.entity.CallRecordingEntity> getItems() {
        return null;
    }
    
    public StatusUiState() {
        super();
    }
    
    @org.jetbrains.annotations.NotNull()
    public final com.stayopscall.mobile.ui.screens.StatusFilter component1() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.lang.String component2() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final com.stayopscall.mobile.ui.screens.StatusSort component3() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.util.List<com.stayopscall.mobile.data.local.entity.CallRecordingEntity> component4() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final com.stayopscall.mobile.ui.screens.StatusUiState copy(@org.jetbrains.annotations.NotNull()
    com.stayopscall.mobile.ui.screens.StatusFilter selectedFilter, @org.jetbrains.annotations.NotNull()
    java.lang.String searchQuery, @org.jetbrains.annotations.NotNull()
    com.stayopscall.mobile.ui.screens.StatusSort selectedSort, @org.jetbrains.annotations.NotNull()
    java.util.List<com.stayopscall.mobile.data.local.entity.CallRecordingEntity> items) {
        return null;
    }
    
    @java.lang.Override()
    public boolean equals(@org.jetbrains.annotations.Nullable()
    java.lang.Object other) {
        return false;
    }
    
    @java.lang.Override()
    public int hashCode() {
        return 0;
    }
    
    @java.lang.Override()
    @org.jetbrains.annotations.NotNull()
    public java.lang.String toString() {
        return null;
    }
}