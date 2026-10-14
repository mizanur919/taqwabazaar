import {
  BatteryCharging,
  Cable,
  Camera,
  Gamepad2,
  Headphones,
  Keyboard,
  Laptop,
  Monitor,
  Mouse,
  Package,
  Printer,
  Router,
  Smartphone,
  Speaker,
  Tablet,
  Tv,
  Watch,
  type LucideIcon,
} from "lucide-react";

// Icons an admin can pick for a category (Admin → Categories).
export const categoryIcons: Record<string, LucideIcon> = {
  smartphone: Smartphone,
  laptop: Laptop,
  tablet: Tablet,
  headphones: Headphones,
  watch: Watch,
  "battery-charging": BatteryCharging,
  cable: Cable,
  camera: Camera,
  gamepad: Gamepad2,
  speaker: Speaker,
  monitor: Monitor,
  tv: Tv,
  keyboard: Keyboard,
  mouse: Mouse,
  router: Router,
  printer: Printer,
  package: Package,
};

export function CategoryIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = (name && categoryIcons[name]) || Package;
  return <Icon className={className} strokeWidth={1.25} />;
}
