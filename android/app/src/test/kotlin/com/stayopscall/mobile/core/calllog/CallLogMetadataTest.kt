package com.stayopscall.mobile.core.calllog

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import kotlin.math.abs

class RecordingFilenameParserTest {
    @Test
    fun parseContactNameFilename() {
        val parsed = RecordingFilenameParser.parse("통화 녹음 우성열 대표님_260605_183749.m4a")
        assertEquals("우성열 대표님", parsed.contactNameFromFilename)
        assertNull(parsed.filenamePhoneCandidate)
        assertEquals(
            1780652269000L,
            parsed.recordedAtFromFilename,
        )
    }

    @Test
    fun parseNumericFilename() {
        val parsed = RecordingFilenameParser.parse("통화 녹음 01012345678_260605_183749.m4a")
        assertNull(parsed.contactNameFromFilename)
        assertEquals("01012345678", parsed.filenamePhoneCandidate)
    }

    @Test
    fun parseInvalidFilename() {
        val parsed = RecordingFilenameParser.parse("random_audio.m4a")
        assertNull(parsed.recordedAtFromFilename)
        assertNull(parsed.contactNameFromFilename)
        assertNull(parsed.filenamePhoneCandidate)
    }
}

class CallLogMatcherSelectionTest {
    @Test
    fun prefersDurationOverCloserMiss() {
        val target = 1_000_000L
        val candidates = listOf(
            CallLogMatcher.CallLogCandidate(
                phoneNumber = "01011112222",
                normalizedPhone = "01011112222",
                direction = "inbound",
                date = target + 1_000,
                duration = 0,
                cachedName = null,
            ),
            CallLogMatcher.CallLogCandidate(
                phoneNumber = "01033334444",
                normalizedPhone = "01033334444",
                direction = "outbound",
                date = target + 60_000,
                duration = 30,
                cachedName = "테스트",
            ),
        )
        val best = CallLogMatcher.selectBestCandidate(candidates, target)
        assertEquals("01033334444", best?.normalizedPhone)
    }

    @Test
    fun picksClosestWithinWindow() {
        val target = 1_000_000L
        val candidates = listOf(
            CallLogMatcher.CallLogCandidate(
                phoneNumber = "0317576680",
                normalizedPhone = "0317576680",
                direction = "inbound",
                date = target + 120_000,
                duration = 10,
                cachedName = null,
            ),
            CallLogMatcher.CallLogCandidate(
                phoneNumber = "01099998888",
                normalizedPhone = "01099998888",
                direction = "inbound",
                date = target + 5_000,
                duration = 12,
                cachedName = null,
            ),
        )
        val best = CallLogMatcher.selectBestCandidate(candidates, target)
        assertEquals("01099998888", best?.normalizedPhone)
        assertEquals(5, abs((best?.date ?: 0) - target) / 1000)
    }
}
