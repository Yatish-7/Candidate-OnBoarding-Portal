package com.intellectt.service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;

import org.springframework.data.jpa.domain.Specification;

import com.intellectt.exception.BadRequestException;
import com.intellectt.model.Candidate;

/**
 * Extra narrowing for the candidate list and the dashboard counters: a date range (on one of four dates), a
 * recruiter, a team and a few intake fields. Every value is optional; the visibility rules of the signed-in
 * user are applied on top, so a filter can never show a candidate the person may not see. Values are only
 * ever bound as query parameters.
 *
 * @param dateField which date the range applies to: submitted (default), updated, doj or projectEnd
 */
public record CandidateFilter(String dateField, LocalDate from, LocalDate to, Long recruiterId, Long teamId,
        String employmentType, String internalEntity, String clientState, String recruiterLocation,
        String payrollCompany) {

    static final CandidateFilter NONE = new CandidateFilter(null, null, null, null, null, null, null, null, null, null);

    private static final List<String> DATE_FIELDS = List.of("submitted", "updated", "doj", "projectEnd");

    Specification<Candidate> toSpec() {
        String field = dateField == null || dateField.isBlank() ? "submitted" : dateField;
        if (!DATE_FIELDS.contains(field)) {
            throw new BadRequestException("Unknown date filter: " + field);
        }
        if (from != null && to != null && to.isBefore(from)) {
            throw new BadRequestException("The end date can't be before the start date");
        }
        Specification<Candidate> spec = (root, query, cb) -> cb.conjunction();
        if (from != null || to != null) {
            spec = spec.and(dateRange(field));
        }
        if (recruiterId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("submittedBy").get("id"), recruiterId));
        }
        if (teamId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("team").get("id"), teamId));
        }
        return spec.and(textEquals("employmentType", employmentType))
                .and(textEquals("internalEntity", internalEntity))
                .and(textEquals("clientState", clientState))
                .and(textEquals("recruiterLocation", recruiterLocation))
                .and(textEquals("payrollCompany", payrollCompany));
    }

    /** From the start of {@code from} up to and including the whole of {@code to}. */
    private Specification<Candidate> dateRange(String field) {
        return switch (field) {
            case "doj" -> localDateRange("dojDate");
            case "projectEnd" -> localDateRange("projectEndDate");
            default -> {
                String attribute = "updated".equals(field) ? "updatedAt" : "createdAt";
                ZoneId zone = ZoneId.systemDefault();
                yield (root, query, cb) -> {
                    var path = root.<java.time.Instant>get(attribute);
                    var p = cb.conjunction();
                    if (from != null) {
                        p = cb.and(p, cb.greaterThanOrEqualTo(path, from.atStartOfDay(zone).toInstant()));
                    }
                    if (to != null) {
                        p = cb.and(p, cb.lessThan(path, to.plusDays(1).atStartOfDay(zone).toInstant()));
                    }
                    return p;
                };
            }
        };
    }

    private Specification<Candidate> localDateRange(String attribute) {
        return (root, query, cb) -> {
            var path = root.<LocalDate>get(attribute);
            var p = cb.conjunction();
            if (from != null) {
                p = cb.and(p, cb.greaterThanOrEqualTo(path, from));
            }
            if (to != null) {
                p = cb.and(p, cb.lessThanOrEqualTo(path, to));
            }
            return p;
        };
    }

    private static Specification<Candidate> textEquals(String attribute, String value) {
        if (value == null || value.isBlank()) {
            return (root, query, cb) -> cb.conjunction();
        }
        String wanted = value.trim().toLowerCase(Locale.ROOT);
        return (root, query, cb) -> cb.equal(cb.lower(root.<String>get(attribute)), wanted);
    }
}
