package com.stayopscall.mobile.di

import android.content.Context
import androidx.room.Room
import com.stayopscall.mobile.BuildConfig
import com.stayopscall.mobile.core.auth.AuthTokenStore
import com.stayopscall.mobile.data.local.AppDatabase
import com.stayopscall.mobile.data.local.dao.AppSettingDao
import com.stayopscall.mobile.data.local.dao.CallRecordingDao
import com.stayopscall.mobile.data.local.dao.DeviceDao
import com.stayopscall.mobile.data.remote.MobileApi
import com.stayopscall.mobile.data.remote.UploadAgentApi
import com.stayopscall.mobile.core.device.DeviceIdentityProvider
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import javax.inject.Named
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    @Singleton
    fun provideMoshi(): Moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    @Provides
    @Singleton
    fun provideDb(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, "stay_ops_call.db")
            .addMigrations(AppDatabase.MIGRATION_1_2)
            .build()

    @Provides
    fun provideCallDao(db: AppDatabase): CallRecordingDao = db.callRecordingDao()

    @Provides
    fun provideDeviceDao(db: AppDatabase): DeviceDao = db.deviceDao()

    @Provides
    fun provideAppSettingDao(db: AppDatabase): AppSettingDao = db.appSettingDao()

    @Provides
    @Singleton
    fun provideAuthTokenStore(@ApplicationContext context: Context): AuthTokenStore =
        AuthTokenStore(context)

    @Provides
    @Singleton
    fun provideDeviceIdentityProvider(@ApplicationContext context: Context): DeviceIdentityProvider =
        DeviceIdentityProvider(context)

    @Provides
    @Singleton
    @Named("mobile")
    fun provideMobileOkHttpClient(tokenStore: AuthTokenStore): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }
        return OkHttpClient.Builder()
            .addInterceptor { chain ->
                val request = chain.request()
                val withAuth = addBearerForMobileApi(request, tokenStore.getAccessToken())
                chain.proceed(withAuth)
            }
            .addInterceptor(logging)
            .build()
    }

    @Provides
    @Singleton
    @Named("upload")
    fun provideUploadAgentOkHttpClient(): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }
        return OkHttpClient.Builder()
            .addInterceptor { chain ->
                val request = chain.request()
                val token = BuildConfig.UPLOAD_AGENT_TOKEN
                if (token.isNullOrBlank()) {
                    chain.proceed(request)
                } else {
                    chain.proceed(
                        request.newBuilder()
                            .header("Authorization", "Bearer $token")
                            .build()
                    )
                }
            }
            .addInterceptor(logging)
            .build()
    }

    @Provides
    @Singleton
    fun provideMobileApi(@Named("mobile") client: OkHttpClient, moshi: Moshi): MobileApi =
        Retrofit.Builder()
            .baseUrl(BuildConfig.BASE_URL)
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(MobileApi::class.java)

    @Provides
    @Singleton
    fun provideUploadAgentApi(@Named("upload") uploadClient: OkHttpClient, moshi: Moshi): UploadAgentApi =
        Retrofit.Builder()
            .baseUrl(BuildConfig.UPLOAD_BASE_URL)
            .client(uploadClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(UploadAgentApi::class.java)

    private fun addBearerForMobileApi(request: Request, token: String?): Request {
        val shouldAttach = request.url.toString().contains("/api/mobile/")
        if (!shouldAttach || token.isNullOrBlank()) return request
        return request.newBuilder()
            .header("Authorization", "Bearer $token")
            .build()
    }
}
