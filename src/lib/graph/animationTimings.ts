/**
 * Animation timing constants derived from interaction spec §12.
 *
 * All 21 rows of the animation timing table are encoded here as typed
 * constants. Consumers should reference these instead of inline magic numbers
 * so that the performance-guard fallback (performanceGuardThresholdMs) and any
 * future global timing adjustments apply consistently.
 *
 * NOTE: "3D mode switch" is deferred per spec; its entry is omitted.
 */
export const ANIMATION_TIMINGS = {
  /** Node fade-in on filter relax: easeOutCubic */
  nodeFadeIn: { durationMs: 200, easing: "cubic-bezier(0.33,1,0.68,1)" },
  /** Node fade-out on filter tighten: easeInQuad */
  nodeFadeOut: { durationMs: 150, easing: "cubic-bezier(0.11,0,0.5,0)" },
  /** Edge follows endpoints: easeOutCubic */
  edgeFollow: { durationMs: 200, easing: "cubic-bezier(0.33,1,0.68,1)" },
  /** Cluster expand (super→members): easeOutBack */
  clusterExpand: { durationMs: 300, easing: "cubic-bezier(0.34,1.56,0.64,1)" },
  /** Cluster collapse (members→super): easeInCubic */
  clusterCollapse: { durationMs: 200, easing: "cubic-bezier(0.32,0,0.67,0)" },
  /** Focus dim (non-focus nodes): easeOutCubic */
  focusDim: { durationMs: 200, easing: "cubic-bezier(0.33,1,0.68,1)" },
  /** Focus glow reveal: easeOutCubic */
  focusGlow: { durationMs: 200, easing: "cubic-bezier(0.33,1,0.68,1)" },
  /** Camera jump to preset or search result: easeInOutCubic */
  cameraJump: { durationMs: 400, easing: "cubic-bezier(0.65,0,0.35,1)" },
  /** Mode switch static→dynamic: linear */
  modeStaticToDynamic: { durationMs: 150, easing: "linear" },
  /** Mode switch dynamic→static: instant */
  modeDynamicToStatic: { durationMs: 0, easing: "linear" },
  /** Filter sidebar expand: easeInOutCubic (CSS width) */
  filterSidebarExpand: { durationMs: 200, easing: "cubic-bezier(0.65,0,0.35,1)" },
  /** Filter sidebar collapse: easeInOutCubic (CSS width) */
  filterSidebarCollapse: { durationMs: 200, easing: "cubic-bezier(0.65,0,0.35,1)" },
  /** Search overlay open: easeOutCubic */
  searchOverlayOpen: { durationMs: 150, easing: "cubic-bezier(0.33,1,0.68,1)" },
  /** Search overlay close: easeInCubic */
  searchOverlayClose: { durationMs: 120, easing: "cubic-bezier(0.11,0,0.5,0)" },
  /** Bottom sheet open (mobile): easeOutCubic */
  bottomSheetOpen: { durationMs: 300, easing: "cubic-bezier(0.33,1,0.68,1)" },
  /** Bottom sheet close (mobile): easeInCubic */
  bottomSheetClose: { durationMs: 250, easing: "cubic-bezier(0.11,0,0.5,0)" },
  /** Onboarding overlay in: easeOutCubic */
  onboardingOverlayIn: { durationMs: 250, easing: "cubic-bezier(0.33,1,0.68,1)" },
  /** Node popover in: easeOutCubic */
  nodePopoverIn: { durationMs: 150, easing: "cubic-bezier(0.33,1,0.68,1)" },
  /** Context menu in: easeOutCubic */
  contextMenuIn: { durationMs: 100, easing: "cubic-bezier(0.33,1,0.68,1)" },
  /**
   * Performance-guard threshold in ms (≈ <30fps).
   * When useAnimationBudget reports slowFrame, consumers should degrade to
   * instant setState() instead of animate().
   */
  performanceGuardThresholdMs: 33,
} as const;

export type AnimationTimingKey = keyof typeof ANIMATION_TIMINGS;
