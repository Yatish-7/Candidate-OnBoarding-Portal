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

import com.intellectt.model.User;
import com.intellectt.model.enums.Role;
import com.intellectt.security.AppUserPrincipal;
import com.intellectt.service.UserService;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping
    public ResponseEntity<User> create(@RequestBody User user,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(userService.createUser(user, principal.getUser()));
    }

    @GetMapping
    public ResponseEntity<List<User>> list(@AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(userService.listVisibleUsers(principal.getUser()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<User> update(@PathVariable Long id, @RequestBody User user,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(userService.updateUser(id, user, principal.getUser()));
    }

    @GetMapping("/by-role/{role}")
    public ResponseEntity<List<User>> byRole(@PathVariable Role role,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(userService.findByRole(role, principal.getUser()));
    }

    // Soft delete: the account can no longer sign in, but the record (and its history) stays.
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable Long id,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        userService.deactivateUser(id, principal.getUser());
        return ResponseEntity.noContent().build();
    }

    // Hard delete: permanently removes the user (Super Admin only).
    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<Void> delete(@PathVariable Long id,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        userService.deleteUser(id, principal.getUser());
        return ResponseEntity.noContent().build();
    }
}
