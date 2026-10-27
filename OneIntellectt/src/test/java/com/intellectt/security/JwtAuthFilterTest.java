package com.intellectt.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.transaction.CannotCreateTransactionException;

import com.intellectt.model.User;
import com.intellectt.model.enums.Role;
import com.intellectt.service.SessionService;

import jakarta.servlet.FilterChain;

/**
 * Regression test from the 1000-user load test: when the database was overloaded,
 * the auth filter answered 401 — which the browser treats as "signed out" — so busy
 * moments kicked real users out. It must answer 503 ("busy, try again") instead.
 */
class JwtAuthFilterTest {

    private static final String SECRET = "a-test-only-secret-that-is-at-least-32-characters-long";

    @Test
    void anOverloadedDatabaseGives503NotASignOut() throws Exception {
        User user = new User();
        user.setId(7L);
        user.setEmail("busy@test.local");
        user.setPassword("x");
        user.setRole(Role.HR);
        user.setActive(true);

        JwtService jwt = new JwtService(SECRET, 3_600_000L);
        String token = jwt.generateToken(user, "session-1");

        CustomUserDetailsService users = mock(CustomUserDetailsService.class);
        when(users.loadUserByUsername("busy@test.local")).thenReturn(new AppUserPrincipal(user));
        SessionService sessions = mock(SessionService.class);
        when(sessions.check(any(), any()))
                .thenThrow(new CannotCreateTransactionException("Connection is not available, request timed out"));

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/candidates");
        request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        new JwtAuthFilter(jwt, users, sessions).doFilter(request, response, chain);

        assertEquals(503, response.getStatus());
        assertTrue(response.getContentAsString().contains("busy"));
        verifyNoInteractions(chain); // the request stops here; nothing downstream runs
    }

    @Test
    void aGarbageTokenIsStillTreatedAsSignedOut() throws Exception {
        JwtService jwt = new JwtService(SECRET, 3_600_000L);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/candidates");
        request.addHeader("Authorization", "Bearer not-a-token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        new JwtAuthFilter(jwt, mock(CustomUserDetailsService.class), mock(SessionService.class))
                .doFilter(request, response, new MockFilterChain());

        // Continues unauthenticated (the security chain then answers 401), with the reason recorded
        assertEquals(200, response.getStatus());
        assertEquals("INVALID", String.valueOf(request.getAttribute(JwtAuthFilter.AUTH_FAILURE_ATTR)));
    }
}
