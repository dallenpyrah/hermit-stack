import type { ReactElement } from "react";

interface Socket {
  readonly label: string;
  readonly origin: string;
  readonly active: boolean;
}

const sockets: readonly Socket[] = [
  { active: false, label: "local", origin: "translate(40 70)" },
  { active: false, label: "gcp", origin: "translate(40 286)" },
  { active: true, label: "cloudflare", origin: "translate(616 70)" },
  { active: false, label: "aws", origin: "translate(616 286)" },
];

const faintTraces = [
  "M332 118V96L312 76H250",
  "M452 118V90L472 70H540",
  "M392 282V330L372 350V400",
  "M440 282V312L470 342H520",
  "M104 114V160L124 180H210",
  "M680 286V250L660 230H560",
  "M104 330V370",
  "M680 114V150",
];

const pads =
  "M250 76a3 3 0 1 0-6 0a3 3 0 1 0 6 0M546 70a3 3 0 1 0-6 0a3 3 0 1 0 6 0M526 342a3 3 0 1 0-6 0a3 3 0 1 0 6 0M216 180a3 3 0 1 0-6 0a3 3 0 1 0 6 0M560 230a3 3 0 1 0-6 0a3 3 0 1 0 6 0M107 373a3 3 0 1 0-6 0a3 3 0 1 0 6 0M683 153a3 3 0 1 0-6 0a3 3 0 1 0 6 0";

const busTraces = [
  "M322 164H306Q296 164 289 157L222 90Q215 83 205 83H168",
  "M322 170H303.5Q293.5 170 286.5 163L219.5 96Q212.5 89 202.5 89H168",
  "M322 176H301Q291 176 284 169L217 102Q210 95 200 95H168",
  "M322 182H298.5Q288.5 182 281.5 175L214.5 108Q207.5 101 197.5 101H168",
  "M322 212H298.5Q288.5 212 281.5 219L208.5 292Q201.5 299 191.5 299H168",
  "M322 218H301Q291 218 284 225L211 298Q204 305 194 305H168",
  "M322 224H303.5Q293.5 224 286.5 231L213.5 304Q206.5 311 196.5 311H168",
  "M322 230H306Q296 230 289 237L216 310Q209 317 199 317H168",
  "M462 164H478Q488 164 495 157L562 90Q569 83 579 83H616",
  "M462 176H483Q493 176 500 169L567 102Q574 95 584 95H616",
  "M462 182H485.5Q495.5 182 502.5 175L569.5 108Q576.5 101 586.5 101H616",
  "M462 212H485.5Q495.5 212 502.5 219L575.5 292Q582.5 299 592.5 299H616",
  "M462 218H483Q493 218 500 225L573 298Q580 305 590 305H616",
  "M462 224H480.5Q490.5 224 497.5 231L570.5 304Q577.5 311 587.5 311H616",
  "M462 230H478Q488 230 495 237L568 310Q575 317 585 317H616",
];

const activeTrace = "M462 170H480.5Q490.5 170 497.5 163L564.5 96Q571.5 89 581.5 89H616";

const pins =
  "M332 118V130M332 270V282M344 118V130M344 270V282M356 118V130M356 270V282M368 118V130M368 270V282M380 118V130M380 270V282M392 118V130M392 270V282M404 118V130M404 270V282M416 118V130M416 270V282M428 118V130M428 270V282M440 118V130M440 270V282M452 118V130M452 270V282M310 140H322M462 140H474M310 152H322M462 152H474M310 164H322M462 164H474M310 176H322M462 176H474M310 188H322M462 188H474M310 200H322M462 200H474M310 212H322M462 212H474M310 224H322M462 224H474M310 236H322M462 236H474M310 248H322M462 248H474M310 260H322M462 260H474";

const spiral = "M18.5 14.75a2.5 2.5 0 0 1-5 0a5 5 0 0 1 10 0a7.5 7.5 0 0 1-15 0";

const TargetSocket = (props: { readonly socket: Socket }): ReactElement => (
  <g className="hs-hero-socket" data-active={props.socket.active} transform={props.socket.origin}>
    <rect width="128" height="44" rx="10" />
    <circle cx="20" cy="22" r="3.5" />
    <text className="hs-hero-label" x="34" y="26">
      {props.socket.label}
    </text>
  </g>
);

export const HeroArt = (): ReactElement => (
  <div className="hs-hero-art" aria-hidden="true">
    <svg className="hs-hero-grain" viewBox="0 0 1152 600" preserveAspectRatio="xMinYMin slice">
      <filter id="hs-hero-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="1152" height="600" filter="url(#hs-hero-grain)" fill="#000000" />
    </svg>
    <svg className="hs-hero-chip" viewBox="0 0 784 400" preserveAspectRatio="xMidYMid slice">
      <g fill="none" strokeLinecap="round">
        {faintTraces.map((path): ReactElement => (
          <path key={path} d={path} stroke="#04201D2E" />
        ))}
        <path d={pads} stroke="#04201D38" />
        {busTraces.map((path): ReactElement => (
          <path key={path} d={path} stroke="#04201D9E" />
        ))}
        <path d={activeTrace} stroke="#FFFFFF" strokeWidth="2" />
        <path d={pins} stroke="#04201DB3" strokeWidth="2.2" strokeLinecap="butt" />
      </g>
      {sockets.map((socket): ReactElement => (
        <TargetSocket key={socket.label} socket={socket} />
      ))}
      <rect x="322" y="130" width="140" height="140" rx="12" fill="#0B0F0E" />
      <rect x="331.5" y="139.5" width="121" height="121" rx="6" fill="none" stroke="#FFFFFF14" />
      <circle cx="343" cy="151" r="3.5" fill="#FFFFFF24" />
      <path
        transform="translate(352 163) scale(2.5)"
        d={spiral}
        fill="none"
        stroke="#2DD4BF"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <text className="hs-hero-label" x="392" y="314" textAnchor="middle">
        APP_TARGET=cloudflare
      </text>
    </svg>
  </div>
);
