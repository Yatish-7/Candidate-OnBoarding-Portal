package com.intellectt.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.intellectt.model.Team;
import com.intellectt.security.AppUserPrincipal;
import com.intellectt.service.TeamService;

@RestController
@RequestMapping("/api/teams")
public class TeamController {

    private final TeamService teamService;

    public TeamController(TeamService teamService) {
        this.teamService = teamService;
    }

    @PostMapping
    public ResponseEntity<Team> create(@RequestBody Team team,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(teamService.createTeam(team, principal.getUser()));
    }

    @GetMapping
    public ResponseEntity<List<Team>> list(@AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(teamService.listTeams(principal.getUser()));
    }

    /** Team names only (no members, not your own team), for the candidate form's "shared with" dropdown. */
    @GetMapping("/options")
    public ResponseEntity<List<java.util.Map<String, Object>>> options(
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(teamService.listTeamOptions(principal.getUser()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Team> get(@PathVariable Long id,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(teamService.getVisibleTeam(id, principal.getUser()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Team> update(@PathVariable Long id, @RequestBody Team team,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(teamService.updateTeam(id, team, principal.getUser()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        teamService.deleteTeam(id, principal.getUser());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/sales-lead/{userId}")
    public ResponseEntity<Team> assignSalesLead(@PathVariable Long id, @PathVariable Long userId,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(teamService.assignSalesLead(id, userId, principal.getUser()));
    }

    @PutMapping("/{id}/sales-manager/{userId}")
    public ResponseEntity<Team> assignSalesManager(@PathVariable Long id, @PathVariable Long userId,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(teamService.assignSalesManager(id, userId, principal.getUser()));
    }

    @DeleteMapping("/{id}/sales-manager")
    public ResponseEntity<Team> removeSalesManager(@PathVariable Long id,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(teamService.removeSalesManager(id, principal.getUser()));
    }

    @PostMapping("/{id}/members/{userId}")
    public ResponseEntity<Team> addMember(@PathVariable Long id, @PathVariable Long userId,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(teamService.addMember(id, userId, principal.getUser()));
    }

    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<Team> removeMember(@PathVariable Long id, @PathVariable Long userId,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(teamService.removeMember(id, userId, principal.getUser()));
    }
}
