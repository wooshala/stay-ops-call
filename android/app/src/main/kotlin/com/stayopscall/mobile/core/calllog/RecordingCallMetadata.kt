package com.stayopscall.mobile.core.calllog

import android.content.Context
import com.stayopscall.mobile.data.local.entity.CallRecordingEntity

object RecordingCallMetadata {
    fun enrichEntity(context: Context, fileName: String, base: CallRecordingEntity): CallRecordingEntity {
        val parsed = RecordingFilenameParser.parse(fileName)
        var phoneNumber: String? = null
        var normalizedPhone: String? = null
        var direction: String? = null
        var contactName: String? = parsed.contactNameFromFilename
        var callLogMatchedAt: Long? = null
        var callLogMatchDeltaSec: Int? = null

        val targetMs = parsed.recordedAtFromFilename
        if (targetMs != null) {
            val match = CallLogMatcher.match(context, targetMs, contactName)
            if (match != null) {
                phoneNumber = match.phoneNumber
                normalizedPhone = match.normalizedPhone
                direction = match.direction
                callLogMatchedAt = match.callLogDate
                callLogMatchDeltaSec = match.callLogMatchDeltaSec
                if (contactName == null) contactName = match.contactName
            }
        }

        if (normalizedPhone == null && parsed.filenamePhoneCandidate != null) {
            normalizedPhone = parsed.filenamePhoneCandidate
            phoneNumber = parsed.filenamePhoneCandidate
        }

        return base.copy(
            phoneNumber = phoneNumber,
            normalizedPhone = normalizedPhone,
            direction = direction,
            contactName = contactName,
            recordedAtFromFilename = parsed.recordedAtFromFilename,
            callLogMatchedAt = callLogMatchedAt,
            callLogMatchDeltaSec = callLogMatchDeltaSec,
        )
    }

    fun resolveUploadPhone(entity: CallRecordingEntity): String? {
        return entity.normalizedPhone ?: entity.phoneNumber
    }
}
