package br.com.nfcapp.tags;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class PixPayloadService {
    public String createPayload(String key, String receiverName, String city) {
        String normalizedKey = normalizePixKey(key);
        String normalizedName = require(receiverName, 25, "O nome do recebedor deve ter até 25 caracteres.");
        String normalizedCity = require(city, 15, "A cidade deve ter até 15 caracteres.");

        String merchantAccount = field("00", "br.gov.bcb.pix") + field("01", normalizedKey);
        String additionalData = field("05", "***");
        String payload = field("00", "01")
                + field("01", "11")
                + field("26", merchantAccount)
                + field("52", "0000")
                + field("53", "986")
                + field("58", "BR")
                + field("59", normalizedName)
                + field("60", normalizedCity)
                + field("62", additionalData)
                + "6304";
        return payload + crc16(payload);
    }

    private String require(String value, int maxLength, String error) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, error);
        }
        String normalized = Normalizer.normalize(value.trim(), Normalizer.Form.NFC);
        if (normalized.length() > maxLength || normalized.getBytes(StandardCharsets.UTF_8).length > 99) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, error);
        }
        if (normalized.chars().anyMatch(Character::isISOControl)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, error);
        }
        return normalized;
    }

    private String normalizePixKey(String value) {
        String normalized = require(value, 77, "Informe uma chave Pix válida.");
        String lower = normalized.toLowerCase(Locale.ROOT);
        boolean email = Pattern.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", normalized);
        String digits = normalized.replaceAll("\\D", "");
        boolean cpf = digits.length() == 11 && isValidCpf(digits);
        boolean cnpj = digits.length() == 14 && isValidCnpj(digits);
        boolean random = Pattern.matches("(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", normalized);
        if (cpf || cnpj) {
            return digits;
        }
        if (email || random) {
            return normalized;
        }
        if (Pattern.matches("\\+55\\d{10,11}", normalized)) {
            return normalized;
        }
        if (normalized.matches("[+\\d\\s().-]+") && digits.length() == 12 && digits.startsWith("55")) {
            return "+" + digits;
        }
        if (normalized.matches("[\\d\\s().-]+") && (digits.length() == 10 || digits.length() == 11)) {
            return "+55" + digits;
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe uma chave Pix válida (CPF/CNPJ, e-mail, telefone ou chave aleatória).");
    }

    private boolean isValidCpf(String cpf) {
        if (cpf.chars().distinct().count() == 1) {
            return false;
        }
        int first = cpfChecksum(cpf.substring(0, 9), 10);
        int second = cpfChecksum(cpf.substring(0, 10), 11);
        return cpf.charAt(9) - '0' == first && cpf.charAt(10) - '0' == second;
    }

    private boolean isValidCnpj(String cnpj) {
        if (cnpj.chars().distinct().count() == 1) {
            return false;
        }
        int first = cnpjChecksum(cnpj.substring(0, 12));
        int second = cnpjChecksum(cnpj.substring(0, 13));
        return cnpj.charAt(12) - '0' == first && cnpj.charAt(13) - '0' == second;
    }

    private int cpfChecksum(String value, int firstWeight) {
        int total = 0;
        for (int index = 0; index < value.length(); index++) {
            total += (value.charAt(index) - '0') * (firstWeight - index);
        }
        return checksumDigit(total);
    }

    private int cnpjChecksum(String value) {
        int total = 0;
        int weight = 2;
        for (int index = value.length() - 1; index >= 0; index--) {
            total += (value.charAt(index) - '0') * weight;
            weight = weight == 9 ? 2 : weight + 1;
        }
        return checksumDigit(total);
    }

    private int checksumDigit(int total) {
        int remainder = total % 11;
        return remainder < 2 ? 0 : 11 - remainder;
    }

    private String field(String id, String value) {
        int length = value.getBytes(StandardCharsets.UTF_8).length;
        if (length > 99) {
            throw new IllegalArgumentException("Campo inválido no payload Pix.");
        }
        return id + "%02d".formatted(length) + value;
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
