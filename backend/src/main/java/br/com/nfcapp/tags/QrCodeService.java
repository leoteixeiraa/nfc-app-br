package br.com.nfcapp.tags;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import org.springframework.stereotype.Service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;

@Service
public class QrCodeService {
    public String toDataUri(String value) {
        return toDataUri(value, 2);
    }

    public String toPermanentLinkDataUri(String value) {
        return toDataUri(value, 4);
    }

    private String toDataUri(String value, int margin) {
        try {
            var hints = java.util.Map.of(
                    EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M,
                    EncodeHintType.MARGIN, margin);
            var matrix = new QRCodeWriter().encode(value, BarcodeFormat.QR_CODE, 240, 240, hints);
            StringBuilder svg = new StringBuilder(
                    "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 240 240\"><path fill=\"#fff\" d=\"M0 0h240v240H0z\"/><path fill=\"#111\" d=\"");
            for (int y = 0; y < matrix.getHeight(); y++) {
                int start = -1;
                for (int x = 0; x <= matrix.getWidth(); x++) {
                    boolean dark = x < matrix.getWidth() && matrix.get(x, y);
                    if (dark && start < 0) {
                        start = x;
                    } else if (!dark && start >= 0) {
                        svg.append('M').append(start).append(' ').append(y)
                                .append('h').append(x - start).append("v1h-").append(x - start).append("z");
                        start = -1;
                    }
                }
            }
            svg.append("\"/></svg>");
            return "data:image/svg+xml;base64,"
                    + Base64.getEncoder().encodeToString(svg.toString().getBytes(StandardCharsets.UTF_8));
        } catch (Exception exception) {
            throw new IllegalStateException("Não foi possível gerar o QR Code.", exception);
        }
    }
}
