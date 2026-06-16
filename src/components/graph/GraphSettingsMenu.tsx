/**
 * GraphSettingsMenu — dropdown for graph-wide settings.
 *
 * P5-08: Color-blind palette toggle (primary feature).
 * This dropdown is positioned in the top toolbar next to the grouping selector
 * and other controls. It uses a gear icon (Settings lucide-react) as the trigger.
 *
 * Features:
 *   - Palette toggle: "Default" / "Color-blind (deuteranopia-safe)"
 *   - Label shows current palette + icon
 *   - Immediate effect: toggle updates all color consumers in the graph
 *   - Preference persisted in localStorage['mw-graph-palette']
 *
 * Note: Keyboard shortcuts (e.g., G for grouping, other hotkeys) are handled
 * separately in keyboard navigation. This menu is UI only.
 */

"use client";

import React from "react";
import { Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { usePaletteKey } from "@/lib/graph/palette-context";

export function GraphSettingsMenu() {
  const [paletteKey, setPaletteKey] = usePaletteKey();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0"
          title="Graph settings"
        >
          <Settings className="h-4 w-4" />
          <span className="sr-only">Graph settings</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Palette</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={paletteKey === "default"}
          onCheckedChange={() => setPaletteKey("default")}
        >
          Default (WCAG AA)
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={paletteKey === "colorblind"}
          onCheckedChange={() => setPaletteKey("colorblind")}
        >
          Color-blind (deuteranopia-safe)
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
