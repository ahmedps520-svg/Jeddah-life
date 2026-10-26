import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "dark" | "danger" | "outline-light";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";
const variants: Record<Variant, string> = {
  primary: "bg-sea-500 text-white hover:bg-sea-600 shadow-[0_8px_20px_-10px_rgb(18_124_131/0.8)]",
  secondary: "bg-white text-ink-900 ring-1 ring-sand-300 hover:ring-ink-300",
  ghost: "text-ink-700 hover:bg-sand-200",
  dark: "bg-ink-900 text-sand-50 hover:bg-ink-800",
  danger: "bg-coral-500 text-white hover:brightness-95",
  "outline-light": "text-white ring-1 ring-white/40 hover:bg-white/10",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-13 px-7 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
