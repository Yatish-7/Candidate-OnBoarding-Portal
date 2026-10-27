package com.intellectt.exception;

/** Thrown for invalid input or an action that is not allowed in the current state. */
public class BadRequestException extends RuntimeException {
    public BadRequestException(String message) {
        super(message);
    }
}
