package com.stayopscall.mobile.ui.screens;

import com.stayopscall.mobile.core.auth.AuthTokenStore;
import com.stayopscall.mobile.data.remote.MobileApi;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;

@ScopeMetadata
@QualifierMetadata
@DaggerGenerated
@Generated(
    value = "dagger.internal.codegen.ComponentProcessor",
    comments = "https://dagger.dev"
)
@SuppressWarnings({
    "unchecked",
    "rawtypes",
    "KotlinInternal",
    "KotlinInternalInJava",
    "cast",
    "deprecation"
})
public final class LoginViewModel_Factory implements Factory<LoginViewModel> {
  private final Provider<MobileApi> mobileApiProvider;

  private final Provider<AuthTokenStore> authTokenStoreProvider;

  public LoginViewModel_Factory(Provider<MobileApi> mobileApiProvider,
      Provider<AuthTokenStore> authTokenStoreProvider) {
    this.mobileApiProvider = mobileApiProvider;
    this.authTokenStoreProvider = authTokenStoreProvider;
  }

  @Override
  public LoginViewModel get() {
    return newInstance(mobileApiProvider.get(), authTokenStoreProvider.get());
  }

  public static LoginViewModel_Factory create(Provider<MobileApi> mobileApiProvider,
      Provider<AuthTokenStore> authTokenStoreProvider) {
    return new LoginViewModel_Factory(mobileApiProvider, authTokenStoreProvider);
  }

  public static LoginViewModel newInstance(MobileApi mobileApi, AuthTokenStore authTokenStore) {
    return new LoginViewModel(mobileApi, authTokenStore);
  }
}
