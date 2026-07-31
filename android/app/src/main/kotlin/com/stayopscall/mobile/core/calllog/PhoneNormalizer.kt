package com.stayopscall.mobile.core.calllog

object PhoneNormalizer {
    fun normalize(input: String?): String? {
        if (input.isNullOrBlank()) return null
        val digits = input.replace(Regex("\\D"), "")
        return digits.ifEmpty { null }
    }
}
