package br.com.nfcapp.tags;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class PixPayloadServiceTest {
    private final PixPayloadService service = new PixPayloadService();

    @Test
    void createsStaticPixPayloadWithValidCrc() {
        String payload = service.createPayload("529.982.247-25", "Café Central", "São Paulo");
        String crcInput = payload.substring(0, payload.length() - 4);

        assertTrue(payload.startsWith("000201010211"));
        assertTrue(payload.contains("br.gov.bcb.pix"));
        assertTrue(payload.contains("Café Central"));
        assertEquals(crc16(crcInput), payload.substring(payload.length() - 4));
    }

    @Test
    void acceptsSupportedKeyTypesAndEnforcesFieldLengths() {
        assertTrue(service.createPayload("contato@example.com", "Recebedor", "Campinas")
                .contains("contato@example.com"));
        assertThrows(ResponseStatusException.class,
                () -> service.createPayload("chave-invalida", "Recebedor", "Campinas"));
        assertThrows(ResponseStatusException.class,
                () -> service.createPayload("contato@example.com", "Nome com mais de vinte e cinco caracteres", "Campinas"));
    }

    @Test
    void countsUtf8BytesInMerchantFields() {
        String payload = service.createPayload("contato@example.com", "Café", "São Paulo");
        assertTrue(payload.contains("5905Café"));
        assertTrue(payload.contains("6010São Paulo"));
        assertTrue(payload.getBytes(StandardCharsets.UTF_8).length > payload.length());
    }

    private String crc16(String value) {
        int crc = 0xFFFF;
        for (byte current : value.getBytes(StandardCharsets.UTF_8)) {
            crc ^= (current & 0xFF) << 8;
            for (int bit = 0; bit < 8; bit++) {
                crc = (crc & 0x8000) != 0 ? (crc << 1) ^ 0x1021 : crc << 1;
            }
        }
        return "%04X".formatted(crc & 0xFFFF);
    }
}
