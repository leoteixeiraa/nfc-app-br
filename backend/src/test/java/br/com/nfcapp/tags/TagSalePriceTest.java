package br.com.nfcapp.tags;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

class TagSalePriceTest {
    private static final String CODE = "abcdefghijklmnopqrstuvwx";
    private static final String TOKEN = "a".repeat(64);
    private static final String KEY = UUID.randomUUID().toString();

    private JdbcTemplate jdbc;
    private TagService service;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        service = spy(new TagService(jdbc, mock(PixPayloadService.class), mock(QrCodeService.class), "https://nfc.app.br"));
    }

    @Test
    void createPersistsTheSalePriceWithTwoDecimals() {
        when(jdbc.query(anyString(), ArgumentMatchers.<RowMapper<Object>>any(), any(Object[].class))).thenReturn(List.of());
        when(jdbc.update(contains("INSERT INTO nfc_tags"), any(Object[].class))).thenReturn(1);
        doReturn(null).when(service).get(anyString());

        service.create(request(new BigDecimal("49.9")), KEY);

        ArgumentCaptor<Object> args = ArgumentCaptor.forClass(Object.class);
        verify(jdbc).update(contains("sale_price"), args.capture(), args.capture(), args.capture(), args.capture(),
                args.capture(), args.capture(), args.capture(), args.capture());
        assertEquals(new BigDecimal("49.90"), args.getAllValues().get(7));
    }

    @Test
    void createWithoutSalePriceStoresNull() {
        when(jdbc.query(anyString(), ArgumentMatchers.<RowMapper<Object>>any(), any(Object[].class))).thenReturn(List.of());
        when(jdbc.update(contains("INSERT INTO nfc_tags"), any(Object[].class))).thenReturn(1);
        doReturn(null).when(service).get(anyString());

        service.create(request(null), KEY);

        ArgumentCaptor<Object> args = ArgumentCaptor.forClass(Object.class);
        verify(jdbc).update(contains("sale_price"), args.capture(), args.capture(), args.capture(), args.capture(),
                args.capture(), args.capture(), args.capture(), args.capture());
        assertEquals(null, args.getAllValues().get(7));
    }

    @Test
    void updateChangesAndRemovesTheSalePrice() {
        when(jdbc.query(anyString(), ArgumentMatchers.<RowMapper<Object>>any(), eq(CODE)))
                .thenAnswer(invocation -> List.of(managed()));
        doReturn(null).when(service).get(CODE);

        service.update(CODE, request(new BigDecimal("10")), TOKEN);
        service.update(CODE, request(null), TOKEN);

        ArgumentCaptor<Object> args = ArgumentCaptor.forClass(Object.class);
        verify(jdbc, org.mockito.Mockito.times(2)).update(contains("SET label = ?"), args.capture(), args.capture(),
                args.capture(),                 args.capture(), args.capture());
        List<Object> values = args.getAllValues();
        assertEquals(new BigDecimal("10.00"), values.get(3));
        assertEquals(null, values.get(8));
    }

    @Test
    void rejectsNegativeAndOverPreciseValues() {
        assertBadRequest(new BigDecimal("-0.01"));
        assertBadRequest(new BigDecimal("1.999"));
        assertBadRequest(new BigDecimal("12345678901"));
    }

    @Test
    void acceptsZero() {
        when(jdbc.query(anyString(), ArgumentMatchers.<RowMapper<Object>>any(), any(Object[].class))).thenReturn(List.of());
        when(jdbc.update(contains("INSERT INTO nfc_tags"), any(Object[].class))).thenReturn(1);
        doReturn(null).when(service).get(anyString());

        service.create(request(BigDecimal.ZERO), KEY);
    }

    @Test
    void oldRecordsWithoutSalePriceAreReadAsNull() throws Exception {
        java.sql.ResultSet rs = mock(java.sql.ResultSet.class);
        when(rs.next()).thenReturn(true);
        when(rs.getString(anyString())).thenReturn("x");
        when(rs.getString("public_code")).thenReturn(CODE);
        when(rs.getTimestamp(anyString())).thenReturn(java.sql.Timestamp.from(java.time.Instant.EPOCH));
        when(rs.getBigDecimal("sale_price")).thenReturn(null);
        when(jdbc.query(contains("sale_price"), ArgumentMatchers.<ResultSetExtractor<TagService.TagResponse>>any(), eq(CODE)))
                .thenAnswer(invocation -> invocation.<ResultSetExtractor<TagService.TagResponse>>getArgument(1).extractData(rs));

        assertEquals(null, service.get(CODE).salePrice());
    }

    private void assertBadRequest(BigDecimal price) {
        ResponseStatusException error =
                assertThrows(ResponseStatusException.class, () -> service.create(request(price), KEY));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    private Object managed() {
        try {
            Class<?> type = Class.forName("br.com.nfcapp.tags.TagService$ManagedTag");
            var constructor = type.getDeclaredConstructors()[0];
            constructor.setAccessible(true);
            return constructor.newInstance(UUID.randomUUID(), hash());
        } catch (ReflectiveOperationException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private String hash() {
        try {
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                    .digest(TOKEN.getBytes(java.nio.charset.StandardCharsets.US_ASCII)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private TagService.TagRequest request(BigDecimal price) {
        return new TagService.TagRequest("Balcão", "url", "https://example.com", null, null, null, null, TOKEN, price);
    }
}
