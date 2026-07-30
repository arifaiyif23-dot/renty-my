import type { ComponentType, SVGProps } from "react";
import type { IconStyle } from "./types";
import { ICON_STYLE_PATHS } from "./types";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const modules = import.meta.glob<IconComponent>(
  "/src/assets/icons/**/*.svg",
  { query: "?react", import: "default", eager: false },
);

function getIconComponent(
  name: string,
  style: IconStyle,
): (() => Promise<IconComponent>) | null {
  const path = `/src/assets/icons/${ICON_STYLE_PATHS[style]}/${name}.svg`;
  return modules[path] ?? null;
}

export async function loadIcon(
  name: string,
  style: IconStyle,
): Promise<IconComponent | null> {
  const loader = getIconComponent(name, style);
  if (!loader) return null;
  try {
    return await loader();
  } catch {
    return null;
  }
}

export function getAvailableIcons(): { name: string; style: IconStyle }[] {
  const icons: { name: string; style: string }[] = [];
  for (const path of Object.keys(modules)) {
    const match = path.match(/\/src\/assets\/icons\/(.+?)\/(.+)\.svg$/);
    if (match) {
      icons.push({ name: match[2], style: match[1] });
    }
  }
  return icons as { name: string; style: IconStyle }[];
}
