package com.stayopscall.mobile.core.sync

import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okio.Buffer
import okio.BufferedSink
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.IOException

/**
 * Regression for CALL-RELIABILITY-03F / 03C incident:
 * SAF metadata fileSize != actual InputStream bytes must not break multipart upload.
 */
class SafRecordingUploadBodyTest {
    @Test
    fun contentLength_isUnknown_independentOfAnyMetadataSize() {
        val staleMetadataSize = 100L
        val actualBytes = ByteArray(150) { 1 }
        // Callers must not pass metadata size into Content-Length; factory ignores it by design.
        assertTrue(staleMetadataSize != actualBytes.size.toLong())

        val body =
            SafRecordingUploadBody.fromStream("audio/m4a") {
                actualBytes.inputStream()
            }

        assertEquals(-1L, body.contentLength())
    }

    @Test
    fun writeTo_streamsFullPayload_whenMetadataWouldHaveBeenShorter() {
        val actualBytes = byteArrayOf(1, 2, 3, 4, 5, 6, 7, 8)
        val staleMetadataSize = 5L
        assertTrue(staleMetadataSize < actualBytes.size)

        val body =
            SafRecordingUploadBody.fromStream("audio/m4a") {
                actualBytes.inputStream()
            }
        val sink = Buffer()
        body.writeTo(sink)

        assertEquals(actualBytes.size.toLong(), sink.size)
        assertArrayEquals(actualBytes, sink.readByteArray())
    }

    @Test
    fun fixedContentLength_mismatchesWhenStreamLongerThanDeclared() {
        // Models the 03C OkHttp failure mode: declaring SAF metadata size as Content-Length
        // while the stream yields more bytes ("expected N bytes but received M").
        val actualBytes = ByteArray(20) { it.toByte() }
        val declaredLength = 10L
        val buggyBody =
            object : RequestBody() {
                override fun contentType() = "audio/m4a".toMediaTypeOrNull()

                override fun contentLength(): Long = declaredLength

                override fun writeTo(sink: BufferedSink) {
                    sink.write(actualBytes)
                }
            }

        val written = Buffer()
        buggyBody.writeTo(written)
        assertEquals(declaredLength, buggyBody.contentLength())
        assertTrue(written.size != buggyBody.contentLength())

        try {
            writeWithOkHttpLengthGuard(buggyBody)
            fail("expected IOException when stream exceeds declared Content-Length")
        } catch (e: IOException) {
            assertTrue(e.message!!.contains("expected"))
            assertTrue(e.message!!.contains("received"))
        }
    }

    /** Same check OkHttp applies when sending a body with a known Content-Length. */
    private fun writeWithOkHttpLengthGuard(body: RequestBody) {
        val expected = body.contentLength()
        val buffer = Buffer()
        body.writeTo(buffer)
        if (expected != -1L && buffer.size != expected) {
            throw IOException("expected $expected bytes but received ${buffer.size}")
        }
    }

    @Test
    fun unknownContentLength_multipartWrite_succeedsDespiteStaleMetadataMismatch() {
        val actualBytes = ByteArray(20) { it.toByte() }
        val body =
            SafRecordingUploadBody.fromStream("audio/m4a") {
                actualBytes.inputStream()
            }

        val multipart =
            MultipartBody
                .Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("file", "recording.m4a", body)
                .addFormDataPart("source_type", "android_agent")
                .build()

        assertEquals(-1L, body.contentLength())
        writeWithOkHttpLengthGuard(body) // must not throw for unknown length
        val out = Buffer()
        multipart.writeTo(out)
        assertTrue(out.size > actualBytes.size)
        // multipart field name unchanged
        assertTrue(out.readUtf8().contains("name=\"file\""))
    }

    @Test
    fun normalSizedStream_stillUploadsToEof() {
        val actualBytes = ByteArray(64) { (it % 7).toByte() }
        val body =
            SafRecordingUploadBody.fromStream("audio/mp4") {
                actualBytes.inputStream()
            }
        val sink = Buffer()
        body.writeTo(sink)
        assertEquals(64L, sink.size)
        assertArrayEquals(actualBytes, sink.readByteArray())
    }
}
