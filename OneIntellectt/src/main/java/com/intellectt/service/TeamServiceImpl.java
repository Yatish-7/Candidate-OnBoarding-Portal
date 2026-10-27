package com.intellectt.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.intellectt.exception.BadRequestException;
import com.intellectt.exception.ForbiddenException;
import com.intellectt.exception.ResourceNotFoundException;
import com.intellectt.model.Candidate;
import com.intellectt.model.Team;
import com.intellectt.model.User;
import com.intellectt.model.enums.Role;
import com.intellectt.repository.CandidateRepository;
import com.intellectt.repository.TeamRepository;
import com.intellectt.repository.UserRepository;

/**
 * Super Admin, Admin and HR create, edit and delete teams and assign leads; the
 * Sales Lead of a team, or the Sales Manager over it (and Super Admin / Admin), can add or
 * remove its recruiters.
 */
@Service
public class TeamServiceImpl implements TeamService {

    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final CandidateRepository candidateRepository;

    public TeamServiceImpl(TeamRepository teamRepository, UserRepository userRepository,
            CandidateRepository candidateRepository) {
        this.teamRepository = teamRepository;
        this.userRepository = userRepository;
        this.candidateRepository = candidateRepository;
    }

    @Override
    @Transactional
    public Team createTeam(Team input, User actor) {
        assertAdmin(actor, "create a team");
        if (input.getName() == null || input.getName().isBlank()) {
            throw new BadRequestException("Team name is required");
        }
        if (teamRepository.existsByName(input.getName())) {
            throw new BadRequestException("A team named '" + input.getName() + "' already exists");
        }
        Team team = new Team();
        team.setName(input.getName());
        team = teamRepository.save(team);

        Long salesLeadId = (input.getSalesLead() != null) ? input.getSalesLead().getId() : null;
        if (salesLeadId != null) {
            team = assignSalesLead(team.getId(), salesLeadId, actor);
        }
        Long salesManagerId = (input.getSalesManager() != null) ? input.getSalesManager().getId() : null;
        if (salesManagerId != null) {
            team = assignSalesManager(team.getId(), salesManagerId, actor);
        }
        return team;
    }

    @Override
    @Transactional
    public Team updateTeam(Long id, Team input, User actor) {
        assertAdmin(actor, "edit a team");
        Team team = getById(id);

        if (input.getName() != null && !input.getName().isBlank()
                && !input.getName().equals(team.getName())) {
            if (teamRepository.existsByName(input.getName())) {
                throw new BadRequestException("A team named '" + input.getName() + "' already exists");
            }
            team.setName(input.getName());
        }
        team = teamRepository.save(team);

        // Optionally (re)assign the sales lead if one was supplied.
        if (input.getSalesLead() != null && input.getSalesLead().getId() != null) {
            team = assignSalesLead(id, input.getSalesLead().getId(), actor);
        }
        if (input.getSalesManager() != null && input.getSalesManager().getId() != null) {
            team = assignSalesManager(id, input.getSalesManager().getId(), actor);
        }
        return team;
    }

    @Override
    @Transactional
    public void deleteTeam(Long id, User actor) {
        assertAdmin(actor, "delete a team");
        Team team = getById(id);

        // Detach members and candidates first so foreign keys don't block deletion.
        List<User> members = userRepository.findByTeam(team);
        for (User m : members) {
            m.setTeam(null);
        }
        userRepository.saveAll(members);

        List<Candidate> candidates = candidateRepository.findByTeam(team);
        for (Candidate c : candidates) {
            c.setTeam(null);
        }
        candidateRepository.saveAll(candidates);

        team.setSalesLead(null);
        team.setSalesManager(null);
        teamRepository.save(team);
        teamRepository.delete(team);
    }

    @Override
    @Transactional
    public Team assignSalesLead(Long teamId, Long userId, User actor) {
        assertAdmin(actor, "assign a sales lead");
        Team team = getById(teamId);
        User lead = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        if (lead.getRole() != Role.SALES_LEAD) {
            throw new BadRequestException("User " + lead.getFullName() + " is not a Sales Lead");
        }
        team.setSalesLead(lead);
        lead.setTeam(team);
        userRepository.save(lead);
        return teamRepository.save(team);
    }

    @Override
    @Transactional
    public Team assignSalesManager(Long teamId, Long userId, User actor) {
        assertAdmin(actor, "assign a sales manager");
        Team team = getById(teamId);
        User manager = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        if (manager.getRole() != Role.SALES_MANAGER) {
            throw new BadRequestException("User " + manager.getFullName() + " is not a Sales Manager");
        }
        team.setSalesManager(manager);
        return teamRepository.save(team);
    }

    @Override
    @Transactional
    public Team removeSalesManager(Long teamId, User actor) {
        assertAdmin(actor, "remove a sales manager");
        Team team = getById(teamId);
        team.setSalesManager(null);
        return teamRepository.save(team);
    }

    @Override
    @Transactional
    public Team addMember(Long teamId, Long userId, User actor) {
        Team team = getById(teamId);
        assertCanManageTeam(actor, team, "add members to");
        User member = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        if (member.getRole() != Role.RECRUITER) {
            throw new BadRequestException("Only recruiters can be added as team members");
        }
        // A recruiter belongs to at most one team: block adding one who is already in
        // another team. They must be removed from it (or have no team) first.
        if (member.getTeam() != null && !member.getTeam().getId().equals(teamId)) {
            throw new BadRequestException(member.getFullName() + " is already in team '"
                    + member.getTeam().getName() + "'. Remove them from that team first.");
        }
        member.setTeam(team);
        userRepository.save(member);
        return getById(teamId);
    }

    @Override
    @Transactional
    public Team removeMember(Long teamId, Long userId, User actor) {
        Team team = getById(teamId);
        assertCanManageTeam(actor, team, "remove members from");
        User member = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        if (member.getTeam() == null || !member.getTeam().getId().equals(teamId)) {
            throw new BadRequestException("User is not a member of this team");
        }
        if (member.getRole() != Role.RECRUITER) {
            throw new BadRequestException("Only recruiter members can be removed");
        }
        member.setTeam(null);
        userRepository.save(member);
        return getById(teamId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Team> listTeams(User actor) {
        return switch (actor.getRole()) {
            case SUPER_ADMIN, ADMIN -> teamRepository.findAll();
            case SALES_LEAD -> teamRepository.findAll().stream().filter(t -> isOwnTeam(t, actor)).toList();
            case SALES_MANAGER -> teamRepository.findAll().stream().filter(t -> isManagedBy(t, actor)).toList();
            default -> throw new ForbiddenException("You are not allowed to view teams");
        };
    }

    @Override
    @Transactional(readOnly = true)
    public List<java.util.Map<String, Object>> listTeamOptions(User actor) {
        Long ownTeamId = actor.getTeam() != null ? actor.getTeam().getId() : null;
        return teamRepository.findAll().stream()
                .filter(t -> !t.getId().equals(ownTeamId))
                .map(t -> java.util.Map.<String, Object>of("id", t.getId(), "name", t.getName()))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Team getVisibleTeam(Long id, User actor) {
        Team team = getById(id);
        boolean allowed = actor.getRole() == Role.SUPER_ADMIN || actor.getRole() == Role.ADMIN
                || (actor.getRole() == Role.SALES_LEAD && isOwnTeam(team, actor))
                || (actor.getRole() == Role.SALES_MANAGER && isManagedBy(team, actor));
        if (!allowed) {
            throw new ForbiddenException("You are not allowed to view this team");
        }
        return team;
    }

    /** The team this Sales Lead leads or belongs to. */
    private static boolean isOwnTeam(Team team, User lead) {
        return (team.getSalesLead() != null && team.getSalesLead().getId().equals(lead.getId()))
                || (lead.getTeam() != null && team.getId().equals(lead.getTeam().getId()));
    }

    private static boolean isManagedBy(Team team, User manager) {
        return team.getSalesManager() != null && team.getSalesManager().getId().equals(manager.getId());
    }

    @Override
    @Transactional(readOnly = true)
    public Team getById(Long id) {
        return teamRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Team not found: " + id));
    }

    @Override
    @Transactional(readOnly = true)
    public List<User> getMembers(Team team) {
        return userRepository.findByTeam(team);
    }

    private void assertAdmin(User actor, String action) {
        if (actor.getRole() != Role.SUPER_ADMIN && actor.getRole() != Role.ADMIN) {
            throw new ForbiddenException("Only the Super Admin or an Admin can " + action);
        }
    }

    private void assertCanManageTeam(User actor, Team team, String action) {
        boolean isAdmin = actor.getRole() == Role.SUPER_ADMIN || actor.getRole() == Role.ADMIN;
        boolean isTeamLead = actor.getRole() == Role.SALES_LEAD
                && team.getSalesLead() != null
                && team.getSalesLead().getId().equals(actor.getId());
        boolean isTeamManager = actor.getRole() == Role.SALES_MANAGER && isManagedBy(team, actor);
        if (!isAdmin && !isTeamLead && !isTeamManager) {
            throw new ForbiddenException("You are not allowed to " + action + " this team");
        }
    }
}
