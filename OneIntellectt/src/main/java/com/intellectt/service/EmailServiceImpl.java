package com.intellectt.service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.intellectt.config.EntityMailProperties;
import com.intellectt.model.User;
import com.intellectt.model.enums.Role;
import com.intellectt.repository.UserRepository;

import jakarta.mail.internet.MimeMessage;

/**
 * Sends HTML notification emails. Recipient addresses are resolved on the calling
 * (request) thread while the DB session is still open — only the SMTP send runs
 * asynchronously (via {@link #send}, reached through the {@code self} proxy so
 * the {@code @Async} boundary isn't bypassed by a self-call). If no SMTP sender
 * is configured the message is logged instead, so the workflow never breaks.
 */
@Service
public class EmailServiceImpl implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailServiceImpl.class);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final UserRepository userRepository;
    private final EntityMailProperties entityMail;
    private final String fromAddress;
    private final EmailService self;

    public EmailServiceImpl(ObjectProvider<JavaMailSender> mailSenderProvider,
            UserRepository userRepository, EntityMailProperties entityMail,
            @Value("${app.mail.from:no-reply@intellectt.com}") String fromAddress,
            @Lazy EmailService self) {
        this.mailSenderProvider = mailSenderProvider;
        this.userRepository = userRepository;
        this.entityMail = entityMail;
        this.fromAddress = fromAddress;
        this.self = self;
    }

    @Override
    public void notifyStage(String internalEntity, Collection<Role> roles, Collection<User> users,
            String subject, String body) {
        self.send(stageRecipients(internalEntity, roles, users), subject, body);
    }

    @Override
    public void notifyStage(Collection<String> internalEntities, Collection<Role> roles, Collection<User> users,
            String subject, String body) {
        Set<String> to = new LinkedHashSet<>();
        boolean first = true;
        for (String entity : internalEntities) {
            // the people are added once, with the first entity
            to.addAll(stageRecipients(entity, roles, first ? users : List.of()));
            first = false;
        }
        self.send(new ArrayList<>(to), subject, body);
    }

    /**
     * Who gets a stage email. Package-visible so the routing can be unit-tested
     * without sending anything.
     */
    List<String> stageRecipients(String internalEntity, Collection<Role> roles, Collection<User> users) {
        // LinkedHashSet keeps a stable order and drops duplicates
        Set<String> to = new LinkedHashSet<>();
        if (users != null) {
            users.stream().filter(Objects::nonNull).map(User::getEmail).filter(Objects::nonNull).forEach(to::add);
        }

        // The Super Admin has full oversight, so it is copied on every stage email.
        List<Role> withSuperAdmin = new ArrayList<>(roles == null ? List.of() : roles);
        withSuperAdmin.add(Role.SUPER_ADMIN);

        boolean viaMailboxes = entityMail.isMailboxRouting();
        String superAdminOverride = entityMail.getSuperAdminAddress();
        boolean entityConfigured = entityMail.domainFor(internalEntity) != null;
        if (viaMailboxes && internalEntity != null && !internalEntity.isBlank() && !entityConfigured) {
            log.warn("No email domain configured for placement entity '{}' (app.entity-mail.domains); "
                    + "falling back to the portal users who hold the roles", internalEntity);
        }
        for (Role role : withSuperAdmin) {
            if (role == Role.SUPER_ADMIN && superAdminOverride != null && !superAdminOverride.isBlank()) {
                to.add(superAdminOverride.trim()); // one fixed address for every Super Admin copy
                continue;
            }
            if (!viaMailboxes) {
                activeEmails(role).forEach(to::add); // testing mode: the users who hold the role
                continue;
            }
            String entityAddress = entityConfigured ? entityMail.addressFor(internalEntity, role) : null;
            if (entityAddress != null) {
                to.add(entityAddress); // e.g. hr@novozen.com
            } else {
                activeEmails(role).forEach(to::add); // fallback: users holding the role
            }
        }
        return new ArrayList<>(to);
    }

    private List<String> activeEmails(Role role) {
        return userRepository.findByRole(role).stream()
                .filter(User::isActive)
                .map(User::getEmail)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    @Override
    public void notifyUserOnly(User user, String subject, String body) {
        if (user != null && user.getEmail() != null) {
            self.send(List.of(user.getEmail()), subject, body);
        }
    }

    @Override
    @Async("mailExecutor")
    public void send(List<String> recipients, String subject, String body) {
        if (recipients == null || recipients.isEmpty()) {
            log.debug("No recipients for email '{}'; skipping.", subject);
            return;
        }

        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null) {
            // Never log the body: it can hold a password-reset link or candidate details.
            log.info("[EMAIL - not sent, no SMTP configured] to={} | subject={}", recipients, subject);
            return;
        }

        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(recipients.toArray(new String[0]));
            helper.setSubject(subject == null ? "" : subject.replaceAll("[\r\n]+", " ")); // no header injection
            helper.setText(body, true); // true = HTML body
            sender.send(message);
            log.info("Email sent to {} | subject={}", recipients, subject);
        } catch (Exception ex) {
            log.error("Failed to send email '{}' to {}: {}", subject, recipients, ex.getMessage());
        }
    }
}
