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
    <span className={`liist-cart-mark ${className}`.trim()} role="img" aria-label={title}>
      <img src="/liist-logo.svg" alt="" aria-hidden="true" />
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
