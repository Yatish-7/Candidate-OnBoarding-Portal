package com.intellectt.exception;

/** Thrown when a requested entity (user, team, candidate) does not exist. */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
