package com.intellectt.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.intellectt.security.AppUserPrincipal;
import com.intellectt.service.AuditService;

/** The change history across every table (Super Admin only). */
@RestController
@RequestMapping("/api/audit")
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> search(
            @RequestParam(required = false) String entity,
            @RequestParam(required = false) Integer action,
            @RequestParam(required = false) String user,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long from,
            @RequestParam(required = false) Long to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(auditService.search(principal.getUser(), entity, action, user, q, from, to, page, size));
    }

    @GetMapping("/{entity}/{entityId}/{rev}")
    public ResponseEntity<Map<String, Object>> detail(@PathVariable String entity, @PathVariable String entityId,
            @PathVariable Long rev, @AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(auditService.detail(principal.getUser(), entity, entityId, rev));
    }
}
