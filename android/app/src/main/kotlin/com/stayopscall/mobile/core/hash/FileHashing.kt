package com.stayopscall.mobile.core.hash

import android.content.ContentResolver
import android.net.Uri
import java.security.MessageDigest

object FileHashing {
    fun sha256(contentResolver: ContentResolver, uri: Uri): String? {
        val digest = MessageDigest.getInstance("SHA-256")
        contentResolver.openInputStream(uri)?.use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) break
                digest.update(buffer, 0, read)
            }
        } ?: return null
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}
