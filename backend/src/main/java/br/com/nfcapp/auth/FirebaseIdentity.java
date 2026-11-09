package br.com.nfcapp.auth;

public record FirebaseIdentity(String uid, String email, String name, String pictureUrl) {
}
