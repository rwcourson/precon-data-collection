import type { ComponentType } from "react";
import {
  Archive,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  ChevronRight,
  Eye,
  FilePenLine,
  FileText,
  GitCompare,
  Home,
  LayoutGrid,
  MoreHorizontal,
  Moon,
  Palette,
  Pin,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  TrendingUp,
  type LucideProps,
} from "lucide-react-native";
import { ICON_DEFAULTS } from "@/src/theme/tokens";

/**
 * Curated Lucide set for Precon chrome. All icons use thin stroke (1.5)
 * and currentColor-style theming via the `color` prop.
 */
export const preconIcons = {
  home: Home,
  calendar: Calendar,
  pen: FilePenLine,
  grid: LayoutGrid,
  more: MoreHorizontal,
  search: Search,
  bell: Bell,
  sun: Sun,
  moon: Moon,
  chevronRight: ChevronRight,
  pin: Pin,
  archive: Archive,
  chart: BarChart3,
  fileText: FileText,
  shield: ShieldCheck,
  sparkles: Sparkles,
  palette: Palette,
  trending: TrendingUp,
  compare: GitCompare,
  book: BookOpen,
  trash: Trash2,
  settings: Settings,
  smartphone: Smartphone,
  eye: Eye,
} as const;

export type PreconIconName = keyof typeof preconIcons;

export type IconProps = {
  name: PreconIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** When true, slightly heavier stroke for selected/active states only. */
  active?: boolean;
} & Omit<LucideProps, "size" | "color" | "strokeWidth" | "ref">;

/**
 * Thin Lucide icon — default stroke 1.5 (not the library’s heavy 2).
 * Screens pass `name` only; size/stroke come from ICON_DEFAULTS.
 */
export function Icon({
  name,
  size = ICON_DEFAULTS.size,
  color = "#52525b",
  strokeWidth,
  active = false,
  ...rest
}: IconProps) {
  const Comp = preconIcons[name] as ComponentType<LucideProps>;
  const stroke =
    strokeWidth ??
    (active ? ICON_DEFAULTS.strokeWidthActive : ICON_DEFAULTS.strokeWidth);
  return <Comp size={size} color={color} strokeWidth={stroke} absoluteStrokeWidth={false} {...rest} />;
}

/** Tab bar helper — same Lucide set, tab sizing. */
export function TabIcon({
  name,
  color,
  focused,
  size = ICON_DEFAULTS.tabSize,
}: {
  name: PreconIconName;
  color: string;
  focused: boolean;
  size?: number;
}) {
  return (
    <Icon
      name={name}
      size={size}
      color={color}
      active={focused}
      strokeWidth={focused ? ICON_DEFAULTS.strokeWidthActive : ICON_DEFAULTS.strokeWidth}
    />
  );
}
