import { Component, inject } from '@angular/core';
import { CurrentPlanService } from '../../../../core/plans/current-plan.service';

@Component({
  selector: 'app-premium-avatar',
  host: {
    class: 'relative flex shrink-0',
    '[class.nfc-premium-avatar]': 'plan.isPremium()',
    '[class.nfc-free-avatar]': 'plan.label() !== null && !plan.isPremium()',
  },
  template: `
    <ng-content />
    @if (plan.label(); as label) {
      <span class="nfc-premium-avatar__badge" aria-hidden="true">
        {{ label }}
      </span>
      <span class="sr-only">Plano {{ label }}</span>
    }
  `,
  styles: `
    :host(.nfc-premium-avatar), :host(.nfc-free-avatar) {
      border-radius: 50%;
      padding: 2px;
    }

    :host(.nfc-premium-avatar) {
      background: linear-gradient(135deg, #f8e6a3, #bd852b 55%, #f5d477);
      box-shadow: var(--nfc-premium-shadow, 0 2px 8px rgba(142, 94, 24, 0.2));
    }

    :host(.nfc-free-avatar) {
      background: #d0d5dd;
    }

    .nfc-premium-avatar__badge {
      position: absolute;
      right: -7px;
      bottom: -4px;
      display: inline-flex;
      min-width: 32px;
      height: 18px;
      align-items: center;
      justify-content: center;
      padding: 0 5px;
      border: 1.5px solid white;
      border-radius: 9999px;
      background: #f2f4f7;
      color: #475467;
      box-shadow: 0 2px 5px rgba(16, 24, 40, 0.18);
      font-size: 8px;
      font-weight: 800;
      line-height: 1;
    }

    :host(.nfc-premium-avatar) .nfc-premium-avatar__badge {
      background: #a56d18;
      color: white;
    }

    :host-context(.dark) {
      --nfc-premium-shadow: 0 2px 10px rgba(189, 133, 43, 0.3);
    }

    :host-context(.dark).nfc-free-avatar {
      background: #667085;
    }

    :host-context(.dark) .nfc-premium-avatar__badge {
      border-color: #1d2939;
      background: #475467;
      color: #f2f4f7;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
    }

    :host-context(.dark).nfc-premium-avatar .nfc-premium-avatar__badge {
      background: #a56d18;
      color: white;
    }
  `,
})
export class PremiumAvatarComponent {
  readonly plan = inject(CurrentPlanService);
}
