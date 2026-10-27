package com.intellectt.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Only company email ids can have an account or sign in (the test profile allows test.local and intellectt.com). */
class EmailDomainApiTest extends ApiTestSupport {

    @Test
    @DisplayName("Accounts can't be created or changed to a personal / other-domain email")
    void accountsNeedACompanyEmail() {
        String sa = admin();
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("fullName", "Someone");
        body.put("password", PASSWORD);
        body.put("role", "HR");
        body.put("email", uniq("p") + "@gmail.com");
        Res bad = post("/api/users", sa, body);
        assertEquals(400, bad.status());
        assertTrue(bad.text("message").contains("company email"));

        body.put("email", uniq("sub") + "@mail.test.local"); // a sub-domain doesn't count
        assertEquals(400, post("/api/users", sa, body).status());

        body.put("email", uniq("ok") + "@TEST.local"); // domain match ignores case
        Res ok = post("/api/users", sa, body);
        assertEquals(200, ok.status());

        // changing an existing account to another domain is refused too
        Map<String, Object> edit = new java.util.LinkedHashMap<>();
        edit.put("fullName", "Someone");
        edit.put("email", uniq("moved") + "@gmail.com");
        edit.put("role", "HR");
        edit.put("active", true);
        assertEquals(400, put("/api/users/" + ok.id(), sa, edit).status());
    }

    @Test
    @DisplayName("Signing in with another domain says to use the correct company email id")
    void loginMessage() {
        Res other = post("/api/auth/login", null, Map.of("email", "someone@gmail.com", "password", "Whatever1"));
        assertEquals(400, other.status());
        assertTrue(other.text("message").contains("correct company email id"));
        // a company address with the wrong password is still the ordinary sign-in failure
        Res wrong = post("/api/auth/login", null, Map.of("email", uniq("nobody") + "@test.local", "password", "Whatever1"));
        assertTrue(wrong.status() == 401 || wrong.status() == 403, "got " + wrong.status());
    }
}
