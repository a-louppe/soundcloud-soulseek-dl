import {
  Directive,
  ElementRef,
  HostListener,
  inject,
  input,
  OnDestroy,
  Renderer2,
} from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Component } from '@angular/core';

/**
 * Simple tooltip component displayed via CDK Overlay.
 * Uses the glassmorphism design system for consistent styling.
 */
@Component({
  selector: 'app-tooltip-content',
  standalone: true,
  template: `<div class="tooltip-content">{{ text }}</div>`,
  styles: [
    `
      .tooltip-content {
        padding: 6px 10px;
        font-size: 12px;
        line-height: 1.4;
        color: var(--txt-primary);
        background: var(--surface-overlay);
        border: 1px solid var(--border-subtle);
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        max-width: 250px;
        word-wrap: break-word;
      }
    `,
  ],
})
export class TooltipContentComponent {
  text = '';
}

/**
 * Tooltip directive using CDK Overlay.
 *
 * A lightweight replacement for MatTooltip that fits the glassmorphism design.
 *
 * Usage:
 * - Static: <button appTooltip="Click me">...</button>
 * - Dynamic: <span [appTooltip]="track.title">...</span>
 *
 * The tooltip appears after a short delay on mouseenter and hides on mouseleave.
 */
@Directive({
  selector: '[appTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnDestroy {
  private readonly overlay = inject(Overlay);
  private readonly elementRef = inject(ElementRef);
  private readonly renderer = inject(Renderer2);

  /** The tooltip text to display */
  readonly appTooltip = input.required<string>();

  private overlayRef: OverlayRef | null = null;
  private showTimeout: ReturnType<typeof setTimeout> | null = null;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;

  @HostListener('mouseenter')
  onMouseEnter(): void {
    this.cancelHide();
    // Delay showing tooltip to avoid flickering on quick mouse movements
    this.showTimeout = setTimeout(() => this.show(), 200);
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.cancelShow();
    // Small delay before hiding to allow moving to adjacent elements
    this.hideTimeout = setTimeout(() => this.hide(), 100);
  }

  @HostListener('click')
  onClick(): void {
    // Hide tooltip on click (action was taken)
    this.hide();
  }

  ngOnDestroy(): void {
    this.cancelShow();
    this.cancelHide();
    this.hide();
  }

  private show(): void {
    const text = this.appTooltip();
    if (!text || this.overlayRef) return;

    // Create overlay positioned below the host element
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(this.elementRef)
      .withPositions([
        // Prefer below
        { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
        // Fallback above
        { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
        // Fallback right
        { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: 8 },
        // Fallback left
        { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: -8 },
      ]);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.close(),
    });

    const portal = new ComponentPortal(TooltipContentComponent);
    const componentRef = this.overlayRef.attach(portal);
    componentRef.instance.text = text;
  }

  private hide(): void {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }
  }

  private cancelShow(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
  }

  private cancelHide(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }
}
