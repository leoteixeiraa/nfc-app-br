package br.com.nfcapp.auth;

import java.io.Serializable;
import java.util.UUID;

public record CurrentUser(UUID id, String email, String name, String pictureUrl) implements Serializable {
}
