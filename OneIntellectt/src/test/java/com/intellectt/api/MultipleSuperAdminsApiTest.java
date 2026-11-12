package com.intellectt.api;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** A Super Admin can create another Super Admin; an Admin can't. The new one sees everything. */
class MultipleSuperAdminsApiTest extends ApiTestSupport {

    @Test
    @DisplayName("A Super Admin creates a second Super Admin who can sign in and see every candidate")
    void superAdminCreatesSuperAdmin() {
        String sa = admin();
        TeamSetup ts = newTeam(sa);
        long candidate = submitCandidate(login(ts.recruiter()));

        Account second = createUser(sa, "SUPER_ADMIN", null);
        String token = login(second);
        assertEquals(200, get("/api/candidates/" + candidate, token).status());
        assertEquals(200, get("/api/users", token).status());
        // and can create users too
        createUser(token, "HR", null);
    }

    @Test
    @DisplayName("An Admin can't create, promote to, or edit a Super Admin")
    void adminCannotTouchSuperAdmins() {
        String sa = admin();
        Account superAdmin = createUser(sa, "SUPER_ADMIN", null);
        String adminToken = login(createUser(sa, "ADMIN", null));

        Res r = post("/api/users", adminToken, Map.of("fullName", "Sneaky", "email", "sneaky-" + System.nanoTime() + "@test.local",
                "password", "Passw0rd!x", "role", "SUPER_ADMIN"));
        assertEquals(403, r.status());
        assertEquals(403, put("/api/users/" + superAdmin.id(), adminToken, Map.of("fullName", "Changed", "role", "HR", "active", true)).status());
    }
}
