package br.com.nfcapp.tags;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.databind.ObjectMapper;

class GooglePlacesServiceTest {
    @Test
    void requestsReviewsOnlyWhenRequested() {
        var builder = RestClient.builder().baseUrl("https://places.googleapis.com/v1");
        var server = MockRestServiceServer.bindTo(builder).build();
        var service = new GooglePlacesService(builder.build(), new ObjectMapper(), "test-key");
        String response = """
                {"id":"abc","displayName":{"text":"Padoca"},"formattedAddress":"Praça",
                 "rating":4.5,"userRatingCount":2,
                 "primaryTypeDisplayName":{"text":"Padaria"},"nationalPhoneNumber":"11 9999-9999",
                 "websiteUri":"https://example.com",
                 "googleMapsLinks":{"writeAReviewUri":"https://google.com/review"},
                 "reviews":[{"authorAttribution":{"displayName":"Maria"},"rating":5,"text":{"text":"Ótimo"}}]}
                """;
        server.expect(requestTo("https://places.googleapis.com/v1/places/abc?languageCode=pt-BR"))
                .andExpect(header("X-Goog-FieldMask", not(containsString(",reviews"))))
                .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://places.googleapis.com/v1/places/abc?languageCode=pt-BR"))
                .andExpect(header("X-Goog-FieldMask", containsString(",reviews")))
                .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));

        assertNull(service.details("abc", false).reviews());
        var details = service.details("abc", true);
        assertEquals(1, details.reviews().size());
        assertEquals("Maria", details.reviews().get(0).author());
        assertEquals("Ótimo", details.reviews().get(0).text());
        assertEquals("Padaria", details.category());
        assertEquals("11 9999-9999", details.phone());
        assertEquals("https://example.com", details.website());
        server.verify();
    }

    @Test
    void extractsReviewsWithAttributionAndRejectsUntrustedUrls() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        GooglePlacesService service = new GooglePlacesService(RestClient.builder(), mapper, "test-key");
        var reviews = mapper.readTree("""
                [
                  {
                    "authorAttribution": {"displayName": "Maria", "uri": "//www.google.com/maps/contrib/123"},
                    "rating": 5,
                    "text": {"text": "Excelente!"},
                    "publishTime": "2026-01-01T12:00:00Z",
                    "relativePublishTimeDescription": "há um ano",
                    "googleMapsUri": "https://www.google.com/maps/reviews/1"
                  },
                  {"authorAttribution": {"uri": "https://example.com"}, "googleMapsUri": "https://example.com"}
                ]
                """);

        var result = service.reviews(reviews);
        assertEquals(2, result.size());
        assertEquals("Maria", result.get(0).author());
        assertEquals("https://www.google.com/maps/contrib/123", result.get(0).authorUrl());
        assertEquals(5.0, result.get(0).rating());
        assertEquals("Excelente!", result.get(0).text());
        assertEquals("2026-01-01T12:00:00Z", result.get(0).publishedAt());
        assertEquals("https://www.google.com/maps/reviews/1", result.get(0).googleMapsUrl());
        assertEquals("Autor não informado", result.get(1).author());
        assertNull(result.get(1).rating());
        assertNull(result.get(1).authorUrl());
        assertNull(result.get(1).googleMapsUrl());
    }
}
