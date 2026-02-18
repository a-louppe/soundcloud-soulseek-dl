import { Component, input } from '@angular/core';

/**
 * Spinner component using CSS animation.
 * A lightweight replacement for MatProgressSpinner.
 *
 * Usage: <app-spinner [diameter]="40" />
 *
 * The spinner inherits currentColor for its stroke.
 */
@Component({
  selector: 'app-spinner',
  standalone: true,
  template: `
    <div
      class="animate-spin rounded-full border-2 border-current border-t-transparent"
      [style.width.px]="diameter()"
      [style.height.px]="diameter()"
      role="progressbar"
      aria-label="Loading"
    ></div>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ],
})
export class SpinnerComponent {
  /** Diameter of the spinner in pixels. Defaults to 24. */
  diameter = input<number>(24);
}
