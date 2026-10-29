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

import jakarta.mail.internet.AddressException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;

@Service
public class EmailServiceImpl implements EmailService {

    private static final Logger log =
            LoggerFactory.getLogger(EmailServiceImpl.class);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final UserRepository userRepository;
    private final EntityMailProperties entityMail;
    private final String fromAddress;
    private final EmailService self;

    public EmailServiceImpl(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            UserRepository userRepository,
            EntityMailProperties entityMail,
            @Value("${app.mail.from:no-reply@intellectt.com}")
            String fromAddress,
            @Lazy EmailService self) {

        this.mailSenderProvider = mailSenderProvider;
        this.userRepository = userRepository;
        this.entityMail = entityMail;
        this.fromAddress = fromAddress;
        this.self = self;
    }

    @Override
    public void notifyStage(
            String internalEntity,
            Collection<Role> roles,
            Collection<User> users,
            String subject,
            String body) {

        self.send(
                stageRecipients(internalEntity, roles, users),
                subject,
                body);
    }

    @Override
    public void notifyStage(
            Collection<String> internalEntities,
            Collection<Role> roles,
            Collection<User> users,
            String subject,
            String body) {

        Set<String> recipients = new LinkedHashSet<>();
        boolean first = true;

        for (String entity : internalEntities) {
            recipients.addAll(
                    stageRecipients(
                            entity,
                            roles,
                            first ? users : List.of()));

            first = false;
        }

        self.send(new ArrayList<>(recipients), subject, body);
    }

    /**
     * Resolves email recipients for a workflow stage.
     */
    List<String> stageRecipients(
            String internalEntity,
            Collection<Role> roles,
            Collection<User> users) {

        Set<String> recipients = new LinkedHashSet<>();

        if (users != null) {
            users.stream()
                    .filter(Objects::nonNull)
                    .map(User::getEmail)
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(email -> !email.isBlank())
                    .forEach(recipients::add);
        }

        List<Role> rolesWithSuperAdmin =
                new ArrayList<>(roles == null ? List.of() : roles);

        rolesWithSuperAdmin.add(Role.SUPER_ADMIN);

        boolean viaMailboxes = entityMail.isMailboxRouting();
        String superAdminOverride = entityMail.getSuperAdminAddress();

        boolean entityConfigured =
                entityMail.domainFor(internalEntity) != null;

        if (viaMailboxes
                && internalEntity != null
                && !internalEntity.isBlank()
                && !entityConfigured) {

            log.warn(
                    "No email domain configured for placement entity '{}'. "
                    + "Falling back to portal users who hold the roles.",
                    internalEntity);
        }

        for (Role role : rolesWithSuperAdmin) {

            if (role == Role.SUPER_ADMIN
                    && superAdminOverride != null
                    && !superAdminOverride.isBlank()) {

                recipients.add(superAdminOverride.trim());
                continue;
            }

            if (!viaMailboxes) {
                activeEmails(role).forEach(recipients::add);
                continue;
            }

            String entityAddress =
                    entityConfigured
                            ? entityMail.addressFor(internalEntity, role)
                            : null;

            if (entityAddress != null
                    && !entityAddress.isBlank()) {

                recipients.add(entityAddress.trim());
            } else {
                activeEmails(role).forEach(recipients::add);
            }
        }

        return new ArrayList<>(recipients);
    }

    private List<String> activeEmails(Role role) {
        return userRepository.findByRole(role)
                .stream()
                .filter(User::isActive)
                .map(User::getEmail)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(email -> !email.isBlank())
                .collect(Collectors.toList());
    }

    @Override
    public void notifyUserOnly(
            User user,
            String subject,
            String body) {

        if (user != null
                && user.getEmail() != null
                && !user.getEmail().isBlank()) {

            self.send(
                    List.of(user.getEmail().trim()),
                    subject,
                    body);
        }
    }

    /**
     * Removes invalid addresses before attempting SMTP delivery.
     */
    private List<String> validRecipients(List<String> recipients) {

        if (recipients == null || recipients.isEmpty()) {
            return List.of();
        }

        Set<String> valid = new LinkedHashSet<>();

        for (String recipient : recipients) {

            if (recipient == null) {
                continue;
            }

            String email = recipient.trim();

            if (email.isBlank()) {
                continue;
            }

            try {
                InternetAddress address =
                        new InternetAddress(email);

                address.validate();

                // Reject display-name forms or strings that JavaMail
                // would otherwise interpret as something other than
                // a plain email address.
                if (!email.equals(address.getAddress())) {
                    log.warn(
                            "Skipping malformed email recipient: [{}]",
                            email);
                    continue;
                }

                valid.add(email);

            } catch (AddressException ex) {
                log.warn(
                        "Skipping invalid email recipient: [{}]. Reason: {}",
                        email,
                        ex.getMessage());
            }
        }

        return new ArrayList<>(valid);
    }

    @Override
    @Async("mailExecutor")
    public void send(
            List<String> recipients,
            String subject,
            String body) {

        List<String> validTo = validRecipients(recipients);

        if (validTo.isEmpty()) {
            log.warn(
                    "No valid recipients for email '{}'; skipping.",
                    subject);
            return;
        }

        JavaMailSender sender =
                mailSenderProvider.getIfAvailable();

        if (sender == null) {
            log.info(
                    "[EMAIL NOT SENT: no SMTP configured] "
                    + "to={} | subject={}",
                    validTo,
                    subject);
            return;
        }

        try {
            MimeMessage message =
                    sender.createMimeMessage();

            MimeMessageHelper helper =
                    new MimeMessageHelper(
                            message,
                            false,
                            "UTF-8");

            helper.setFrom(fromAddress);
            helper.setTo(validTo.toArray(new String[0]));

            helper.setSubject(
                    subject == null
                            ? ""
                            : subject.replaceAll("[\\r\\n]+", " "));

            helper.setText(body, true);

            sender.send(message);

            log.info(
                    "Email sent successfully to {} | subject={}",
                    validTo,
                    subject);

        } catch (Exception ex) {
            log.error(
                    "Failed to send email '{}' to {}",
                    subject,
                    validTo,
                    ex);
        }
    }
}