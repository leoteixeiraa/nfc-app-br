package br.com.nfcapp.tags;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

class TagWriteConfigurationTest {
    private static final String CODE = "abcdefghijklmnopqrstuvwx";

    @Test
    void createsContinuationQrWithoutDestinationOrCredential() {
        QrCodeService qr = mock(QrCodeService.class);
        TagService service = spy(new TagService(mock(JdbcTemplate.class), mock(PixPayloadService.class), qr,
                mock(br.com.nfcapp.plans.PlanService.class), "https://nfc.app.br"));
        doReturn(new TagService.PublicDestination("url", "Balcão", "https://example.com"))
                .when(service).findPublicDestination(CODE);
        when(qr.toDataUri("https://nfc.app.br/tags/" + CODE + "/write")).thenReturn("qr");

        assertEquals(new TagService.WriteConfiguration("Balcão", "https://nfc.app.br/t/" + CODE, "qr"),
                service.writeConfiguration(CODE));
    }

    @Test
    void rejectsInactiveOrInvalidCodes() {
        TagService service = spy(new TagService(mock(JdbcTemplate.class), mock(PixPayloadService.class),
                mock(QrCodeService.class), mock(br.com.nfcapp.plans.PlanService.class), "https://nfc.app.br"));
        doThrow(new ResponseStatusException(HttpStatus.NOT_FOUND)).when(service).findPublicDestination(CODE);
        assertThrows(ResponseStatusException.class, () -> service.writeConfiguration(CODE));
        assertThrows(ResponseStatusException.class, () -> service.writeConfiguration("../invalid"));
    }

    @Test
    void publicQrConfigurationUsesThePermanentPublicUrl() {
        TagService service = spy(new TagService(mock(JdbcTemplate.class), mock(PixPayloadService.class),
                mock(QrCodeService.class), mock(br.com.nfcapp.plans.PlanService.class), "https://nfc.app.br"));
        var tag = new TagService.TagResponse(
                CODE, "Balcão", "url", "https://example.com", "https://nfc.app.br/t/" + CODE,
                "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z", true, "permanent-qr",
                null, null, null, null, null);
        doReturn(tag).when(service).get(CODE);

        assertEquals(new TagService.PublicQrConfiguration(
                "Balcão", "https://nfc.app.br/t/" + CODE, "permanent-qr"),
                service.publicQrConfiguration(CODE));
        assertThrows(ResponseStatusException.class, () -> service.publicQrConfiguration("../invalid"));
    }
}
