import { character, symbol, type Expression, type Pose } from "../../../brand/mascot.mjs";

// The mascot as inline SVG (crisp at any size, eyes blink via CSS, zero image requests).
export function Mascot({
  expr = "skeptic",
  pose = "down",
  prop,
  className,
  label,
  tilt = 0,
  legs = true,
  dark = false,
}: {
  expr?: Expression;
  pose?: Pose;
  prop?: "stamp" | "magnifier";
  className?: string;
  label?: string;
  tilt?: number;
  legs?: boolean;
  dark?: boolean;
}) {
  const inner = character({ expr, pose, prop, tilt, withLegs: legs, dark });
  return (
    <svg
      viewBox="0 0 400 600"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

export function LogoMark({ className, bg }: { className?: string; bg?: string }) {
  const svg = symbol({ bg }).replace("<svg ", `<svg class="${className ?? ""}" aria-hidden="true" `);
  return <span className="inline-flex shrink-0" dangerouslySetInnerHTML={{ __html: svg }} />;
}
