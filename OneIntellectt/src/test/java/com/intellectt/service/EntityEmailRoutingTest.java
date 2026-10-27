package com.intellectt.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Properties;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.PropertiesLoaderUtils;
import org.springframework.mail.javamail.JavaMailSender;

import com.intellectt.config.EntityMailProperties;
import com.intellectt.model.User;
import com.intellectt.model.enums.Role;
import com.intellectt.repository.UserRepository;

/**
 * Checks who each workflow email is routed to, using the REAL
 * application.properties (bound the same way Spring Boot does). No email is
 * sent: we only ask the service for its recipient list.
 */
class EntityEmailRoutingTest {

    /** The entity → domain list the business asked for. */
    private static final Map<String, String> EXPECTED_DOMAINS = Map.of(
            "novozen", "novozen.com",
            "revereit", "revereit.com",
            "premierlifesciences", "premierlifesciences.com",
            "unitedpharmatechnologies", "unitedpharmatechnologies.com",
            "kennedysoft", "kennedysoft.com",
            "shoolin-inc", "shoolin-inc.com",
            "lumininc", "lumininc.com",
            "lumin-innovation", "lumin-innovations.com",
            "kkrconsulting", "kkrconsulting.com",
            "ubitz", "ubitz.ai");

    private UserRepository users;
    private EmailService self;
    private EmailServiceImpl service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() throws Exception {
        Properties props = PropertiesLoaderUtils.loadProperties(new ClassPathResource("application.properties"));
        // These tests are about the real routing; the testing-mode switches in application.properties are off here
        props.setProperty("app.entity-mail.mailbox-routing", "true");
        props.remove("app.entity-mail.super-admin-address");
        EntityMailProperties entityMail = new Binder(new MapConfigurationPropertySource(props))
                .bind("app.entity-mail", EntityMailProperties.class)
                .orElseThrow(() -> new AssertionError("app.entity-mail is not configured"));

        users = mock(UserRepository.class);
        self = mock(EmailService.class); // stands in for the async sender — nothing is sent
        service = new EmailServiceImpl(mock(ObjectProvider.class), users, entityMail, "from@test", self);

        // Portal users, only used by the fallback path
        when(users.findByRole(Role.HR)).thenReturn(List.of(user("hr.person@portal.test")));
        when(users.findByRole(Role.SUPER_ADMIN)).thenReturn(List.of(user("admin@intellectt.com")));
        when(users.findByRole(Role.PAYROLL)).thenReturn(List.of(user("payroll.person@portal.test")));
    }

    @Test
    void salesLeadApprovalGoesToTheEntityMailboxesForEveryEntity() {
        for (Map.Entry<String, String> e : EXPECTED_DOMAINS.entrySet()) {
            String d = e.getValue();
            List<String> to = service.stageRecipients(e.getKey(),
                    List.of(Role.HR, Role.CONTRACTS, Role.ACCOUNTS, Role.PAYROLL), List.of());
            assertEquals(List.of("hr@" + d, "contracts@" + d, "accounts@" + d, "payroll@" + d, "superadmin@" + d), to,
                    "wrong recipients for entity " + e.getKey());
        }
        verifyNoInteractions(self); // routing only — nothing was sent
    }

    @Test
    void novozenExampleFromTheRequest() {
        List<String> to = service.stageRecipients("novozen",
                List.of(Role.HR, Role.CONTRACTS, Role.ACCOUNTS, Role.PAYROLL), List.of());
        assertTrue(to.containsAll(List.of("hr@novozen.com", "payroll@novozen.com", "accounts@novozen.com",
                "contracts@novozen.com", "superadmin@novozen.com")));
        assertEquals(5, to.size());
    }

    @Test
    void individualPeopleAreStillEmailedDirectly() {
        // e.g. a decline goes to the Sales Lead, copying the entity's Super Admin
        List<String> to = service.stageRecipients("ubitz", List.of(), List.of(user("lead@intellectt.com")));
        assertEquals(List.of("lead@intellectt.com", "superadmin@ubitz.ai"), to);
    }

    @Test
    void entityValueIsMatchedCaseInsensitively() {
        assertEquals(List.of("payroll@kennedysoft.com", "superadmin@kennedysoft.com"),
                service.stageRecipients("  KennedySoft ", List.of(Role.PAYROLL), List.of()));
    }

    @Test
    void noEntityFallsBackToPortalUsers() {
        assertEquals(List.of("hr.person@portal.test", "admin@intellectt.com"),
                service.stageRecipients(null, List.of(Role.HR), List.of()));
    }

    @Test
    void unknownEntityFallsBackToPortalUsers() {
        assertEquals(List.of("payroll.person@portal.test", "admin@intellectt.com"),
                service.stageRecipients("not-a-real-entity", List.of(Role.PAYROLL), List.of()));
    }

    @Test
    void severalEntitiesGetOneEmailWithEveryMailboxAndThePeopleOnce() {
        // internal entity novozen + payroll company kennedysoft: hr@ at both, people once
        service.notifyStage(List.of("novozen", "kennedysoft"), List.of(Role.HR), List.of(user("lead@intellectt.com")),
                "subject", "body");
        verify(self).send(List.of("lead@intellectt.com", "hr@novozen.com", "superadmin@novozen.com",
                "hr@kennedysoft.com", "superadmin@kennedysoft.com"), "subject", "body");
    }

    @Test
    void sameEntityTwiceDoesNotDuplicateAddresses() {
        service.notifyStage(List.of("novozen", "novozen"), List.of(Role.HR), List.of(), "s", "b");
        verify(self).send(List.of("hr@novozen.com", "superadmin@novozen.com"), "s", "b");
    }

    @Test
    void testingModeIgnoresEntityMailboxesAndUsesTheRoleUsersAndOneSuperAdminAddress() {
        EntityMailProperties testing = new EntityMailProperties();
        testing.getDomains().put("novozen", "novozen.com");
        testing.getMailboxes().put("hr", "hr");
        testing.setMailboxRouting(false);
        testing.setSuperAdminAddress("yatish@emscale.com");
        EmailServiceImpl svc = new EmailServiceImpl(mock(ObjectProvider.class), users, testing, "from@test", self);

        // HR at novozen: the HR user's own address, never hr@novozen.com; Super Admin copy → the one address
        assertEquals(List.of("lead@intellectt.com", "hr.person@portal.test", "yatish@emscale.com"),
                svc.stageRecipients("novozen", List.of(Role.HR), List.of(user("lead@intellectt.com"))));
        // a different entity makes no difference
        assertEquals(List.of("hr.person@portal.test", "payroll.person@portal.test", "yatish@emscale.com"),
                svc.stageRecipients("kennedysoft", List.of(Role.HR, Role.PAYROLL), List.of()));
    }

    private static User user(String email) {
        User u = new User();
        u.setEmail(email);
        u.setActive(true);
        return u;
    }
}
