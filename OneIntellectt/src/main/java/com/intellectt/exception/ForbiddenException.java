package com.intellectt.exception;

/** Thrown when the acting user lacks permission for an operation. */
public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
        super(message);
    }
}
