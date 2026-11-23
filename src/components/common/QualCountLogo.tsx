import React from 'react';

interface QualCountLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export const QualCountLogo: React.FC<QualCountLogoProps> = ({
  size = 32,
  className = '',
  showText = true,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`shrink-0 select-none ${className}`}
      aria-label="QualCount Circular Tree & Loop Logo"
    >
      <defs>
        <radialGradient id="qc-comp-bg" cx="50%" cy="45%" r="55%" fx="48%" fy="42%">
          <stop offset="0%" stopColor="#1E2530" />
          <stop offset="55%" stopColor="#11161F" />
          <stop offset="100%" stopColor="#090C10" />
        </radialGradient>

        <linearGradient id="qc-comp-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="35%" stopColor="#F59E0B" />
          <stop offset="70%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>

        <linearGradient id="qc-comp-emerald" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#047857" />
          <stop offset="45%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>

        <linearGradient id="qc-comp-loop" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="35%" stopColor="#38BDF8" />
          <stop offset="70%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>

        {/* Graceful Lower Arc Path for "QUALICOUNT" typography beneath the tree */}
        <path id="qc-comp-text-arc" d="M 115,385 A 195,195 0 0,0 397,385" fill="none" />
      </defs>

      {/* 1. Circular Outer Medallion Base & Borders */}
      <circle cx="256" cy="256" r="250" fill="url(#qc-comp-bg)" />
      <circle cx="256" cy="256" r="243" fill="none" stroke="url(#qc-comp-gold)" strokeWidth="4.5" />
      <circle cx="256" cy="256" r="235" fill="none" stroke="#FAF8F4" strokeWidth="1.2" strokeOpacity="0.35" />
      <circle cx="256" cy="256" r="225" fill="none" stroke="#F59E0B" strokeWidth="1.2" strokeDasharray="3 6" strokeOpacity="0.45" />

      {/* 2. Encircling Loop (Tree Diagram Circled by Loop) */}
      <g id="qc-comp-loop-group">
        <ellipse
          cx="256"
          cy="192"
          rx="172"
          ry="126"
          transform="rotate(-14 256 192)"
          fill="none"
          stroke="#FAF8F4"
          strokeWidth="1"
          strokeDasharray="4 8"
          strokeOpacity="0.25"
        />
        <ellipse
          cx="256"
          cy="192"
          rx="168"
          ry="122"
          transform="rotate(-14 256 192)"
          fill="none"
          stroke="url(#qc-comp-loop)"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.95"
        />
        <polygon points="386,102 404,96 398,114" fill="#F59E0B" />
        <circle cx="106" cy="258" r="5" fill="#38BDF8" stroke="#FAF8F4" strokeWidth="1.5" />
      </g>

      {/* 3. Directed Tree Graph Diagram */}
      <g id="qc-comp-tree">
        {/* Roots & Anchors (y = 298 to 338) */}
        <path d="M 256,298 L 214,332" stroke="#B45309" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 256,298 L 256,338" stroke="#B45309" strokeWidth="3" strokeLinecap="round" />
        <path d="M 256,298 L 298,332" stroke="#B45309" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="214" cy="332" r="5.5" fill="#FAF8F4" stroke="#B45309" strokeWidth="2" />
        <circle cx="256" cy="338" r="6.5" fill="#FAF8F4" stroke="#B45309" strokeWidth="2.5" />
        <circle cx="298" cy="332" r="5.5" fill="#FAF8F4" stroke="#B45309" strokeWidth="2" />

        {/* Trunk */}
        <path d="M 253,298 L 253,202" stroke="#047857" strokeWidth="3.5" />
        <path d="M 259,298 L 259,202" stroke="#FAF8F4" strokeWidth="2" strokeOpacity="0.85" />

        {/* Lower Boughs */}
        <path d="M 256,298 Q 198,260 168,208" stroke="url(#qc-comp-emerald)" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M 256,298 Q 314,260 344,208" stroke="url(#qc-comp-emerald)" strokeWidth="3" fill="none" strokeLinecap="round" />

        {/* Multiplex Bridges */}
        <path d="M 168,208 Q 212,194 256,202" stroke="#F59E0B" strokeWidth="2" strokeDasharray="4 3" fill="none" />
        <path d="M 256,202 Q 300,194 344,208" stroke="#F59E0B" strokeWidth="2" strokeDasharray="4 3" fill="none" />
        <path d="M 168,208 Q 256,228 344,208" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 3" fill="none" strokeOpacity="0.75" />

        {/* Upper Canopy Branches */}
        <path d="M 168,208 L 122,148" stroke="url(#qc-comp-emerald)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 168,208 L 166,130" stroke="url(#qc-comp-emerald)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 168,208 L 208,122" stroke="url(#qc-comp-emerald)" strokeWidth="2.5" strokeLinecap="round" />

        <path d="M 256,202 L 224,110" stroke="url(#qc-comp-emerald)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 256,202 L 256,76" stroke="#FAF8F4" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M 256,202 L 288,110" stroke="url(#qc-comp-emerald)" strokeWidth="2.5" strokeLinecap="round" />

        <path d="M 344,208 L 304,122" stroke="url(#qc-comp-emerald)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 344,208 L 346,130" stroke="url(#qc-comp-emerald)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 344,208 L 390,148" stroke="url(#qc-comp-emerald)" strokeWidth="2.5" strokeLinecap="round" />

        {/* Canopy Silhouette Arcs */}
        <path
          d="M 122,148 Q 142,120 166,130 Q 190,102 208,122 Q 230,82 256,76 Q 282,82 304,122 Q 322,102 346,130 Q 370,120 390,148"
          stroke="#10B981"
          strokeWidth="2"
          strokeDasharray="5 3"
          fill="none"
          strokeOpacity="0.75"
        />

        {/* Canopy Cross Bridges */}
        <path d="M 166,130 L 224,110" stroke="#F59E0B" strokeWidth="1.8" strokeDasharray="3 3" />
        <path d="M 256,76 L 208,122" stroke="#34D399" strokeWidth="1.8" />
        <path d="M 256,76 L 304,122" stroke="#34D399" strokeWidth="1.8" />
        <path d="M 346,130 L 288,110" stroke="#F59E0B" strokeWidth="1.8" strokeDasharray="3 3" />

        {/* Nodes */}
        <circle cx="256" cy="298" r="14" fill="#FAF8F4" stroke="#047857" strokeWidth="3.5" />
        <circle cx="256" cy="298" r="5.5" fill="#0F6B38" />

        <circle cx="168" cy="208" r="11" fill="#FAF8F4" stroke="#10B981" strokeWidth="3" />
        <circle cx="168" cy="208" r="4" fill="#059669" />

        <circle cx="256" cy="202" r="12" fill="#FAF8F4" stroke="#38BDF8" strokeWidth="3" />
        <circle cx="256" cy="202" r="4.5" fill="#0284C7" />

        <circle cx="344" cy="208" r="11" fill="#FAF8F4" stroke="#10B981" strokeWidth="3" />
        <circle cx="344" cy="208" r="4" fill="#059669" />

        <circle cx="122" cy="148" r="8.5" fill="#FAF8F4" stroke="#10B981" strokeWidth="2.5" />
        <circle cx="122" cy="148" r="3" fill="#059669" />

        <circle cx="166" cy="130" r="9" fill="#FAF8F4" stroke="#F59E0B" strokeWidth="2.5" />
        <circle cx="166" cy="130" r="3" fill="#B45309" />

        <circle cx="208" cy="122" r="8" fill="#FAF8F4" stroke="#10B981" strokeWidth="2.5" />
        <circle cx="208" cy="122" r="2.5" fill="#059669" />

        <circle cx="224" cy="110" r="8" fill="#FAF8F4" stroke="#34D399" strokeWidth="2.5" />
        <circle cx="224" cy="110" r="2.5" fill="#10B981" />

        <circle cx="288" cy="110" r="8" fill="#FAF8F4" stroke="#34D399" strokeWidth="2.5" />
        <circle cx="288" cy="110" r="2.5" fill="#10B981" />

        <circle cx="304" cy="122" r="8" fill="#FAF8F4" stroke="#10B981" strokeWidth="2.5" />
        <circle cx="304" cy="122" r="2.5" fill="#059669" />

        <circle cx="346" cy="130" r="9" fill="#FAF8F4" stroke="#F59E0B" strokeWidth="2.5" />
        <circle cx="346" cy="130" r="3" fill="#B45309" />

        <circle cx="390" cy="148" r="8.5" fill="#FAF8F4" stroke="#10B981" strokeWidth="2.5" />
        <circle cx="390" cy="148" r="3" fill="#059669" />

        {/* Crown Apex Summit Node */}
        <circle cx="256" cy="76" r="17" fill="none" stroke="url(#qc-comp-gold)" strokeWidth="2" strokeDasharray="3 3" />
        <circle cx="256" cy="76" r="12" fill="#FAF8F4" stroke="#F59E0B" strokeWidth="3" />
        <circle cx="256" cy="76" r="4.5" fill="#B45309" />
      </g>

      {/* 4. Typography Beneath Tree */}
      {showText && (
        <g id="qc-comp-text">
          <text
            fontFamily="'Cinzel', Georgia, 'Times New Roman', serif"
            fontSize="28"
            fontWeight="700"
            letterSpacing="6"
            fill="#FAF8F4"
          >
            <textPath href="#qc-comp-text-arc" startOffset="50%" textAnchor="middle">
              QUALICOUNT
            </textPath>
          </text>
          <text
            x="256"
            y="472"
            textAnchor="middle"
            fontFamily="'Courier New', Consolas, monospace"
            fontSize="10.5"
            fontWeight="600"
            letterSpacing="3.5"
            fill="#D97706"
          >
            PARTNERSHIP LEDGER · v2.0
          </text>
          <circle cx="152" cy="469" r="2.2" fill="#F59E0B" />
          <circle cx="360" cy="469" r="2.2" fill="#F59E0B" />
        </g>
      )}
    </svg>
  );
};
