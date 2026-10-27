package com.intellectt.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import com.intellectt.model.enums.SessionEndReason;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Answers 401 (not Spring's default 403) when a request isn't signed in, with the
 * reason the session ended, e.g.
 * {"status":401,"reason":"IDLE_TIMEOUT","message":"You were signed out after ..."}.
 * The frontend sends the user to the login page and shows the message.
 */
@Component
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
            AuthenticationException authException) throws IOException {
        Object attr = request.getAttribute(JwtAuthFilter.AUTH_FAILURE_ATTR);
        SessionEndReason reason = attr instanceof SessionEndReason r ? r : SessionEndReason.INVALID;

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        // Fixed, known strings only — no user input — so plain formatting is safe.
        response.getWriter().write("{\"status\":401,\"error\":\"Unauthorized\",\"reason\":\"" + reason.name()
                + "\",\"message\":\"" + reason.getMessage() + "\",\"timestamp\":\"" + Instant.now() + "\"}");
    }
}
