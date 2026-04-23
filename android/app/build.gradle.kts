    import java.util.Properties

    val localProps = Properties().apply {
        val f = rootProject.file("local.properties")
        if (f.exists()) load(f.inputStream())
    }

    plugins {
        id("com.android.application")
        id("org.jetbrains.kotlin.android")
        id("org.jetbrains.kotlin.plugin.compose")
        id("com.google.devtools.ksp")
        id("com.google.dagger.hilt.android")
        kotlin("kapt")
    }

    android {
        namespace = "com.stayopscall.mobile"
        compileSdk = 35

        defaultConfig {
            applicationId = "com.stayopscall.mobile"
            minSdk = 28
            targetSdk = 35
            versionCode = 1
            versionName = "0.1.0-mvp"

            testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

            vectorDrawables {
                useSupportLibrary = true
            }

            // Mobile API (existing): /api/mobile/*
            // Debug/Release override below.
            buildConfigField("String", "BASE_URL", "\"https://dev.example.com/api/mobile/\"")

            // Upload agent API (new): /api/calls/upload
            // Set UPLOAD_BASE_URL in local.properties (e.g. http://192.168.x.x:3000/ for real-device dev)
            val uploadBaseUrl = localProps.getProperty("UPLOAD_BASE_URL", "https://dev.example.com/")
            buildConfigField("String", "UPLOAD_BASE_URL", "\"$uploadBaseUrl\"")
            // Dev only. Release should be provisioned per-device later (do not hardcode server-internal keys).
            // Set UPLOAD_AGENT_TOKEN in local.properties (never commit the actual token)
            val token = localProps.getProperty("UPLOAD_AGENT_TOKEN", "")
            buildConfigField("String", "UPLOAD_AGENT_TOKEN", "\"$token\"")
        }

        buildTypes {
            debug {
                // dev environment
                buildConfigField("String", "BASE_URL", "\"https://dev.example.com/api/mobile/\"")
                // UPLOAD_BASE_URL: defaultConfig에서 local.properties 값을 읽음 — 여기서 override 안 함
            }
            release {
                isMinifyEnabled = false
                // prod environment
                buildConfigField("String", "BASE_URL", "\"https://app.example.com/api/mobile/\"")
                buildConfigField("String", "UPLOAD_BASE_URL", "\"https://app.example.com/\"")
                proguardFiles(
                    getDefaultProguardFile("proguard-android-optimize.txt"),
                    "proguard-rules.pro"
                )
            }
        }

        compileOptions {
            sourceCompatibility = JavaVersion.VERSION_17
            targetCompatibility = JavaVersion.VERSION_17
        }

        kotlinOptions {
            jvmTarget = "17"
        }

        buildFeatures {
            compose = true
            buildConfig = true
        }

        packaging {
            resources {
                excludes += "/META-INF/{AL2.0,LGPL2.1}"
            }
        }
    }

    dependencies {
        val composeBom = platform("androidx.compose:compose-bom:2024.09.03")

        implementation("androidx.core:core-ktx:1.15.0")
        implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
        implementation("androidx.activity:activity-compose:1.10.1")
        implementation("androidx.navigation:navigation-compose:2.8.5")
        implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
        implementation("androidx.hilt:hilt-navigation-compose:1.2.0")

        implementation(composeBom)
        androidTestImplementation(composeBom)

        implementation("androidx.compose.ui:ui")
        implementation("androidx.compose.ui:ui-graphics")
        implementation("androidx.compose.ui:ui-tooling-preview")
        implementation("androidx.compose.material3:material3")

        debugImplementation("androidx.compose.ui:ui-tooling")
        debugImplementation("androidx.compose.ui:ui-test-manifest")

        implementation("com.google.android.material:material:1.12.0")

        implementation("androidx.work:work-runtime-ktx:2.10.0")
        implementation("androidx.hilt:hilt-work:1.2.0")
        kapt("androidx.hilt:hilt-compiler:1.2.0")

        implementation("androidx.room:room-runtime:2.6.1")
        implementation("androidx.room:room-ktx:2.6.1")
        ksp("androidx.room:room-compiler:2.6.1")

        implementation("com.squareup.retrofit2:retrofit:2.11.0")
        implementation("com.squareup.retrofit2:converter-moshi:2.11.0")
        implementation("com.squareup.okhttp3:okhttp:4.12.0")
        implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
        implementation("com.squareup.moshi:moshi-kotlin:1.15.1")

        implementation("com.google.dagger:hilt-android:2.52")
        kapt("com.google.dagger:hilt-android-compiler:2.52")

        testImplementation("junit:junit:4.13.2")
        androidTestImplementation("androidx.test.ext:junit:1.2.1")
        androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
        androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    }

    kapt {
        correctErrorTypes = true
    }