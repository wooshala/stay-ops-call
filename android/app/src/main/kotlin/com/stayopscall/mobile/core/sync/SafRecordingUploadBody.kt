package com.stayopscall.mobile.core.sync

import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody
import okio.BufferedSink
import java.io.FileNotFoundException
import java.io.InputStream

/**
 * SAF/MediaStore-backed recording upload body.
 *
 * Never uses ContentResolver / Room metadata size as HTTP Content-Length.
 * During CALL-RELIABILITY-03C recovery, Samsung SAF reported sizes that disagreed
 * with the actual stream, and OkHttp failed with:
 * `expected N bytes but received M`.
 *
 * Unknown length (-1) forces chunked multipart streaming to EOF.
 */
object SafRecordingUploadBody {
    fun fromStream(
        mimeType: String,
        openStream: () -> InputStream?,
    ): RequestBody =
        object : RequestBody() {
            override fun contentType(): MediaType? = mimeType.toMediaTypeOrNull()

            override fun contentLength(): Long = -1L

            override fun writeTo(sink: BufferedSink) {
                val input =
                    openStream()
                        ?: throw FileNotFoundException("Cannot open file stream")
                input.use { stream ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    while (true) {
                        val read = stream.read(buffer)
                        if (read <= 0) break
                        sink.write(buffer, 0, read)
                    }
                }
            }
        }
}
