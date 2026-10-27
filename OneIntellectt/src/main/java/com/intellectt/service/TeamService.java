package com.intellectt.service;

import java.util.List;

import com.intellectt.model.Team;
import com.intellectt.model.User;

/** Team administration and membership management. */
public interface TeamService {

    Team createTeam(Team team, User actor);

    Team updateTeam(Long id, Team team, User actor);

    void deleteTeam(Long id, User actor);

    Team assignSalesLead(Long teamId, Long userId, User actor);

    /** Puts a Sales Manager over the team (a manager can have many teams). */
    Team assignSalesManager(Long teamId, Long userId, User actor);

    /** Takes the team out from under its Sales Manager. */
    Team removeSalesManager(Long teamId, User actor);

    Team addMember(Long teamId, Long userId, User actor);

    Team removeMember(Long teamId, Long userId, User actor);

    /** All teams for Super Admin/Admin, only their own team for a Sales Lead, the teams they oversee for a Sales Manager; anyone else is refused. */
    List<Team> listTeams(User actor);

    /** One team, with the same visibility rule as {@link #listTeams(User)}. */
    Team getVisibleTeam(Long id, User actor);

    /** Every team except the user's own (id and name), for the "shared with which team" dropdown. Any signed-in user. */
    List<java.util.Map<String, Object>> listTeamOptions(User actor);

    Team getById(Long id);

    List<User> getMembers(Team team);
}
