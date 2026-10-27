package com.intellectt.service;

import java.util.List;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.intellectt.exception.BadRequestException;
import com.intellectt.exception.ForbiddenException;
import com.intellectt.exception.ResourceNotFoundException;
import com.intellectt.model.ApprovalAction;
import com.intellectt.model.Team;
import com.intellectt.model.User;
import com.intellectt.model.enums.Role;
import com.intellectt.model.enums.SessionEndReason;
import com.intellectt.repository.ApprovalActionRepository;
import com.intellectt.repository.CandidateRepository;
import com.intellectt.repository.PasswordResetTokenRepository;
import com.intellectt.repository.TeamRepository;
import com.intellectt.repository.UserRepository;

/**
 * <ul>
 *   <li>Super Admin can manage any user.</li>
 *   <li>Admin can manage any user except a Super Admin (no candidate access).</li>
 *   <li>HR can create/remove Recruiters and Sales Leads.</li>
 *   <li>Sales Lead can create/remove Recruiters (and manage their own team).</li>
 * </ul>
 * "Deleting" a user deactivates the account so the approval trail is preserved.
 */
@Service
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final CandidateRepository candidateRepository;
    private final ApprovalActionRepository approvalActionRepository;
    private final PasswordEncoder passwordEncoder;
    private final SessionService sessionService;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final AllowedEmailDomains emailDomains;

    public UserServiceImpl(UserRepository userRepository, TeamRepository teamRepository,
            CandidateRepository candidateRepository, ApprovalActionRepository approvalActionRepository,
            PasswordEncoder passwordEncoder, SessionService sessionService,
            PasswordResetTokenRepository resetTokenRepository, AllowedEmailDomains emailDomains) {
        this.userRepository = userRepository;
        this.teamRepository = teamRepository;
        this.candidateRepository = candidateRepository;
        this.approvalActionRepository = approvalActionRepository;
        this.passwordEncoder = passwordEncoder;
        this.sessionService = sessionService;
        this.resetTokenRepository = resetTokenRepository;
        this.emailDomains = emailDomains;
    }

    @Override
    @Transactional
    public User createUser(User input, User actor) {
        if (input.getRole() == null) {
            throw new BadRequestException("Role is required");
        }
        if (input.getFullName() == null || input.getFullName().isBlank()) {
            throw new BadRequestException("Full name is required");
        }
        input.setEmail(CredentialRules.checkEmail(input.getEmail()));
        emailDomains.requireAllowed(input.getEmail());
        CredentialRules.checkPassword(input.getPassword());
        assertCanManage(actor, input.getRole());

        if (userRepository.existsByEmail(input.getEmail())) {
            throw new BadRequestException("A user with email " + input.getEmail() + " already exists");
        }

        Team team = resolveTeam(input, actor);

        User user = new User();
        user.setFullName(input.getFullName());
        user.setEmail(input.getEmail());
        user.setPassword(passwordEncoder.encode(input.getPassword()));
        user.setMustChangePassword(true); // the admin chose it, so the user must replace it on first sign-in
        user.setRole(input.getRole());
        user.setLocation(input.getRole() == Role.RECRUITER ? checkLocation(input.getLocation()) : null);
        user.setTeam(team);
        user.setActive(true);
        user = userRepository.save(user);

        // A team's sales lead points back to the team.
        if (input.getRole() == Role.SALES_LEAD && team != null && team.getSalesLead() == null) {
            team.setSalesLead(user);
            teamRepository.save(team);
        }
        return user;
    }

    private Team resolveTeam(User input, User actor) {
        // Only the Super Admin / an Admin get here (assertCanManage); they may use any team.
        Long teamId = (input.getTeam() != null) ? input.getTeam().getId() : null;
        if (teamId != null) {
            return teamRepository.findById(teamId)
                    .orElseThrow(() -> new ResourceNotFoundException("Team not found: " + teamId));
        }
        return null;
    }

    @Override
    @Transactional
    public User updateUser(Long id, User input, User actor) {
        User target = getById(id);
        // The actor must be allowed to manage the target's CURRENT role.
        assertCanManage(actor, target.getRole());

        boolean self = target.getId().equals(actor.getId());

        if (input.getFullName() != null && !input.getFullName().isBlank()) {
            target.setFullName(input.getFullName());
        }

        if (input.getEmail() != null && !input.getEmail().isBlank()) {
            input.setEmail(CredentialRules.checkEmail(input.getEmail()));
            emailDomains.requireAllowed(input.getEmail());
        }
        // Email must stay unique if it is being changed.
        if (input.getEmail() != null && !input.getEmail().isBlank()
                && !input.getEmail().equalsIgnoreCase(target.getEmail())) {
            if (userRepository.existsByEmail(input.getEmail())) {
                throw new BadRequestException("A user with email " + input.getEmail() + " already exists");
            }
            target.setEmail(input.getEmail());
        }

        // Role change: nobody may change their own role, and the actor must also be
        // allowed to manage the NEW role (e.g. an Admin can't promote anyone to Super Admin).
        if (input.getRole() != null && input.getRole() != target.getRole()) {
            if (self) {
                throw new BadRequestException("You cannot change your own role");
            }
            assertCanManage(actor, input.getRole());
            target.setRole(input.getRole());
        }

        // Only team-bound roles keep a team; everyone else is organisation-wide.
        Team team = resolveTeam(input, actor);
        if (target.getRole() != Role.RECRUITER && target.getRole() != Role.SALES_LEAD) {
            team = null;
        }

        // A user who stops being a Sales Manager no longer oversees any team.
        if (target.getRole() != Role.SALES_MANAGER) {
            releaseManagedTeams(target);
        }

        // If this user currently leads a team and is leaving that team or the
        // Sales Lead role, detach the old lead link so it isn't left dangling.
        Team oldLedTeam = teamRepository.findBySalesLead(target).orElse(null);
        if (oldLedTeam != null) {
            boolean stillLeadsSame = target.getRole() == Role.SALES_LEAD
                    && team != null && team.getId().equals(oldLedTeam.getId());
            if (!stillLeadsSame) {
                oldLedTeam.setSalesLead(null);
                teamRepository.save(oldLedTeam);
            }
        }

        target.setTeam(team);
        // only recruiters have a location
        target.setLocation(target.getRole() == Role.RECRUITER ? checkLocation(input.getLocation()) : null);

        if (self && !input.isActive()) {
            throw new BadRequestException("You cannot deactivate your own account");
        }
        boolean deactivating = target.isActive() && !input.isActive();
        target.setActive(input.isActive());
        if (deactivating) {
            // Sign them out everywhere right away, not when their token happens to expire.
            sessionService.endAll(target, SessionEndReason.ACCOUNT_DEACTIVATED);
        }

        // Optional password reset — not exposed in the UI yet, but honoured if sent.
        if (input.getPassword() != null && !input.getPassword().isBlank()) {
            CredentialRules.checkPassword(input.getPassword());
            target.setPassword(passwordEncoder.encode(input.getPassword()));
            target.setMustChangePassword(true);
            sessionService.endAll(target, SessionEndReason.PASSWORD_RESET);
        }

        target = userRepository.save(target);

        // A Sales Lead joining a team that has no lead becomes that team's lead.
        if (target.getRole() == Role.SALES_LEAD && team != null && team.getSalesLead() == null) {
            team.setSalesLead(target);
            teamRepository.save(team);
        }
        return target;
    }

    @Override
    @Transactional
    public void deactivateUser(Long id, User actor) {
        User target = getById(id);
        assertCanManage(actor, target.getRole());
        if (target.getId().equals(actor.getId())) {
            throw new BadRequestException("You cannot deactivate your own account");
        }
        target.setActive(false);
        sessionService.endAll(target, SessionEndReason.ACCOUNT_DEACTIVATED);
        userRepository.save(target);
        releaseManagedTeams(target); // an inactive manager can't approve; the teams fall back to their leads
    }

    @Override
    @Transactional
    public void deleteUser(Long id, User actor) {
        // Only the Super Admin or an Admin can permanently delete a user.
        if (actor.getRole() != Role.SUPER_ADMIN && actor.getRole() != Role.ADMIN) {
            throw new ForbiddenException("Only the Super Admin or an Admin can permanently delete a user");
        }
        User target = getById(id);
        // An Admin may not delete a Super Admin.
        if (actor.getRole() == Role.ADMIN && target.getRole() == Role.SUPER_ADMIN) {
            throw new ForbiddenException("An Admin cannot delete a Super Admin");
        }
        if (target.getId().equals(actor.getId())) {
            throw new BadRequestException("You cannot delete your own account");
        }

        // A user who submitted candidates can't be removed without orphaning those
        // records (submittedBy is required). Deactivate them instead.
        long submitted = candidateRepository.countBySubmittedBy(target);
        if (submitted > 0) {
            throw new BadRequestException("Cannot permanently delete " + target.getFullName()
                    + ": they have submitted " + submitted + " candidate(s). Deactivate them instead, "
                    + "or remove their candidates first.");
        }

        // Detach the user from anything that references them, then delete.
        teamRepository.findBySalesLead(target).ifPresent(team -> {
            team.setSalesLead(null);
            teamRepository.save(team);
        });
        releaseManagedTeams(target);
        List<ApprovalAction> actions = approvalActionRepository.findByActor(target);
        for (ApprovalAction action : actions) {
            action.setActor(null); // keep the trail entry, drop the actor link
        }
        approvalActionRepository.saveAll(actions);

        // Rows that reference the user must go first, or the delete fails on a foreign key.
        sessionService.deleteAll(target);
        resetTokenRepository.deleteAll(resetTokenRepository.findByUser(target));
        userRepository.delete(target);
    }

    @Override
    @Transactional(readOnly = true)
    public List<User> listVisibleUsers(User actor) {
        return switch (actor.getRole()) {
            case SUPER_ADMIN, ADMIN -> userRepository.findAll();
            case SALES_LEAD -> actor.getTeam() == null ? List.of() : userRepository.findByTeam(actor.getTeam());
            case SALES_MANAGER -> teamRepository.findBySalesManager(actor).stream()
                    .flatMap(t -> userRepository.findByTeam(t).stream()).toList();
            default -> throw new ForbiddenException("You are not allowed to list users");
        };
    }

    @Override
    @Transactional(readOnly = true)
    public List<User> findByRole(Role role, User actor) {
        boolean allowed = switch (actor.getRole()) {
            case SUPER_ADMIN, ADMIN -> true;
            // A Sales Lead picks recruiters for their team
            case SALES_LEAD, SALES_MANAGER -> role == Role.RECRUITER || role == Role.SALES_LEAD;
            default -> false;
        };
        if (!allowed) {
            throw new ForbiddenException("You are not allowed to list these users");
        }
        return userRepository.findByRole(role);
    }

    @Override
    @Transactional(readOnly = true)
    public User getById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));
    }

    /** Blank → none; otherwise it must be one of the recruiter offices. */
    private String checkLocation(String location) {
        if (location == null || location.isBlank()) {
            return null;
        }
        if (!CandidateServiceImpl.RECRUITER_LOCATIONS.contains(location)) {
            throw new BadRequestException("Location must be one of: "
                    + String.join(", ", CandidateServiceImpl.RECRUITER_LOCATIONS));
        }
        return location;
    }

    /** Takes every team off a Sales Manager (they changed role, were deactivated or deleted). */
    private void releaseManagedTeams(User manager) {
        List<Team> teams = teamRepository.findBySalesManager(manager);
        for (Team t : teams) {
            t.setSalesManager(null);
        }
        teamRepository.saveAll(teams);
    }

    /** Whether {@code actor} may create or remove a user of {@code targetRole}. */
    private void assertCanManage(User actor, Role targetRole) {
        Role r = actor.getRole();
        boolean allowed = switch (r) {
            case SUPER_ADMIN -> true;
            // Admin manages every role except the Super Admin.
            case ADMIN -> targetRole != Role.SUPER_ADMIN;
            // Nobody else manages accounts. (HR and Sales Leads once could, which let
            // them set another user's password and sign in as them.)
            default -> false;
        };
        if (!allowed) {
            throw new ForbiddenException(r + " is not allowed to manage a " + targetRole + " account");
        }
    }
}
