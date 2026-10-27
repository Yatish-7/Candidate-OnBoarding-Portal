package com.intellectt.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.intellectt.model.User;
import com.intellectt.model.enums.Role;
import com.intellectt.repository.UserRepository;

/**
 * Seeds an initial Super Admin on first startup so the portal can be bootstrapped.
 * Credentials are configurable via {@code app.superadmin.*}; change the password
 * after the first login.
 */
@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String adminName;
    private final String adminEmail;
    private final String adminPassword;

    public DataInitializer(UserRepository userRepository, PasswordEncoder passwordEncoder,
            @Value("${app.superadmin.name:Super Admin}") String adminName,
            @Value("${app.superadmin.email:admin@intellectt.com}") String adminEmail,
            @Value("${app.superadmin.password:}") String adminPassword) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.adminName = adminName;
        this.adminEmail = adminEmail;
        this.adminPassword = adminPassword;
    }

    @Override
    public void run(String... args) {
        if (userRepository.existsByEmail(adminEmail)) {
            return;
        }
        // No built-in default password: a well-known one would be the first thing an attacker tries.
        if (adminPassword == null || adminPassword.isBlank()) {
            log.warn("No Super Admin exists and app.superadmin.password is not set; none was created."
                    + " Set it in secrets.properties or SUPERADMIN_PASSWORD and restart.");
            return;
        }
        User admin = new User();
        admin.setFullName(adminName);
        admin.setEmail(adminEmail);
        admin.setPassword(passwordEncoder.encode(adminPassword));
        admin.setRole(Role.SUPER_ADMIN);
        admin.setActive(true);
        userRepository.save(admin);
        log.info("Seeded initial Super Admin '{}'. Change the password after first login.", adminEmail);
    }
}
