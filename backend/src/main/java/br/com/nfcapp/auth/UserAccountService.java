package br.com.nfcapp.auth;

import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.nfcapp.plans.PlanService;

@Service
public class UserAccountService {

    private static final RowMapper<CurrentUser> CURRENT_USER_ROW_MAPPER = (resultSet, rowNumber) ->
            new CurrentUser(
                    resultSet.getObject("id", UUID.class),
                    resultSet.getString("email"),
                    resultSet.getString("display_name"),
                    resultSet.getString("picture_url"));

    private final JdbcTemplate jdbcTemplate;
    private final PlanService plans;

    public UserAccountService(JdbcTemplate jdbcTemplate, PlanService plans) {
        this.jdbcTemplate = jdbcTemplate;
        this.plans = plans;
    }

    @Transactional
    public CurrentUser saveAccount(FirebaseIdentity identity) {
        List<CurrentUser> existingAccounts = jdbcTemplate.query("""
                UPDATE users
                SET email = ?, display_name = ?, picture_url = ?
                WHERE firebase_uid = ?
                RETURNING id, email, display_name, picture_url
                """, CURRENT_USER_ROW_MAPPER,
                identity.email(), identity.name(), identity.pictureUrl(), identity.uid());
        if (!existingAccounts.isEmpty()) {
            return existingAccounts.get(0);
        }

        List<CurrentUser> inserted = jdbcTemplate.query("""
                INSERT INTO users (email, firebase_uid, display_name, picture_url)
                VALUES (?, ?, ?, ?)
                ON CONFLICT DO NOTHING
                RETURNING id, email, display_name, picture_url
                """, CURRENT_USER_ROW_MAPPER,
                identity.email(), identity.uid(), identity.name(), identity.pictureUrl());
        if (!inserted.isEmpty()) {
            plans.createPersonalOrganization(inserted.getFirst().id());
            return inserted.getFirst();
        }

        List<CurrentUser> accounts = jdbcTemplate.query("""
                UPDATE users SET firebase_uid = ?, display_name = ?, picture_url = ?
                WHERE lower(email) = lower(?) AND (firebase_uid IS NULL OR firebase_uid = ?)
                RETURNING id, email, display_name, picture_url
                """, CURRENT_USER_ROW_MAPPER, identity.uid(), identity.name(), identity.pictureUrl(),
                identity.email(), identity.uid());
        if (accounts.isEmpty()) {
            throw new EmailAlreadyLinkedException();
        }
        return accounts.get(0);
    }

    public CurrentUser findById(UUID id) {
        List<CurrentUser> users = jdbcTemplate.query("""
                SELECT id, email, display_name, picture_url
                FROM users
                WHERE id = ?
                """, CURRENT_USER_ROW_MAPPER, id);
        return users.isEmpty() ? null : users.get(0);
    }
}
