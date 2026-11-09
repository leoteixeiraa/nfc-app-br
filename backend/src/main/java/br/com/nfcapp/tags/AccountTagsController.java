package br.com.nfcapp.tags;

import java.util.List;

import org.springframework.http.CacheControl;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import br.com.nfcapp.auth.CurrentUser;

@RestController
@RequestMapping("/api/account/tags")
@ConditionalOnProperty(name = "app.account-tags.enabled", havingValue = "true")
public class AccountTagsController {
    private final TagService tags;

    public AccountTagsController(TagService tags) {
        this.tags = tags;
    }

    @GetMapping
    public ResponseEntity<List<TagService.TagResponse>> list(@AuthenticationPrincipal CurrentUser user) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(tags.listForAccount(userId(user)));
    }

    @PostMapping("/claim")
    public ResponseEntity<List<TagService.TagResponse>> claim(
            @AuthenticationPrincipal CurrentUser user, @RequestBody ClaimRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(tags.claimPublishedTags(userId(user), request.tags()));
    }

    @PutMapping("/{code}")
    public ResponseEntity<TagService.TagResponse> update(
            @AuthenticationPrincipal CurrentUser user, @PathVariable String code,
            @RequestBody TagService.TagRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(tags.updateForAccount(userId(user), code, request));
    }

    @DeleteMapping("/{code}")
    public ResponseEntity<Void> deactivate(@AuthenticationPrincipal CurrentUser user, @PathVariable String code) {
        tags.deactivateForAccount(userId(user), code);
        return ResponseEntity.noContent().build();
    }

    private java.util.UUID userId(CurrentUser user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return user.id();
    }

    public record ClaimRequest(List<TagService.TagClaim> tags) {
    }
}
