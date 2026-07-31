package com.stayopscall.mobile.core.calllog

import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

data class ParsedRecordingFilename(
    val recordedAtFromFilename: Long?,
    val contactNameFromFilename: String?,
    val filenamePhoneCandidate: String?,
)

/**
 * Samsung call recording filenames, e.g.
 * - 통화 녹음 우성열 대표님_260605_183749.m4a
 * - 통화 녹음 01012345678_260605_183749.m4a
 */
object RecordingFilenameParser {
    private val KST = ZoneId.of("Asia/Seoul")
    private val TIMESTAMP_SUFFIX = Regex("""_(\d{6})_(\d{6})(?:\.[^.]+)?$""")
    private val PHONE_LIKE = Regex("""^[\d+\-\s().]+$""")

    fun parse(fileName: String): ParsedRecordingFilename {
        val match = TIMESTAMP_SUFFIX.find(fileName.trim())
            ?: return ParsedRecordingFilename(null, null, null)

        val (yymmdd, hhmmss) = match.destructured
        val recordedAt = parseTimestamp(yymmdd, hhmmss)
        val identifier = extractIdentifier(fileName.substring(0, match.range.first))

        val phoneCandidate = identifier
            ?.takeIf { isPhoneLike(it) }
            ?.let { PhoneNormalizer.normalize(it) }

        val contactName = identifier
            ?.takeIf { phoneCandidate == null }
            ?.trim()
            ?.takeIf { it.isNotEmpty() }

        return ParsedRecordingFilename(recordedAt, contactName, phoneCandidate)
    }

    private fun extractIdentifier(prefix: String): String? {
        val trimmed = prefix.trim()
        val withoutPrefix = trimmed
            .removePrefix("통화 녹음")
            .removePrefix("통화녹음")
            .trim()
        return withoutPrefix.ifEmpty { null }
    }

    private fun isPhoneLike(value: String): Boolean {
        val t = value.trim()
        if (t.isEmpty()) return false
        if (!PHONE_LIKE.matches(t)) return false
        val digits = PhoneNormalizer.normalize(t) ?: return false
        return digits.length >= 9
    }

    internal fun parseTimestamp(yymmdd: String, hhmmss: String): Long? {
        if (yymmdd.length != 6 || hhmmss.length != 6) return null
        return runCatching {
            val yy = yymmdd.substring(0, 2).toInt()
            val mm = yymmdd.substring(2, 4).toInt()
            val dd = yymmdd.substring(4, 6).toInt()
            val hh = hhmmss.substring(0, 2).toInt()
            val min = hhmmss.substring(2, 4).toInt()
            val ss = hhmmss.substring(4, 6).toInt()
            val date = LocalDate.of(2000 + yy, mm, dd)
            val time = LocalTime.of(hh, min, ss)
            date.atTime(time).atZone(KST).toInstant().toEpochMilli()
        }.getOrNull()
    }
}
