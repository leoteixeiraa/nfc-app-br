package br.com.nfcapp.health;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ApiStatusController {

    @GetMapping("/api/status")
    public Map<String, String> status() {
        return Map.of("status", "UP", "application", "NFC.APP");
    }
}
