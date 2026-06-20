/**
 * @miethe/ui/primitives Jest manual mock.
 *
 * Provides minimal stubs for Badge, ScrollArea, Popover/PopoverContent/PopoverTrigger
 * imported by ArtifactSearchDialog and related components.
 */

import React from "react";

// ---------------------------------------------------------------------------
// Badge stub
// ---------------------------------------------------------------------------

export interface BadgeProps {
  variant?: string;
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export function Badge({ children, className }: BadgeProps) {
  return (
    <span data-testid="badge-stub" className={className}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ScrollArea stub
// ---------------------------------------------------------------------------

export interface ScrollAreaProps {
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export function ScrollArea({ children, className }: ScrollAreaProps) {
  return (
    <div data-testid="scroll-area-stub" className={className}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Popover stubs
// ---------------------------------------------------------------------------

export interface PopoverProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Popover({ children }: PopoverProps) {
  return <>{children}</>;
}

export interface PopoverTriggerProps {
  children?: React.ReactNode;
  asChild?: boolean;
}

export function PopoverTrigger({ children }: PopoverTriggerProps) {
  return <>{children}</>;
}

export interface PopoverContentProps {
  children?: React.ReactNode;
  className?: string;
  align?: string;
  side?: string;
}

export function PopoverContent({ children, className }: PopoverContentProps) {
  return (
    <div data-testid="popover-content-stub" className={className}>
      {children}
    </div>
  );
}
