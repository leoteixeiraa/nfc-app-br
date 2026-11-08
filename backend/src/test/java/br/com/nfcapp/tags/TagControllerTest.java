package br.com.nfcapp.tags;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

class TagControllerTest {
    private TagService tags;
    private GooglePlacesService places;
    private QrCodeService qrCodeService;
    private PixPayloadService pixPayloadService;
    private TagController controller;

    @BeforeEach
    void setUp() {
        tags = mock(TagService.class);
        places = mock(GooglePlacesService.class);
        qrCodeService = mock(QrCodeService.class);
        pixPayloadService = mock(PixPayloadService.class);
        controller = new TagController(tags, places, new TagRateLimiter(), qrCodeService, pixPayloadService);
    }

    @Test
    void publishesAndRetriesWithAnIdempotencyKey() {
        TagService.TagRequest request = request("Balcão", "https://example.com");
        TagService.TagResponse first = response("public-code-a");
        TagService.TagResponse retry = response("public-code-a");
        when(tags.create(request, "idempotency-key")).thenReturn(first, retry);

        assertEquals(first, controller.create(request, "idempotency-key", new MockHttpServletRequest()));
        assertEquals(retry, controller.create(request, "idempotency-key", new MockHttpServletRequest()));
        verify(tags, org.mockito.Mockito.times(2)).create(request, "idempotency-key");
    }

    @Test
    void duplicationUsesANewIdempotencyKeyAndPublicId() {
        TagService.TagRequest original = request("Mesa 01", "https://example.com");
        TagService.TagRequest duplicate = request("Mesa 01 (cópia)", "https://example.com");
        when(tags.create(original, "original-key")).thenReturn(response("public-code-a"));
        when(tags.create(duplicate, "duplicate-key")).thenReturn(response("public-code-b"));

        TagService.TagResponse originalResult =
                controller.create(original, "original-key", new MockHttpServletRequest());
        TagService.TagResponse duplicateResult =
                controller.create(duplicate, "duplicate-key", new MockHttpServletRequest());

        assertFalse(originalResult.id().equals(duplicateResult.id()));
    }

    @Test
    void placeDetailsReturnsGoogleBusinessInformation() {
        GooglePlacesService.PlaceDetails details = new GooglePlacesService.PlaceDetails(
                "ChIJ1c1tFFhRzpQRUeF4fDi9RFs",
                "Padoca da Praça",
                "Praça Central",
                4.7,
                128,
                "https://lh3.googleusercontent.com/photo",
                java.util.List.of(new GooglePlacesService.PhotoAttribution("Autor", "https://maps.google.com/")),
                "https://www.google.com/maps/place/",
                "https://search.google.com/local/writereview?placeid=example",
                java.util.List.of(new GooglePlacesService.PlaceReview("Maria", null, 5.0, "Ótimo", "2026-01-01T00:00:00Z", "há um ano", null)),
                "Padaria", "11 9999-9999", "https://example.com");
        when(places.details(details.placeId(), true)).thenReturn(details);

        assertEquals(
                details,
                controller.placeDetails(details.placeId(), true, new MockHttpServletRequest()));
        verify(places).details(details.placeId(), true);
    }

    @Test
    void updateAndDeactivateRequireAndForwardTheManagementCredential() {
        TagService.TagRequest request = request("Recepção", "https://example.com/novo");
        when(tags.update(eq("public-code-a"), eq(request), eq("management-token")))
                .thenReturn(response("public-code-a"));

        assertEquals(response("public-code-a"),
                controller.update("public-code-a", request, "management-token", new MockHttpServletRequest()));
        assertEquals(HttpStatus.NO_CONTENT,
                controller.deactivate("public-code-a", "management-token", new MockHttpServletRequest()).getStatusCode());

        verify(tags).update("public-code-a", request, "management-token");
        verify(tags).deactivate("public-code-a", "management-token");
    }

    @Test
    void redirectsTemporarilyWithoutCaching() {
        when(tags.findPublicDestination("public-code-a"))
                .thenReturn(new TagService.PublicDestination("url", "Balcão", "https://example.com/novo"));

        var result = controller.redirect("public-code-a", new MockHttpServletRequest());

        assertEquals(HttpStatus.FOUND, result.getStatusCode());
        assertEquals("https://example.com/novo", result.getHeaders().getLocation().toString());
        assertTrue(result.getHeaders().getCacheControl().contains("no-store"));
    }

    @Test
    void pixRedirectDisplaysThePaymentQrAndPayloadWithoutCaching() {
        when(tags.findPublicDestination("public-code-pix"))
                .thenReturn(new TagService.PublicDestination("pix", "Café", "000201pix-payload"));
        when(qrCodeService.toDataUri("000201pix-payload")).thenReturn("data:image/svg+xml;base64,qr");

        var result = controller.redirect("public-code-pix", new MockHttpServletRequest());

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertTrue(result.getHeaders().getCacheControl().contains("no-store"));
        assertTrue(result.getBody().contains("QR Code Pix"));
        assertTrue(result.getBody().contains("000201pix-payload"));
        assertTrue(result.getBody().contains("data:image/svg+xml;base64,qr"));
    }

    @Test
    void inactivePublicCodeShowsAFriendlyUnavailablePage() {
        when(tags.findPublicDestination("inactive"))
                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND));

        var result = controller.redirect("inactive", new MockHttpServletRequest());

        assertEquals(HttpStatus.NOT_FOUND, result.getStatusCode());
        assertTrue(result.getBody().contains("Esta placa não está disponível"));
    }

    @Test
    void writeConfigurationIsNotCachedAndContainsNoManagementCredential() {
        var configuration = new TagService.WriteConfiguration(
                "Balcão", "https://nfc.app.br/t/public-code", "data:image/svg+xml;base64,qr");
        when(tags.writeConfiguration("public-code")).thenReturn(configuration);

        var result = controller.writeConfiguration("public-code", new MockHttpServletRequest());

        assertEquals(configuration, result.getBody());
        assertTrue(result.getHeaders().getCacheControl().contains("no-store"));
        verify(tags).writeConfiguration("public-code");
    }

    private TagService.TagRequest request(String name, String destination) {
        return new TagService.TagRequest(name, "url", destination, null, null, null, null, null, null);
    }

    private TagService.TagResponse response(String id) {
        return new TagService.TagResponse(
                id,
                "Placa de teste",
                "url",
                "https://example.com",
                "https://nfc.app.br/t/" + id,
                "2026-01-01T00:00:00Z",
                "2026-01-01T00:00:00Z",
                true,
                "data:image/svg+xml;base64,qr",
                null,
                null,
                null,
                null,
                null);
    }
}
