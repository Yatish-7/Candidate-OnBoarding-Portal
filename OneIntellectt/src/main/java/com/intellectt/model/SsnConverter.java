package com.intellectt.model;

import com.intellectt.security.FieldCipher;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Encrypts the SSN on its way into the database and decrypts it on the way out
 * (also for the audit history table). Hibernate creates this through Spring, which
 * supplies the {@link FieldCipher}.
 */
@Converter
public class SsnConverter implements AttributeConverter<String, String> {

    private final FieldCipher cipher;

    public SsnConverter(FieldCipher cipher) {
        this.cipher = cipher;
    }

    @Override
    public String convertToDatabaseColumn(String plain) {
        return cipher.encrypt(plain);
    }

    @Override
    public String convertToEntityAttribute(String stored) {
        return cipher.decrypt(stored);
    }
}
