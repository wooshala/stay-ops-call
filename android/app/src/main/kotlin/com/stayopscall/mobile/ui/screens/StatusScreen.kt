package com.stayopscall.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.stayopscall.mobile.data.local.RecordingStatus
import com.stayopscall.mobile.data.local.entity.CallRecordingEntity

@Composable
fun StatusScreen(viewModel: StatusViewModel = hiltViewModel()) {
    val uiState = viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text("End-to-End Queue Status")
        Text("Scan/Upload 결과가 DB에 반영된 실제 상태")

        OutlinedTextField(
            value = uiState.value.searchQuery,
            onValueChange = viewModel::setSearchQuery,
            label = { Text("Search by filename or serverCallId") },
            modifier = Modifier.fillMaxWidth()
        )

        StatusFilterRow(
            selected = uiState.value.selectedFilter,
            onSelected = viewModel::setFilter
        )

        AssistChip(
            onClick = viewModel::cycleSort,
            label = { Text("정렬: ${uiState.value.selectedSort.label}") },
            modifier = Modifier.wrapContentHeight()
        )

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxSize()) {
            items(uiState.value.items) { call ->
                StatusItem(call)
            }
        }
    }
}

@Composable
private fun StatusItem(call: CallRecordingEntity) {
    val statusColor = if (call.status == RecordingStatus.FailedUpload) Color(0xFFB00020) else Color.Unspecified
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("file: ${call.fileName}")
            AssistChip(
                onClick = {},
                label = { Text(call.status, color = statusColor) }
            )
            Text("retryCount: ${call.retryCount}")
            Text("serverCallId: ${call.remoteCallId ?: "-"}")
            Text("error: ${call.errorMessage ?: "-"}")
            Text("uri: ${call.fileUri}")
        }
    }
}

@Composable
private fun StatusFilterRow(
    selected: StatusFilter,
    onSelected: (StatusFilter) -> Unit
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
    ) {
        StatusFilter.entries.forEach { filter ->
            AssistChip(
                onClick = { onSelected(filter) },
                label = { Text(if (filter == selected) "[${filter.label}]" else filter.label) }
            )
        }
    }
}
