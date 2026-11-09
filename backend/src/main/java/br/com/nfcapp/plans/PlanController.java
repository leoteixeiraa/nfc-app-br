package br.com.nfcapp.plans;

import java.util.List;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import br.com.nfcapp.auth.CurrentUser;

@RestController
public class PlanController {
    private final PlanService plans;

    public PlanController(PlanService plans) {
        this.plans = plans;
    }

    @GetMapping("/api/plans")
    public List<PlanService.Plan> availablePlans() {
        return plans.availablePlans();
    }

    @GetMapping("/api/organizations/current/plan")
    public ResponseEntity<PlanService.CurrentPlan> currentPlan(@AuthenticationPrincipal CurrentUser user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(plans.currentPlan(user.id()));
    }
}
