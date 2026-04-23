package com.stayopscall.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun HomeScreen(
    onGoLogin: () -> Unit,
    onGoSettings: () -> Unit,
    onGoCalls: () -> Unit,
    onGoStatus: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically)
    ) {
        Text("StayOps-Call DEBUG A")
        Button(onClick = onGoLogin) { Text("Login") }
        Button(onClick = onGoSettings) { Text("Settings") }
        Button(onClick = onGoCalls) { Text("Call List") }
        Button(onClick = onGoStatus) { Text("Processing Status") }
    }
}
