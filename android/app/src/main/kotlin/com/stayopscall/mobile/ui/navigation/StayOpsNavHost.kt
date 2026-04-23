package com.stayopscall.mobile.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.stayopscall.mobile.ui.screens.CallListScreen
import com.stayopscall.mobile.ui.screens.HomeScreen
import com.stayopscall.mobile.ui.screens.LoginScreen
import com.stayopscall.mobile.ui.screens.SettingsScreen
import com.stayopscall.mobile.ui.screens.StatusScreen

@Composable
fun StayOpsNavHost() {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = Routes.Home) {
        composable(Routes.Home) {
            HomeScreen(
                onGoLogin = { navController.navigate(Routes.Login) },
                onGoSettings = { navController.navigate(Routes.Settings) },
                onGoCalls = { navController.navigate(Routes.CallList) },
                onGoStatus = { navController.navigate(Routes.Status) }
            )
        }
        composable(Routes.Login) { LoginScreen() }
        composable(Routes.Settings) { SettingsScreen() }
        composable(Routes.CallList) { CallListScreen() }
        composable(Routes.Status) { StatusScreen() }
    }
}
