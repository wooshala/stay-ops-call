package com.stayopscall.mobile.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.stayopscall.mobile.core.auth.AuthTokenStore
import com.stayopscall.mobile.data.remote.LoginRequest
import com.stayopscall.mobile.data.remote.MobileApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val mobileApi: MobileApi,
    private val authTokenStore: AuthTokenStore
) : ViewModel() {
    private val _loginState = MutableStateFlow("idle")
    val loginState: StateFlow<String> = _loginState.asStateFlow()

    fun login(shopAccount: String, password: String) {
        if (shopAccount.isBlank() || password.isBlank()) {
            _loginState.value = "failed: account/password required"
            return
        }
        viewModelScope.launch {
            runCatching {
                mobileApi.login(LoginRequest(shopAccount = shopAccount, password = password))
            }.onSuccess { response ->
                authTokenStore.setTokens(response.accessToken, response.refreshToken)
                _loginState.value = "success: token saved"
            }.onFailure { error ->
                _loginState.value = "failed: ${error.message}"
            }
        }
    }
}
