package br.com.nfcapp.tags;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;


@Service
public class TagService {
    private static final UUID ANONYMOUS_ORGANIZATION_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final JdbcTemplate jdbc;
    private final PixPayloadService pixPayloadService;
    private final QrCodeService qrCodeService;
    private final String publicBaseUrl;

    public TagService(
            JdbcTemplate jdbc,
            PixPayloadService pixPayloadService,
            QrCodeService qrCodeService,
            @Value("${app.public-base-url:http://localhost}") String publicBaseUrl) {
        this.jdbc = jdbc;
        this.pixPayloadService = pixPayloadService;
        this.qrCodeService = qrCodeService;
        this.publicBaseUrl = validatePublicBaseUrl(publicBaseUrl);
    }

    @Transactional
    public TagResponse create(TagRequest request, String idempotencyKey) {
        validateRequest(request, true);
        String normalizedKey = requireIdempotencyKey(idempotencyKey);
        String tokenHash = hashToken(request.managementToken());
        var existing = jdbc.query(
                "SELECT public_code, management_token_hash FROM nfc_tags WHERE idempotency_key = ?",
                (rs, row) -> new ExistingTag(rs.getString("public_code"), rs.getString("management_token_hash")),
                normalizedKey);
        if (!existing.isEmpty()) {
            ExistingTag previous = existing.getFirst();
            if (!MessageDigest.isEqual(previous.tokenHash().getBytes(StandardCharsets.US_ASCII),
                    tokenHash.getBytes(StandardCharsets.US_ASCII))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Chave de criação já utilizada.");
            }
            return get(previous.code());
        }

        String code = newPublicCode();
        String destination = destinationFor(request);
        int inserted = jdbc.update("""
                INSERT INTO nfc_tags
                    (organization_id, public_code, label, destination_type, destination_label, management_token_hash, idempotency_key)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
                """,
                ANONYMOUS_ORGANIZATION_ID, code, request.name().trim(), request.type(),
                normalizeDestinationLabel(request.destinationLabel()), tokenHash, normalizedKey);
        if (inserted == 0) {
            ExistingTag previous = jdbc.queryForObject(
                    "SELECT public_code, management_token_hash FROM nfc_tags WHERE idempotency_key = ?",
                    (rs, row) -> new ExistingTag(rs.getString("public_code"), rs.getString("management_token_hash")),
                    normalizedKey);
            if (previous == null || !MessageDigest.isEqual(previous.tokenHash().getBytes(StandardCharsets.US_ASCII),
                    tokenHash.getBytes(StandardCharsets.US_ASCII))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Chave de criação já utilizada.");
            }
            return get(previous.code());
        }
        jdbc.update("""
                INSERT INTO redirect_links (nfc_tag_id, target_url, pix_key, pix_receiver_name, pix_city)
                VALUES ((SELECT id FROM nfc_tags WHERE public_code = ?), ?, ?, ?, ?)
                """, code, destination, request.pixKey(), request.pixReceiverName(), request.pixCity());
        return get(code);
    }

    @Transactional
    public TagResponse update(String code, TagRequest request, String managementToken) {
        validateRequest(request, false);
        String tokenHash = hashToken(managementToken);
        UUID tagId = findManagedTagId(code, tokenHash);
        jdbc.update("UPDATE redirect_links SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE nfc_tag_id = ? AND is_active",
                tagId);
        jdbc.update("""
                INSERT INTO redirect_links (nfc_tag_id, target_url, pix_key, pix_receiver_name, pix_city)
                VALUES (?, ?, ?, ?, ?)
                """, tagId, destinationFor(request), request.pixKey(), request.pixReceiverName(), request.pixCity());
        jdbc.update("""
                UPDATE nfc_tags
                SET label = ?, destination_type = ?, destination_label = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, request.name().trim(), request.type(), normalizeDestinationLabel(request.destinationLabel()), tagId);
        return get(code);
    }

    @Transactional
    public void deactivate(String code, String managementToken) {
        UUID tagId = findManagedTagId(code, hashToken(managementToken));
        jdbc.update("UPDATE redirect_links SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE nfc_tag_id = ? AND is_active",
                tagId);
        jdbc.update("UPDATE nfc_tags SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", tagId);
    }

    public TagResponse get(String code) {
        return jdbc.query("""
                SELECT tag.public_code, tag.label, tag.destination_type, tag.destination_label,
                       tag.created_at, tag.updated_at, link.target_url, link.is_active,
                       link.pix_key, link.pix_receiver_name, link.pix_city
                FROM nfc_tags tag
                LEFT JOIN redirect_links link ON link.nfc_tag_id = tag.id AND link.is_active
                WHERE tag.public_code = ?
                """, rs -> {
            if (!rs.next()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Placa não encontrada.");
            }
            String destination = rs.getString("target_url");
            String type = rs.getString("destination_type");
            String url = publicUrl(rs.getString("public_code"));
            return new TagResponse(
                    rs.getString("public_code"),
                    rs.getString("label"),
                    type,
                    destination,
                    url,
                    rs.getTimestamp("created_at").toInstant().toString(),
                    rs.getTimestamp("updated_at").toInstant().toString(),
                    rs.getBoolean("is_active"),
                    qrCodeService.toDataUri(url),
                    rs.getString("destination_label"),
                    rs.getString("pix_key"),
                    rs.getString("pix_receiver_name"),
                    rs.getString("pix_city"));
        }, code);
    }

    public PublicDestination findPublicDestination(String code) {
        return jdbc.query("""
                SELECT tag.destination_type, tag.label, link.target_url
                FROM nfc_tags tag
                LEFT JOIN redirect_links link ON link.nfc_tag_id = tag.id AND link.is_active
                WHERE tag.public_code = ?
                """, rs -> {
            if (!rs.next() || rs.getString("target_url") == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Esta placa não existe ou foi desativada.");
            }
            return new PublicDestination(rs.getString("destination_type"), rs.getString("label"), rs.getString("target_url"));
        }, code);
    }

    public static void validateDestination(String type, String destination) {
        if (destination == null || destination.length() > 2048) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe um destino válido.");
        }
        try {
            URI uri = URI.create(destination);
            boolean supported = "https".equalsIgnoreCase(uri.getScheme())
                    && uri.getHost() != null
                    && uri.getUserInfo() == null
                    && (type.equals("url")
                            || type.equals("whatsapp") && uri.getHost().equalsIgnoreCase("wa.me")
                            || type.equals("google-review") && isGoogleHost(uri.getHost()));
            if (!supported) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O destino deve ser uma URL HTTPS válida.");
        }
    }

    private String destinationFor(TagRequest request) {
        if ("pix".equals(request.type())) {
            return pixPayloadService.createPayload(request.pixKey(), request.pixReceiverName(), request.pixCity());
        }
        validateDestination(request.type(), request.destinationUrl());
        return request.destinationUrl().trim();
    }

    private void validateRequest(TagRequest request, boolean requireToken) {
        if (request.name() == null || request.name().isBlank() || request.name().trim().length() > 80) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O nome da placa deve ter entre 1 e 80 caracteres.");
        }
        if (request.type() == null || !java.util.Set.of("google-review", "whatsapp", "pix", "url").contains(request.type())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo de destino inválido.");
        }
        if (requireToken && (request.managementToken() == null || !request.managementToken().matches("[A-Fa-f0-9]{64}"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Credencial de gerenciamento inválida.");
        }
        normalizeDestinationLabel(request.destinationLabel());
        destinationFor(request);
    }

    private String normalizeDestinationLabel(String label) {
        if (label != null && label.trim().length() > 160) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O nome do destino deve ter até 160 caracteres.");
        }
        return label == null || label.isBlank() ? null : label.trim();
    }

    private UUID findManagedTagId(String code, String tokenHash) {
        var ids = jdbc.query(
                "SELECT id, management_token_hash FROM nfc_tags WHERE public_code = ?",
                (rs, row) -> new ManagedTag(rs.getObject("id", UUID.class), rs.getString("management_token_hash")),
                code);
        if (ids.isEmpty() || ids.getFirst().tokenHash() == null
                || !MessageDigest.isEqual(ids.getFirst().tokenHash().getBytes(StandardCharsets.US_ASCII),
                        tokenHash.getBytes(StandardCharsets.US_ASCII))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Placa não encontrada.");
        }
        return ids.getFirst().id();
    }

    private String hashToken(String token) {
        if (token == null || !token.matches("[A-Fa-f0-9]{64}")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credencial de gerenciamento inválida.");
        }
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 indisponível.", exception);
        }
    }

    private String requireIdempotencyKey(String key) {
        if (key == null || !key.matches("[A-Fa-f0-9-]{36}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chave de idempotência inválida.");
        }
        return key;
    }

    private String newPublicCode() {
        byte[] bytes = new byte[18];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String publicUrl(String code) {
        return publicBaseUrl + "/t/" + code;
    }

    private String validatePublicBaseUrl(String value) {
        try {
            URI uri = URI.create(value);
            if (!("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))
                    || uri.getHost() == null || uri.getUserInfo() != null || uri.getPath().length() > 0) {
                throw new IllegalArgumentException();
            }
            return value.replaceAll("/+$", "");
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("APP_PUBLIC_BASE_URL deve ser uma origem HTTP(S) sem caminho.", exception);
        }
    }

    private static boolean isGoogleHost(String host) {
        return java.util.List.of("google.com", "g.page", "goo.gl", "g.co")
                .stream().anyMatch(domain -> host.equalsIgnoreCase(domain) || host.toLowerCase(Locale.ROOT).endsWith("." + domain));
    }

    private record ExistingTag(String code, String tokenHash) {
    }

    private record ManagedTag(UUID id, String tokenHash) {
    }

    public record TagRequest(
            String name,
            String type,
            String destinationUrl,
            String pixKey,
            String pixReceiverName,
            String pixCity,
            String destinationLabel,
            String managementToken) {
    }

    public record TagResponse(
            String id,
            String name,
            String type,
            String destinationUrl,
            String publicUrl,
            String createdAt,
            String updatedAt,
            boolean active,
            String qrCodeDataUri,
            String destinationLabel,
            String pixKey,
            String pixReceiverName,
            String pixCity) {
    }

    public record PublicDestination(String type, String name, String target) {
    }
}
