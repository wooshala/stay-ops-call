package com.stayopscall.mobile.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.stayopscall.mobile.data.local.RecordingStatus
import com.stayopscall.mobile.data.local.dao.CallRecordingDao
import com.stayopscall.mobile.data.local.entity.CallRecordingEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import javax.inject.Inject

@HiltViewModel
class StatusViewModel @Inject constructor(
    callRecordingDao: CallRecordingDao
) : ViewModel() {
    private val filter = MutableStateFlow(StatusFilter.All)
    private val searchQuery = MutableStateFlow("")
    private val sort = MutableStateFlow(StatusSort.Newest)

    val uiState: StateFlow<StatusUiState> = combine(
        callRecordingDao.observeRecent(limit = 200),
        filter,
        searchQuery,
        sort
    ) { calls, selectedFilter, query, selectedSort ->
        val filtered = calls
            .asSequence()
            .filter { matchesFilter(it, selectedFilter) }
            .filter { matchesQuery(it, query) }
            .let { seq ->
                when (selectedSort) {
                    StatusSort.Newest -> seq.sortedByDescending { it.createdAt }
                    StatusSort.Oldest -> seq.sortedBy { it.createdAt }
                    StatusSort.RetryHigh -> seq.sortedByDescending { it.retryCount }
                }
            }
            .toList()
        StatusUiState(
            selectedFilter = selectedFilter,
            searchQuery = query,
            selectedSort = selectedSort,
            items = filtered
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = StatusUiState()
    )

    fun setFilter(next: StatusFilter) = filter.update { next }
    fun setSearchQuery(next: String) = searchQuery.update { next }
    fun cycleSort() = sort.update {
        when (it) {
            StatusSort.Newest -> StatusSort.Oldest
            StatusSort.Oldest -> StatusSort.RetryHigh
            StatusSort.RetryHigh -> StatusSort.Newest
        }
    }

    private fun matchesQuery(item: CallRecordingEntity, query: String): Boolean {
        if (query.isBlank()) return true
        val q = query.trim().lowercase()
        return item.fileName.lowercase().contains(q) ||
            (item.remoteCallId?.lowercase()?.contains(q) == true)
    }

    private fun matchesFilter(item: CallRecordingEntity, filter: StatusFilter): Boolean = when (filter) {
        StatusFilter.All -> true
        StatusFilter.Failed -> item.status == RecordingStatus.FailedUpload
        StatusFilter.RetryNeeded -> item.status == RecordingStatus.RetryPending
        StatusFilter.Uploading -> item.status == RecordingStatus.Uploading
        StatusFilter.Synced -> item.status == RecordingStatus.Synced || item.status == RecordingStatus.Duplicate
    }
}

data class StatusUiState(
    val selectedFilter: StatusFilter = StatusFilter.All,
    val searchQuery: String = "",
    val selectedSort: StatusSort = StatusSort.Newest,
    val items: List<CallRecordingEntity> = emptyList()
)

enum class StatusFilter(val label: String) {
    All("전체"),
    Failed("실패"),
    RetryNeeded("재시도 필요"),
    Uploading("업로드 중"),
    Synced("동기화 완료")
}

enum class StatusSort(val label: String) {
    Newest("최신순"),
    Oldest("오래된순"),
    RetryHigh("재시도 많은순")
}
