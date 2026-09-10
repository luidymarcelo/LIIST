type LiistBrandProps = {
  className?: string;
  context?: string;
  product?: string;
  compact?: boolean;
};

type LiistCartMarkProps = {
  className?: string;
  title?: string;
};

export function LiistCartMark({ className = "", title = "LIIST Commerce" }: LiistCartMarkProps) {
  return (
    <span className={`liist-cart-mark ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 64 64" role="img" aria-label={title} focusable="false">
        <rect className="liist-cart-mark-bg" x="3" y="3" width="58" height="58" rx="15" />
        <path className="liist-cart-mark-line" d="M17.5 21.6h7.1l5.8 14.8h19.3" />
        <circle className="liist-cart-mark-dot" cx="32.1" cy="43.6" r="3.2" />
        <circle className="liist-cart-mark-dot" cx="48.7" cy="43.6" r="3.2" />
        <path className="liist-cart-mark-line liist-cart-mark-ii" d="M32.1 50.1v5.2M48.7 50.1v5.2" />
      </svg>
    </span>
  );
}

export function LiistWordmark({ product = "Commerce", compact = false }: Pick<LiistBrandProps, "product" | "compact">) {
  return (
    <span className="liist-wordmark-wrap">
      <strong className="liist-wordmark" aria-label="LIIST">
        LIIST
      </strong>
      {!compact ? <small>{product}</small> : null}
    </span>
  );
}

export function LiistBrand({ className = "", context, product = "Commerce", compact = false }: LiistBrandProps) {
  return (
    <span className={`liist-brand ${compact ? "compact" : ""} ${className}`.trim()}>
      <LiistCartMark />
      <span>
        <LiistWordmark product={product} compact={compact} />
        {context ? <small className="liist-context">{context}</small> : null}
      </span>
    </span>
  );
}
