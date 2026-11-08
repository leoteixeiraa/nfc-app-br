package br.com.nfcapp.tags;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class GooglePlacesService {
    private static final Logger LOGGER = LoggerFactory.getLogger(GooglePlacesService.class);

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

    public PlaceDetails details(String placeId) {
        requireApiKey();
        try {
            String response = restClient.get()
                    .uri("/places/{id}", placeId)
                    .header("X-Goog-Api-Key", apiKey)
                    .header(
                            "X-Goog-FieldMask",
                            "id,displayName,formattedAddress,rating,userRatingCount,photos.name,"
                                    + "photos.authorAttributions,googleMapsUri,googleMapsLinks.writeAReviewUri")
                    .retrieve()
                    .body(String.class);
            JsonNode place = objectMapper.readTree(response);
            JsonNode photo = place.path("photos").path(0);
            String photoUrl = photo.isMissingNode() ? null : photoUrl(placeId, photo.path("name").asText(""));
            String reviewUrl = place.path("googleMapsLinks").path("writeAReviewUri").asText("");
            TagService.validateDestination("google-review", reviewUrl);
            return new PlaceDetails(
                    place.path("id").asText(placeId),
                    place.path("displayName").path("text").asText(""),
                    place.path("formattedAddress").asText(""),
                    place.has("rating") ? place.path("rating").asDouble() : null,
                    place.has("userRatingCount") ? place.path("userRatingCount").asInt() : null,
                    photoUrl,
                    photo.isMissingNode() ? List.of() : photoAttributions(photo),
                    googleMapsUrl(place.path("googleMapsUri").asText("")),
                    reviewUrl);
        } catch (RestClientException | java.io.IOException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY, "Não foi possível carregar as informações deste estabelecimento.");
        }
    }

    private String photoUrl(String placeId, String photoName) {
        String[] parts = photoName.split("/", 4);
        if (parts.length != 4
                || !parts[0].equals("places")
                || !parts[1].equals(placeId)
                || !parts[2].equals("photos")
                || parts[3].isBlank()) {
            LOGGER.warn("Google returned an invalid photo reference for place {}.", placeId);
            return null;
        }
        try {
            String response = restClient.get()
                    .uri(
                            "/places/{placeId}/photos/{photoId}/media?maxWidthPx=640&skipHttpRedirect=true",
                            parts[1],
                            parts[3])
                    .header("X-Goog-Api-Key", apiKey)
                    .retrieve()
                    .body(String.class);
            String uri = objectMapper.readTree(response).path("photoUri").asText("");
            return allowedGoogleUrl(uri, "googleusercontent.com");
        } catch (RestClientException | java.io.IOException exception) {
            LOGGER.warn("Could not retrieve a photo for Google place {}.", placeId, exception);
            return null;
        }
    }

    private List<PhotoAttribution> photoAttributions(JsonNode photo) {
        List<PhotoAttribution> attributions = new ArrayList<>();
        for (JsonNode attribution : photo.path("authorAttributions")) {
            String name = attribution.path("displayName").asText("");
            String uri = attribution.path("uri").asText("");
            if (!name.isBlank()) {
                if (uri.startsWith("//")) {
                    uri = "https:" + uri;
                }
                attributions.add(new PhotoAttribution(name, allowedGoogleUrl(uri, "google.com")));
            }
        }
        return attributions;
    }

    private String googleMapsUrl(String uri) {
        return allowedGoogleUrl(uri, "google.com");
    }

    private String allowedGoogleUrl(String value, String domain) {
        try {
            URI uri = URI.create(value);
            String host = uri.getHost();
            if ("https".equalsIgnoreCase(uri.getScheme())
                    && host != null
                    && (host.equals(domain) || host.endsWith("." + domain))) {
                return uri.toString();
            }
        } catch (IllegalArgumentException ignored) {
            return null;
        }
        return null;
    }

    private void requireApiKey() {
        if (apiKey == null || apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "A pesquisa do Google não está configurada. Você pode inserir o link manualmente.");
        }
    }

    public record PlaceResult(String placeId, String name, String address) {
    }

    public record PhotoAttribution(String displayName, String uri) {
    }

    public record PlaceDetails(
            String placeId,
            String name,
            String address,
            Double rating,
            Integer userRatingCount,
            String photoUrl,
            List<PhotoAttribution> photoAttributions,
            String googleMapsUrl,
            String reviewUrl) {
    }
}
