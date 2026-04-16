interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 40, className }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Lumen logo"
      width={size}
      height={size}
      className={className}
    />
  );
}
