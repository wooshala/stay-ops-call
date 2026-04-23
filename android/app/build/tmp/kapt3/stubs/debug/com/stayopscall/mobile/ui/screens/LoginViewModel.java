package com.stayopscall.mobile.ui.screens;

import androidx.lifecycle.ViewModel;
import com.stayopscall.mobile.core.auth.AuthTokenStore;
import com.stayopscall.mobile.data.remote.LoginRequest;
import com.stayopscall.mobile.data.remote.MobileApi;
import dagger.hilt.android.lifecycle.HiltViewModel;
import kotlinx.coroutines.flow.StateFlow;
import javax.inject.Inject;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u00002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0010\u000e\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u0002\n\u0002\b\u0003\b\u0007\u0018\u00002\u00020\u0001B\u0017\b\u0007\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005\u00a2\u0006\u0002\u0010\u0006J\u0016\u0010\u000e\u001a\u00020\u000f2\u0006\u0010\u0010\u001a\u00020\t2\u0006\u0010\u0011\u001a\u00020\tR\u0014\u0010\u0007\u001a\b\u0012\u0004\u0012\u00020\t0\bX\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0004\u001a\u00020\u0005X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0017\u0010\n\u001a\b\u0012\u0004\u0012\u00020\t0\u000b\u00a2\u0006\b\n\u0000\u001a\u0004\b\f\u0010\rR\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004\u00a2\u0006\u0002\n\u0000\u00a8\u0006\u0012"}, d2 = {"Lcom/stayopscall/mobile/ui/screens/LoginViewModel;", "Landroidx/lifecycle/ViewModel;", "mobileApi", "Lcom/stayopscall/mobile/data/remote/MobileApi;", "authTokenStore", "Lcom/stayopscall/mobile/core/auth/AuthTokenStore;", "(Lcom/stayopscall/mobile/data/remote/MobileApi;Lcom/stayopscall/mobile/core/auth/AuthTokenStore;)V", "_loginState", "Lkotlinx/coroutines/flow/MutableStateFlow;", "", "loginState", "Lkotlinx/coroutines/flow/StateFlow;", "getLoginState", "()Lkotlinx/coroutines/flow/StateFlow;", "login", "", "shopAccount", "password", "app_debug"})
@dagger.hilt.android.lifecycle.HiltViewModel()
public final class LoginViewModel extends androidx.lifecycle.ViewModel {
    @org.jetbrains.annotations.NotNull()
    private final com.stayopscall.mobile.data.remote.MobileApi mobileApi = null;
    @org.jetbrains.annotations.NotNull()
    private final com.stayopscall.mobile.core.auth.AuthTokenStore authTokenStore = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.MutableStateFlow<java.lang.String> _loginState = null;
    @org.jetbrains.annotations.NotNull()
    private final kotlinx.coroutines.flow.StateFlow<java.lang.String> loginState = null;
    
    @javax.inject.Inject()
    public LoginViewModel(@org.jetbrains.annotations.NotNull()
    com.stayopscall.mobile.data.remote.MobileApi mobileApi, @org.jetbrains.annotations.NotNull()
    com.stayopscall.mobile.core.auth.AuthTokenStore authTokenStore) {
        super();
    }
    
    @org.jetbrains.annotations.NotNull()
    public final kotlinx.coroutines.flow.StateFlow<java.lang.String> getLoginState() {
        return null;
    }
    
    public final void login(@org.jetbrains.annotations.NotNull()
    java.lang.String shopAccount, @org.jetbrains.annotations.NotNull()
    java.lang.String password) {
    }
}