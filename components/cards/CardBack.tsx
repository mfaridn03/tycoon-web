interface CardBackProps {
  className?: string;
}

export function CardBack({ className }: CardBackProps) {
  return (
    <div
      className={className}
      role="img"
      aria-label="Card back"
      style={{ display: "inline-block", lineHeight: 0 }}
    >
      <svg
        viewBox="0 0 80 112"
        style={{ display: "block", width: "100%", height: "100%" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer card shape */}
        <rect
          x="0.5"
          y="0.5"
          width="79"
          height="111"
          rx="5"
          fill="white"
          stroke="#d4d4d4"
          strokeWidth="1"
        />

        {/* Inset dark field */}
        <rect x="5" y="5" width="70" height="102" rx="3" fill="#1c1c1c" />

        {/* Diagonal grid lines */}
        <g stroke="#333" strokeWidth="0.75" strokeLinecap="round">
          {/* top-left to bottom-right diagonals */}
          {[-70, -56, -42, -28, -14, 0, 14, 28, 42, 56, 70, 84, 98, 112, 126].map((offset) => (
            <line
              key={`d1-${offset}`}
              x1={5 + offset}
              y1="5"
              x2={5 + offset + 102}
              y2="107"
              clipPath="url(#cardClip)"
            />
          ))}
          {/* top-right to bottom-left diagonals */}
          {[-70, -56, -42, -28, -14, 0, 14, 28, 42, 56, 70, 84, 98, 112, 126].map((offset) => (
            <line
              key={`d2-${offset}`}
              x1={75 - offset}
              y1="5"
              x2={75 - offset - 102}
              y2="107"
              clipPath="url(#cardClip)"
            />
          ))}
        </g>

        <defs>
          <clipPath id="cardClip">
            <rect x="5" y="5" width="70" height="102" rx="3" />
          </clipPath>
        </defs>

        {/* Inner border on inset */}
        <rect
          x="5"
          y="5"
          width="70"
          height="102"
          rx="3"
          fill="none"
          stroke="#444"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
