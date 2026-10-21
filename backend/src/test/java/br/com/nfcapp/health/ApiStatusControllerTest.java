package br.com.nfcapp.health;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ApiStatusControllerTest {

    private final ApiStatusController controller = new ApiStatusController();

    @Test
    void returnsMinimalPublicStatus() {
        assertThat(controller.status())
                .containsEntry("status", "UP")
                .containsEntry("application", "NFC.APP")
                .hasSize(2);
    }
}
