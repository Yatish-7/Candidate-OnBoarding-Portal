package com.intellectt.service;

import java.util.List;

import com.intellectt.model.User;
import com.intellectt.model.enums.Role;

/** User management with role-based rules. */
public interface UserService {

    User createUser(User user, User actor);

    /** Edits an existing user (name, email, role, team, active). */
    User updateUser(Long id, User input, User actor);

    void deactivateUser(Long id, User actor);

    /** Permanently removes a user (Super Admin only). Blocked if they submitted candidates. */
    void deleteUser(Long id, User actor);

    List<User> listVisibleUsers(User actor);

    /** Users of one role, for building teams: Super Admin/Admin any role, a Sales Lead only Recruiters/Sales Leads. */
    List<User> findByRole(Role role, User actor);

    User getById(Long id);
}
