package br.com.nfcapp.auth;

public class EmailAlreadyLinkedException extends RuntimeException {

    public EmailAlreadyLinkedException() {
        super("This email address is linked to a different identity");
    }
}
