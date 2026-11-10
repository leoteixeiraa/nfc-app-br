package br.com.nfcapp.tags;

import java.net.URI;
import java.time.Duration;
import java.util.List;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.http.HttpServletRequest;
import br.com.nfcapp.auth.CurrentUser;

@RestController
public class TagController {
    private final TagService tags;
    private final GooglePlacesService places;
    private final TagRateLimiter rateLimiter;
    private final QrCodeService qrCodeService;
    private final PixPayloadService pixPayloadService;

    public TagController(
            TagService tags,
            GooglePlacesService places,
            TagRateLimiter rateLimiter,
            QrCodeService qrCodeService,
            PixPayloadService pixPayloadService) {
        this.tags = tags;
        this.places = places;
        this.rateLimiter = rateLimiter;
        this.qrCodeService = qrCodeService;
        this.pixPayloadService = pixPayloadService;
    }

    @PostMapping("/api/tags")
    public TagService.TagResponse create(
            @RequestBody TagService.TagRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @AuthenticationPrincipal CurrentUser user,
            HttpServletRequest servletRequest) {
        limit(servletRequest, "create", 20, Duration.ofHours(1));
        return tags.create(user == null ? null : user.id(), request, idempotencyKey);
    }

    @PutMapping("/api/tags/{code}")
    public TagService.TagResponse update(
            @PathVariable String code,
            @RequestBody TagService.TagRequest request,
            @RequestHeader("X-Tag-Management-Token") String token,
            @AuthenticationPrincipal CurrentUser user,
            HttpServletRequest servletRequest) {
        limit(servletRequest, "manage", 60, Duration.ofHours(1));
        return tags.update(user == null ? null : user.id(), code, request, token);
    }

    @DeleteMapping("/api/tags/{code}")
    public ResponseEntity<Void> deactivate(
            @PathVariable String code,
            @RequestHeader("X-Tag-Management-Token") String token,
            @AuthenticationPrincipal CurrentUser user,
            HttpServletRequest servletRequest) {
        limit(servletRequest, "manage", 60, Duration.ofHours(1));
        tags.deactivate(user == null ? null : user.id(), code, token);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/places/search")
    public List<GooglePlacesService.PlaceResult> searchPlaces(
            @RequestParam String q,
            HttpServletRequest servletRequest) {
        limit(servletRequest, "places", 60, Duration.ofMinutes(1));
        if (q.trim().length() < 3 || q.length() > 160) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Digite pelo menos 3 caracteres para pesquisar.");
        }
        return places.search(q.trim());
    }

    @GetMapping("/api/places/{placeId}/details")
    public GooglePlacesService.PlaceDetails placeDetails(
            @PathVariable String placeId,
            @RequestParam(defaultValue = "false") boolean includeReviews,
            HttpServletRequest servletRequest) {
        limit(servletRequest, "places-details", 30, Duration.ofMinutes(1));
        if (!placeId.matches("[A-Za-z0-9_-]{1,256}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Estabelecimento inválido.");
        }
        return places.details(placeId, includeReviews);
    }

    @GetMapping("/api/places/{placeId}/review-link")
    public ReviewLink reviewLink(@PathVariable String placeId, HttpServletRequest servletRequest) {
        limit(servletRequest, "places-link", 60, Duration.ofMinutes(1));
        if (!placeId.matches("[A-Za-z0-9_-]{1,256}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Estabelecimento inválido.");
        }
        return new ReviewLink(places.reviewUrl(placeId));
    }

    @PostMapping("/api/pix/payload")
    public PixPreview previewPix(@RequestBody PixRequest request, HttpServletRequest servletRequest) {
        limit(servletRequest, "pix", 30, Duration.ofMinutes(1));
        String payload = pixPayloadService.createPayload(request.key(), request.receiverName(), request.city());
        return new PixPreview(payload, qrCodeService.toDataUri(payload));
    }

    @GetMapping("/api/tags/public/{code}/write")
    public ResponseEntity<TagService.WriteConfiguration> writeConfiguration(
            @PathVariable String code, HttpServletRequest request) {
        limit(request, "resolve", 300, Duration.ofMinutes(1));
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(tags.writeConfiguration(code));
    }

    @GetMapping("/api/tags/public/{code}/qr")
    public ResponseEntity<TagService.PublicQrConfiguration> publicQrConfiguration(
            @PathVariable String code, HttpServletRequest request) {
        limit(request, "resolve", 300, Duration.ofMinutes(1));
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(tags.publicQrConfiguration(code));
    }

    @GetMapping("/t/{code}")
    public ResponseEntity<String> redirect(@PathVariable String code, HttpServletRequest request) {
        limit(request, "resolve", 300, Duration.ofMinutes(1));
        TagService.PublicDestination destination;
        try {
            destination = tags.findPublicDestination(code);
        } catch (ResponseStatusException exception) {
            if (exception.getStatusCode() != HttpStatus.NOT_FOUND) {
                throw exception;
            }
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .contentType(MediaType.TEXT_HTML)
                    .cacheControl(CacheControl.noStore())
                    .body("<!doctype html><html lang=\"pt-BR\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>Placa indisponível - NFC.APP</title><main style=\"font:16px system-ui;max-width:36rem;margin:4rem auto;padding:1rem;text-align:center\"><h1>Esta placa não está disponível</h1><p>Ela pode ter sido desativada ou o link pode estar incorreto.</p></main></html>");
        }
        if ("pix".equals(destination.type())) {
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_HTML)
                    .cacheControl(CacheControl.noStore())
                    .body(pixPage(destination.name(), destination.target(), qrCodeService.toDataUri(destination.target())));
        }
        TagService.validateDestination(destination.type(), destination.target());
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(destination.target()))
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.PRAGMA, "no-cache")
                .build();
    }

    private void limit(HttpServletRequest request, String scope, int max, Duration duration) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        String address = forwardedFor == null || forwardedFor.isBlank()
                ? request.getRemoteAddr()
                : forwardedFor.substring(forwardedFor.lastIndexOf(',') + 1).trim();
        String key = scope + ":" + address;
        if (!rateLimiter.allow(key, max, duration)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Muitas tentativas. Aguarde um pouco e tente novamente.");
        }
    }

    private String pixPage(String name, String payload, String qrCode) {
        return """
                <!doctype html><html lang="pt-BR"><meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <meta name="robots" content="noindex">
                <title>Pagamento Pix - NFC.APP</title>
                <style>body{font:16px system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem;color:#1f2937}
                main{border:1px solid #e5e7eb;border-radius:1rem;padding:1.5rem;text-align:center}
                img{width:240px;height:240px}textarea{box-sizing:border-box;width:100%;min-height:6rem;margin:1rem 0;padding:.75rem}
                button{padding:.75rem 1rem;border:0;border-radius:.5rem;background:#465fff;color:#fff;font-weight:600}</style>
                <main><h1>Pagamento via Pix</h1><p>{{name}}</p><img alt="QR Code Pix" src="{{qrCode}}">
                <p>Escaneie o QR Code ou copie o código Pix:</p>
                <textarea id="pix" readonly>{{payload}}</textarea><br>
                <button onclick="navigator.clipboard.writeText(document.getElementById('pix').value)">Copiar código Pix</button>
                <p>Pagamento processado pelo seu banco. O NFC.APP não recebe pagamentos.</p></main></html>
                """.replace("{{name}}", escapeHtml(name))
                .replace("{{qrCode}}", qrCode)
                .replace("{{payload}}", escapeHtml(payload));
    }

    private String escapeHtml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    public record ReviewLink(String url) {
    }

    public record PixRequest(String key, String receiverName, String city) {
    }

    public record PixPreview(String payload, String qrCodeDataUri) {
    }
}
