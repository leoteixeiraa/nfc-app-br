package br.com.nfcapp.tags;

import java.util.ArrayList;
import java.util.List;
import java.time.Duration;
import java.net.http.HttpClient;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class GooglePlacesService {
    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;

    public GooglePlacesService(
            RestClient.Builder builder,
            ObjectMapper objectMapper,
            @Value("${app.google-places.api-key:}") String apiKey) {
        JdkClientHttpRequestFactory requestFactory =
                new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build());
        requestFactory.setReadTimeout(Duration.ofSeconds(8));
        this.restClient = builder.requestFactory(requestFactory).baseUrl("https://places.googleapis.com/v1").build();
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
    }

    public List<PlaceResult> search(String query) {
        requireApiKey();
        try {
            String response = restClient.post()
                    .uri("/places:searchText")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-Goog-Api-Key", apiKey)
                    .header("X-Goog-FieldMask", "places.id,places.displayName,places.formattedAddress")
                    .body(java.util.Map.of("textQuery", query, "languageCode", "pt-BR"))
                    .retrieve()
                    .body(String.class);
            JsonNode places = objectMapper.readTree(response).path("places");
            List<PlaceResult> results = new ArrayList<>();
            for (JsonNode place : places) {
                String id = place.path("id").asText("");
                String name = place.path("displayName").path("text").asText("");
                String address = place.path("formattedAddress").asText("");
                if (!id.isBlank() && !name.isBlank()) {
                    results.add(new PlaceResult(id, name, address));
                }
            }
            return results;
        } catch (RestClientException | java.io.IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "A pesquisa no Google está temporariamente indisponível.");
        }
    }

    public String reviewUrl(String placeId) {
        requireApiKey();
        try {
            String response = restClient.get()
                    .uri("/places/{id}", placeId)
                    .header("X-Goog-Api-Key", apiKey)
                    .header("X-Goog-FieldMask", "googleMapsLinks.writeAReviewUri")
                    .retrieve()
                    .body(String.class);
            String url = objectMapper.readTree(response).path("googleMapsLinks").path("writeAReviewUri").asText("");
            TagService.validateDestination("google-review", url);
            return url;
        } catch (RestClientException | java.io.IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Não foi possível obter o link de avaliação desta empresa.");
        }
    }

    private void requireApiKey() {
        if (apiKey == null || apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "A pesquisa do Google não está configurada. Você pode inserir o link manualmente.");
        }
    }

    public record PlaceResult(String placeId, String name, String address) {
    }
}
