/* @ds-bundle: {"format":4,"namespace":"VysoDesignSystem_3031f9","components":[{"name":"AppIcon","sourcePath":"components/brand/AppIcon.jsx"},{"name":"ModuleTileIcon","sourcePath":"components/brand/ModuleTileIcon.jsx"},{"name":"VysoMark","sourcePath":"components/brand/VysoMark.jsx"},{"name":"Badge","sourcePath":"components/marketing/Badge.jsx"},{"name":"Button","sourcePath":"components/marketing/Button.jsx"},{"name":"GlassCard","sourcePath":"components/marketing/GlassCard.jsx"},{"name":"GradientText","sourcePath":"components/marketing/GradientText.jsx"},{"name":"Input","sourcePath":"components/marketing/Input.jsx"},{"name":"Label","sourcePath":"components/marketing/Label.jsx"},{"name":"LiquidButton","sourcePath":"components/marketing/LiquidButton.jsx"},{"name":"ProblemLine","sourcePath":"components/marketing/ProblemLine.jsx"},{"name":"Textarea","sourcePath":"components/marketing/Textarea.jsx"},{"name":"AreaChart","sourcePath":"components/platform/AreaChart.jsx"},{"name":"Sparkline","sourcePath":"components/platform/AreaChart.jsx"},{"name":"ConfidenceText","sourcePath":"components/platform/ConfidenceText.jsx"},{"name":"CountUp","sourcePath":"components/platform/CountUp.jsx"},{"name":"DataTable","sourcePath":"components/platform/DataTable.jsx"},{"name":"Kpi","sourcePath":"components/platform/Kpi.jsx"},{"name":"KpiStrip","sourcePath":"components/platform/KpiStrip.jsx"},{"name":"KpiTile","sourcePath":"components/platform/KpiTile.jsx"},{"name":"ModuleHeader","sourcePath":"components/platform/ModuleHeader.jsx"},{"name":"ModuleTile","sourcePath":"components/platform/ModuleTile.jsx"},{"name":"PrimaryAction","sourcePath":"components/platform/PrimaryAction.jsx"},{"name":"ProgressRing","sourcePath":"components/platform/ProgressRing.jsx"},{"name":"SecondaryAction","sourcePath":"components/platform/SecondaryAction.jsx"},{"name":"SectionCard","sourcePath":"components/platform/SectionCard.jsx"},{"name":"StatusPill","sourcePath":"components/platform/StatusPill.jsx"},{"name":"ToneBadge","sourcePath":"components/platform/ToneBadge.jsx"}],"sourceHashes":{"components/brand/AppIcon.jsx":"00adfc02e63a","components/brand/ModuleTileIcon.jsx":"b59ee6abab39","components/brand/VysoMark.jsx":"5abe1013e61b","components/marketing/Badge.jsx":"34222c9d5ebf","components/marketing/Button.jsx":"f535a5557970","components/marketing/GlassCard.jsx":"74744fd0f49f","components/marketing/GradientText.jsx":"b8266837f833","components/marketing/Input.jsx":"3b2f6afe89fa","components/marketing/Label.jsx":"dc6bf8236051","components/marketing/LiquidButton.jsx":"2c83d03679c6","components/marketing/ProblemLine.jsx":"e497d2140db4","components/marketing/Textarea.jsx":"7d17fea4578f","components/platform/AreaChart.jsx":"3a8857ca381d","components/platform/ConfidenceText.jsx":"bfd912ba9dbf","components/platform/CountUp.jsx":"73a0f726e253","components/platform/DataTable.jsx":"ca2db9deea83","components/platform/Kpi.jsx":"8a22e88e56e3","components/platform/KpiStrip.jsx":"b753d5dc61b3","components/platform/KpiTile.jsx":"ec71b497f777","components/platform/ModuleHeader.jsx":"40f6eccab3c2","components/platform/ModuleTile.jsx":"016ede601321","components/platform/PrimaryAction.jsx":"b11575e88d20","components/platform/ProgressRing.jsx":"30b562eb5fc8","components/platform/SecondaryAction.jsx":"24bdd4868680","components/platform/SectionCard.jsx":"1a72b16cdd82","components/platform/StatusPill.jsx":"4c081a2588d1","components/platform/ToneBadge.jsx":"fe9c36be4af4","ui_kits/platform/Chrome.jsx":"fc53e4631e65","ui_kits/platform/DocuScreen.jsx":"65174486dbe4","ui_kits/platform/Login.jsx":"2ca8eef00b75","ui_kits/platform/WasteWatchScreen.jsx":"800696a1b617","ui_kits/site/Sections.jsx":"2d5c3002e95a","ui_kits/site/SiteNav.jsx":"80ec6338077a"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.VysoDesignSystem_3031f9 = window.VysoDesignSystem_3031f9 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/AppIcon.jsx
try { (() => {
const TINTS = {
  docu: {
    bg: '#EAF2FC',
    fg: '#3E7BC4'
  },
  proc: {
    bg: '#E6F1FB',
    fg: '#2C5E8A'
  },
  margin: {
    bg: '#E1F5EE',
    fg: '#2E7D67'
  },
  waste: {
    bg: '#FBEFDD',
    fg: '#9A6314'
  },
  shift: {
    bg: '#ECEAFB',
    fg: '#5B53C0'
  },
  supplier: {
    bg: '#FBE9EE',
    fg: '#B0466A'
  },
  dash: {
    bg: '#EDEFF1',
    fg: '#6B6F68'
  }
};

/** Rounded tinted tile with a module glyph. The glyph PNG is transparent and
 *  gets tinted through CSS mask-image, exactly as in the platform. */
function AppIcon({
  name,
  size = 26,
  assetBase = '/assets/icons-gen'
}) {
  const tint = TINTS[name] || TINTS.dash;
  const glyph = Math.round(size * 0.56);
  const maskUrl = `url(${assetBase}/${name}.png)`;
  return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      width: size,
      height: size,
      borderRadius: Math.round(size * 0.3),
      backgroundColor: tint.bg
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: glyph,
      height: glyph,
      backgroundColor: tint.fg,
      WebkitMaskImage: maskUrl,
      maskImage: maskUrl,
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      maskPosition: 'center'
    }
  }));
}
Object.assign(__ds_scope, { AppIcon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/AppIcon.jsx", error: String((e && e.message) || e) }); }

// components/brand/ModuleTileIcon.jsx
try { (() => {
/** The marketing app-icon set, cropped out of the 1600×1000 sprite
 *  (public/app icons svg.svg → components/ui/AppIcons.tsx). Paths verbatim. */
const SPRITE = {
  procurepulse: {
    box: '90 100 310 310',
    body: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
      id: "vy-sp",
      x1: "90",
      y1: "100",
      x2: "400",
      y2: "410"
    }, /*#__PURE__*/React.createElement("stop", {
      stopColor: "#F0EBFF"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#F8F5FF"
    }))), /*#__PURE__*/React.createElement("rect", {
      x: "90",
      y: "100",
      width: "310",
      height: "310",
      rx: "44",
      fill: "url(#vy-sp)"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M173 229L263 178L350 221L262 274L173 229Z",
      fill: "#8D75F4"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M173 229V322L262 375V274L173 229Z",
      fill: "#4B2BD6"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M262 274L350 221V313L262 375V274Z",
      fill: "#6F55E8"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M214 206L305 252",
      stroke: "#FFF",
      strokeWidth: "14",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M262 274V375",
      stroke: "#FFF",
      strokeWidth: "10",
      opacity: ".9"
    }))
  },
  wastewatch: {
    box: '495 100 310 310',
    body: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
      id: "vy-wl",
      x1: "495",
      y1: "100",
      x2: "805",
      y2: "410"
    }, /*#__PURE__*/React.createElement("stop", {
      stopColor: "#E8FAF8"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#F3FFFC"
    }))), /*#__PURE__*/React.createElement("rect", {
      x: "495",
      y: "100",
      width: "310",
      height: "310",
      rx: "44",
      fill: "url(#vy-wl)"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M650 203C610 203 578 235 578 275C578 315 610 347 650 347C690 347 722 315 722 275",
      stroke: "#086B62",
      strokeWidth: "17",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M650 224V277H695",
      stroke: "#086B62",
      strokeWidth: "17",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M734 224L734 224",
      stroke: "#086B62",
      strokeWidth: "17",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M747 264L747 264",
      stroke: "#086B62",
      strokeWidth: "17",
      strokeLinecap: "round"
    }))
  },
  pricepilot: {
    box: '645 570 310 310',
    body: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
      id: "vy-mv",
      x1: "645",
      y1: "570",
      x2: "955",
      y2: "880"
    }, /*#__PURE__*/React.createElement("stop", {
      stopColor: "#E8FAEF"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#F5FFF8"
    }))), /*#__PURE__*/React.createElement("rect", {
      x: "645",
      y: "570",
      width: "310",
      height: "310",
      rx: "44",
      fill: "url(#vy-mv)"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "706",
      y: "642",
      width: "190",
      height: "190",
      rx: "28",
      fill: "#17A858"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M801 642V832M706 737H896",
      stroke: "#D9FBE3",
      strokeWidth: "6"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M735 690H775M755 670V710",
      stroke: "#D9FBE3",
      strokeWidth: "12",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M827 690H865",
      stroke: "#D9FBE3",
      strokeWidth: "12",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M738 778L772 812M772 778L738 812",
      stroke: "#D9FBE3",
      strokeWidth: "12",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M828 786H868M828 812H868",
      stroke: "#D9FBE3",
      strokeWidth: "12",
      strokeLinecap: "round"
    }))
  },
  supplysync: {
    box: '900 100 310 310',
    body: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
      id: "vy-sh",
      x1: "900",
      y1: "100",
      x2: "1210",
      y2: "410"
    }, /*#__PURE__*/React.createElement("stop", {
      stopColor: "#EAF5FF"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#F5FBFF"
    }))), /*#__PURE__*/React.createElement("rect", {
      x: "900",
      y: "100",
      width: "310",
      height: "310",
      rx: "44",
      fill: "url(#vy-sh)"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "1055",
      cy: "275",
      r: "43",
      fill: "#1167D8"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "990",
      cy: "325",
      r: "35",
      fill: "#1167D8"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "1120",
      cy: "325",
      r: "35",
      fill: "#1167D8"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "1055",
      cy: "188",
      r: "35",
      fill: "#1167D8"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M1055 232V275M1021 300L990 325M1089 300L1120 325",
      stroke: "#fff",
      strokeWidth: "12",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "1055",
      cy: "179",
      r: "13",
      fill: "#FFF"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "990",
      cy: "316",
      r: "11",
      fill: "#FFF"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "1120",
      cy: "316",
      r: "11",
      fill: "#FFF"
    }))
  },
  shiftboard: {
    box: '1305 100 310 310',
    body: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
      id: "vy-sb",
      x1: "1305",
      y1: "100",
      x2: "1615",
      y2: "410"
    }, /*#__PURE__*/React.createElement("stop", {
      stopColor: "#FFF1E2"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#FFF8EF"
    }))), /*#__PURE__*/React.createElement("rect", {
      x: "1305",
      y: "100",
      width: "310",
      height: "310",
      rx: "44",
      fill: "url(#vy-sb)"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "1381",
      y: "185",
      width: "160",
      height: "165",
      rx: "24",
      fill: "#FFF9F1",
      stroke: "#F46A00",
      strokeWidth: "10"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M1381 228H1541",
      stroke: "#F46A00",
      strokeWidth: "22"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M1414 176V215M1508 176V215",
      stroke: "#F46A00",
      strokeWidth: "15",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "1424",
      cy: "266",
      r: "9",
      fill: "#F89718"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "1462",
      cy: "266",
      r: "9",
      fill: "#F89718"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "1500",
      cy: "266",
      r: "9",
      fill: "#F89718"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "1424",
      cy: "304",
      r: "9",
      fill: "#F89718"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "1462",
      cy: "304",
      r: "9",
      fill: "#F89718"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "1546",
      cy: "338",
      r: "43",
      fill: "#F46A00"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M1525 337L1540 352L1570 319",
      stroke: "#FFF",
      strokeWidth: "10",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }))
  },
  orderflow: {
    box: '210 570 310 310',
    body: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
      id: "vy-of",
      x1: "210",
      y1: "570",
      x2: "520",
      y2: "880"
    }, /*#__PURE__*/React.createElement("stop", {
      stopColor: "#FFEAF0"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#FFF6F8"
    }))), /*#__PURE__*/React.createElement("rect", {
      x: "210",
      y: "570",
      width: "310",
      height: "310",
      rx: "44",
      fill: "url(#vy-of)"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M287 672H315L333 760H454L433 813H334L310 700H287V672Z",
      fill: "#CB1552"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "350",
      cy: "835",
      r: "15",
      fill: "#CB1552"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "425",
      cy: "835",
      r: "15",
      fill: "#CB1552"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "453",
      cy: "779",
      r: "39",
      fill: "#CB1552"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M434 778L449 793L476 761",
      stroke: "#FFF",
      strokeWidth: "10",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }))
  },
  insightgen: {
    box: '1080 570 310 310',
    body: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
      id: "vy-rg",
      x1: "1080",
      y1: "570",
      x2: "1390",
      y2: "880"
    }, /*#__PURE__*/React.createElement("stop", {
      stopColor: "#FFF7D8"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#FFFBEA"
    }))), /*#__PURE__*/React.createElement("rect", {
      x: "1080",
      y: "570",
      width: "310",
      height: "310",
      rx: "44",
      fill: "url(#vy-rg)"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "1144",
      y: "646",
      width: "190",
      height: "160",
      rx: "20",
      fill: "#FFFDF5"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M1205 694V648A49 49 0 1 0 1240 733L1205 694Z",
      fill: "#E6A800"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M1214 648V685H1252",
      stroke: "#FFFDF5",
      strokeWidth: "8"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "1190",
      y: "760",
      width: "26",
      height: "35",
      rx: "5",
      fill: "#E6A800"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "1235",
      y: "735",
      width: "26",
      height: "60",
      rx: "5",
      fill: "#E6A800"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "1280",
      y: "705",
      width: "26",
      height: "90",
      rx: "5",
      fill: "#E6A800"
    }))
  }
};
function ModuleTileIcon({
  name,
  size = 56
}) {
  const icon = SPRITE[name];
  if (!icon) return null;
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: icon.box,
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true
  }, icon.body);
}
Object.assign(__ds_scope, { ModuleTileIcon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/ModuleTileIcon.jsx", error: String((e && e.message) || e) }); }

// components/brand/VysoMark.jsx
try { (() => {
/** Vyso wordmark — V Y S + filled circle as the O. Exact geometry from
 *  components/platform/VysoMark.tsx (viewBox 175 455 900 350, ratio 900/350). */
function VysoMark({
  width = 96,
  color = '#171A17',
  title = 'Vyso',
  style
}) {
  const height = width * (350 / 900);
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "175 455 900 350",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    role: "img",
    "aria-label": title,
    style: {
      width,
      height,
      display: 'block',
      ...style
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M221 504L338 694L455 504H417L338 632L261.5 504H221Z",
    fill: color
  }), /*#__PURE__*/React.createElement("path", {
    d: "M467 504L536.5 618H538.5L556.5 588L502 504H467Z",
    fill: color
  }), /*#__PURE__*/React.createElement("path", {
    d: "M658.5 504H620.097L473 752L510 751L658.5 504Z",
    fill: color
  }), /*#__PURE__*/React.createElement("path", {
    d: "M853 519.5H715.922C688.275 519.5 673.529 535.533 673.529 557.674C673.529 581.827 690.118 597.93 717.765 597.93H777.667C805.314 597.93 820.98 615.039 820.98 638.186C820.98 661.334 803.471 676.5 778.588 676.5C699.863 676.5 579 676.5 579 676.5",
    stroke: color,
    strokeWidth: 33,
    strokeMiterlimit: 10,
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M892.5 503.5H853V535.5C865.982 519.464 878.253 512.228 892.5 503.5Z",
    fill: color
  }), /*#__PURE__*/React.createElement("path", {
    d: "M580 692.5L578.5 660.5L559 692.5H559.512H580Z",
    fill: color
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "938.5",
    cy: "599.5",
    r: "95.5",
    fill: color
  }));
}
Object.assign(__ds_scope, { VysoMark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/VysoMark.jsx", error: String((e && e.message) || e) }); }

// components/marketing/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  accent: {
    background: 'rgba(190,93,35,0.10)',
    color: '#BE5D23',
    border: '1px solid rgba(190,93,35,0.18)'
  },
  neutral: {
    background: '#F5F5F5',
    color: '#6B6B6B',
    border: '1px solid #E5E5E5'
  },
  solid: {
    background: '#BE5D23',
    color: '#FFFFFF',
    border: '1px solid transparent'
  },
  outline: {
    background: 'transparent',
    color: '#0D0D0D',
    border: '1px solid #E5E5E5'
  }
};

/** Small pill label — "Required first", "Founding client", tier chips. */
function Badge({
  tone = 'accent',
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '0.28rem 0.6rem',
      borderRadius: 9999,
      fontFamily: 'var(--font-body)',
      fontSize: '0.68rem',
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      ...TONES[tone],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/Badge.jsx", error: String((e && e.message) || e) }); }

// components/marketing/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const VARIANTS = {
  default: {
    background: '#BE5D23',
    color: '#fff',
    border: '1px solid transparent'
  },
  outline: {
    background: '#fff',
    color: '#0D0D0D',
    border: '1px solid #E5E5E5'
  },
  secondary: {
    background: '#F5F5F5',
    color: '#0D0D0D',
    border: '1px solid transparent'
  },
  ghost: {
    background: 'transparent',
    color: '#0D0D0D',
    border: '1px solid transparent'
  },
  destructive: {
    background: 'rgba(163,45,45,0.10)',
    color: '#A32D2D',
    border: '1px solid transparent'
  },
  link: {
    background: 'transparent',
    color: '#BE5D23',
    border: '1px solid transparent',
    textDecoration: 'underline',
    textUnderlineOffset: 4
  }
};
const HOVER = {
  default: {
    background: 'rgba(190,93,35,0.8)'
  },
  outline: {
    background: '#F5F5F5'
  },
  secondary: {
    background: '#EDEDED'
  },
  ghost: {
    background: '#F5F5F5'
  },
  destructive: {
    background: 'rgba(163,45,45,0.20)'
  },
  link: {}
};
const SIZES = {
  xs: {
    height: 24,
    padding: '0 8px',
    fontSize: 12,
    gap: 4,
    borderRadius: 'min(var(--radius-md,0px),10px)'
  },
  sm: {
    height: 28,
    padding: '0 10px',
    fontSize: '0.8rem',
    gap: 4,
    borderRadius: 'min(var(--radius-md,0px),12px)'
  },
  default: {
    height: 32,
    padding: '0 10px',
    fontSize: 14,
    gap: 6,
    borderRadius: 'var(--radius-sharp,0)'
  },
  lg: {
    height: 36,
    padding: '0 10px',
    fontSize: 14,
    gap: 6,
    borderRadius: 'var(--radius-sharp,0)'
  },
  icon: {
    height: 32,
    width: 32,
    padding: 0,
    fontSize: 14,
    gap: 0,
    borderRadius: 'var(--radius-sharp,0)'
  }
};

/** The marketing/site button. Sharp corners — the site sets --radius: 0. */
function Button({
  variant = 'default',
  size = 'default',
  disabled,
  children,
  style,
  onClick,
  type = 'button',
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const v = VARIANTS[variant] || VARIANTS.default;
  const s = SIZES[size] || SIZES.default;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      whiteSpace: 'nowrap',
      cursor: disabled ? 'default' : 'pointer',
      userSelect: 'none',
      fontFamily: 'var(--font-body)',
      fontWeight: 500,
      lineHeight: 1,
      transition: 'all 0.16s ease',
      outline: 'none',
      opacity: disabled ? 0.5 : 1,
      transform: press && !disabled ? 'translateY(1px)' : 'none',
      ...v,
      ...s,
      ...(hover && !disabled ? HOVER[variant] : null),
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/Button.jsx", error: String((e && e.message) || e) }); }

// components/marketing/GlassCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Frosted panel used for pricing tiers, audit banners and mega-menu cards. */
function GlassCard({
  active = false,
  radius = 22,
  padding = '1.8rem',
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: 'rgba(255,255,255,0.52)',
      backdropFilter: 'blur(22px) saturate(1.9)',
      WebkitBackdropFilter: 'blur(22px) saturate(1.9)',
      border: '1px solid rgba(255,255,255,0.68)',
      borderRadius: radius,
      boxShadow: active ? 'var(--glass-shadow-active)' : 'var(--glass-shadow)',
      padding,
      boxSizing: 'border-box',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { GlassCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/GlassCard.jsx", error: String((e && e.message) || e) }); }

// components/marketing/GradientText.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Orange gradient clipped to text: hsl(30 82% 57%) → hsl(22 69% 44%) → hsl(14 72% 36%). */
function GradientText({
  as: Tag = 'span',
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(Tag, _extends({
    style: {
      backgroundImage: 'linear-gradient(135deg,hsl(30 82% 57%),hsl(22 69% 44%),hsl(14 72% 36%))',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
      WebkitTextFillColor: 'transparent',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { GradientText });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/GradientText.jsx", error: String((e && e.message) || e) }); }

// components/marketing/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Form field. Sharp corners, 1px #E5E5E5 hairline, orange focus ring. */
function Input({
  invalid = false,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("input", _extends({
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: '100%',
      height: 44,
      padding: '0 0.9rem',
      boxSizing: 'border-box',
      fontFamily: 'var(--font-body)',
      fontSize: '0.9rem',
      color: '#0D0D0D',
      background: '#fff',
      borderRadius: 'var(--radius-sharp,0)',
      border: '1px solid ' + (invalid ? '#A32D2D' : focus ? '#BE5D23' : '#E5E5E5'),
      boxShadow: focus ? '0 0 0 3px rgba(190,93,35,0.16)' : 'none',
      outline: 'none',
      transition: 'border-color 0.16s ease, box-shadow 0.16s ease',
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/Input.jsx", error: String((e && e.message) || e) }); }

// components/marketing/Label.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Field label — body font, 500, small. */
function Label({
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", _extends({
    style: {
      display: 'block',
      marginBottom: 6,
      fontFamily: 'var(--font-body)',
      fontSize: '0.8rem',
      fontWeight: 500,
      color: '#0D0D0D',
      letterSpacing: '0.01em',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Label });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/Label.jsx", error: String((e && e.message) || e) }); }

// components/marketing/LiquidButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  sm: {
    height: 32,
    padding: '0 16px',
    fontSize: 12,
    gap: 6
  },
  md: {
    height: 36,
    padding: '0 20px',
    fontSize: 14,
    gap: 8
  },
  lg: {
    height: 44,
    padding: '0 28px',
    fontSize: 14,
    gap: 8
  },
  xl: {
    height: 52,
    padding: '0 36px',
    fontSize: 16,
    gap: 8
  },
  xxl: {
    height: 56,
    padding: '0 40px',
    fontSize: 16,
    gap: 8
  }
};
const COLORS = {
  default: '#BE5D23',
  dark: '#0D0D0D',
  white: '#FFFFFF',
  blue: '#3375AE'
};

/** Glass pill CTA. Backdrop-blurred fill with an inset gleam, so it reads
 *  against the animated shader background. Scales 1.03 on hover, 0.97 on press. */
function LiquidButton({
  variant = 'default',
  size = 'lg',
  children,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const s = SIZES[size] || SIZES.lg;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    style: {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: 0,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      background: 'transparent',
      borderRadius: 9999,
      fontFamily: 'var(--font-body)',
      fontWeight: 500,
      color: COLORS[variant] || COLORS.default,
      transition: 'transform 0.2s ease',
      transform: press ? 'scale(0.97)' : hover ? 'scale(1.03)' : 'none',
      ...s,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 9999,
      overflow: 'hidden',
      pointerEvents: 'none',
      backdropFilter: 'blur(20px) saturate(1.8)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
      background: 'rgba(255,255,255,0.12)',
      boxShadow: 'var(--glass-shadow-button)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5em'
    }
  }, children));
}
Object.assign(__ds_scope, { LiquidButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/LiquidButton.jsx", error: String((e && e.message) || e) }); }

// components/marketing/ProblemLine.jsx
try { (() => {
/** The problem strip motif: the old way struck through, the Vyso answer after.
 *  The rule draws itself left→right (0.55s), then the fix fades up. */
function ProblemLine({
  problem,
  fix,
  visible = true,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      gap: '0.9rem',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-block',
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(1.4rem,3vw,2.2rem)',
      fontWeight: 500,
      color: '#0D0D0D'
    }
  }, problem, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    style: {
      position: 'absolute',
      left: 0,
      top: '52%',
      width: '100%',
      height: 2.5,
      background: '#0D0D0D',
      borderRadius: 2,
      transform: visible ? 'scaleX(1)' : 'scaleX(0)',
      transformOrigin: 'left center',
      transition: 'transform 0.55s cubic-bezier(0.4,0,0.2,1) 0.15s'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'clamp(0.95rem,1.5vw,1.15rem)',
      fontWeight: 500,
      color: '#BE5D23',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(6px)',
      transition: 'opacity 0.45s ease 0.78s, transform 0.45s ease 0.78s'
    }
  }, fix));
}
Object.assign(__ds_scope, { ProblemLine });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/ProblemLine.jsx", error: String((e && e.message) || e) }); }

// components/marketing/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Multi-line field — "Brief description of current ops problems". */
function Textarea({
  invalid = false,
  rows = 5,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("textarea", _extends({
    rows: rows,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: '100%',
      padding: '0.75rem 0.9rem',
      boxSizing: 'border-box',
      resize: 'vertical',
      fontFamily: 'var(--font-body)',
      fontSize: '0.9rem',
      lineHeight: 1.55,
      color: '#0D0D0D',
      background: '#fff',
      borderRadius: 'var(--radius-sharp,0)',
      border: '1px solid ' + (invalid ? '#A32D2D' : focus ? '#BE5D23' : '#E5E5E5'),
      boxShadow: focus ? '0 0 0 3px rgba(190,93,35,0.16)' : 'none',
      outline: 'none',
      transition: 'border-color 0.16s ease, box-shadow 0.16s ease',
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/platform/AreaChart.jsx
try { (() => {
function chartPaths(data, w, h, pad = 6) {
  if (!data || data.length === 0) return {
    line: '',
    area: ''
  };
  const min = Math.min(...data),
    max = Math.max(...data);
  const span = max - min || 1;
  const stepX = data.length > 1 ? w / (data.length - 1) : 0;
  const pts = data.map((v, i) => [i * stepX, pad + (1 - (v - min) / span) * (h - pad * 2)]);
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `M ${pts[0][0]},${pts[0][1]} ` + pts.slice(1).map(([x, y]) => `L ${x},${y}`).join(' ') + ` L ${w},${h} L 0,${h} Z`;
  return {
    line,
    area
  };
}

/** Filled trend line. Stretches to its container; no axes, no gridlines. */
function AreaChart({
  data,
  color = '#3E7BC4',
  fill = '#EAF2FC',
  height = 120
}) {
  const W = 600;
  const {
    line,
    area
  } = chartPaths(data, W, height);
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${height}`,
    preserveAspectRatio: "none",
    style: {
      width: '100%',
      height
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: fill
  }), /*#__PURE__*/React.createElement("polyline", {
    points: line,
    fill: "none",
    stroke: color,
    strokeWidth: 3
  }));
}

/** Tiny inline trend line for table cells. */
function Sparkline({
  data,
  color = '#A32D2D',
  width = 100,
  height = 40
}) {
  const {
    line
  } = chartPaths(data, width, height, 4);
  return /*#__PURE__*/React.createElement("svg", {
    width: width,
    height: height,
    viewBox: `0 0 ${width} ${height}`
  }, /*#__PURE__*/React.createElement("polyline", {
    points: line,
    fill: "none",
    stroke: color,
    strokeWidth: 2.5
  }));
}
Object.assign(__ds_scope, { AreaChart, Sparkline });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/platform/AreaChart.jsx", error: String((e && e.message) || e) }); }

// components/platform/ConfidenceText.jsx
try { (() => {
/** Extraction confidence — green ≥80, amber ≥70, red below. */
function ConfidenceText({
  value
}) {
  if (value == null) return /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#8A8E86'
    }
  }, "\u2014");
  const color = value >= 80 ? '#0F6E56' : value >= 70 ? '#854F0B' : '#A32D2D';
  return /*#__PURE__*/React.createElement("span", {
    className: "of-num",
    style: {
      fontWeight: 600,
      color
    }
  }, Math.round(value), "%");
}
Object.assign(__ds_scope, { ConfidenceText });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/platform/ConfidenceText.jsx", error: String((e && e.message) || e) }); }

// components/platform/CountUp.jsx
try { (() => {
/** Number that eases to its value (cubic ease-out, 700ms) and chases later changes. */
function CountUp({
  value,
  format = n => String(Math.round(n)),
  duration = 700,
  className,
  style
}) {
  const [n, setN] = React.useState(0);
  const from = React.useRef(0),
    cur = React.useRef(0);
  React.useEffect(() => {
    const start = performance.now();
    const f = from.current;
    let raf = 0;
    const tick = t => {
      const p = Math.min(1, (t - start) / duration);
      const v = f + (value - f) * (1 - Math.pow(1 - p, 3));
      cur.current = v;
      setN(v);
      if (p < 1) raf = requestAnimationFrame(tick);else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = cur.current;
    };
  }, [value, duration]);
  return /*#__PURE__*/React.createElement("span", {
    className: className,
    style: style
  }, format(n));
}
Object.assign(__ds_scope, { CountUp });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/platform/CountUp.jsx", error: String((e && e.message) || e) }); }

// components/platform/DataTable.jsx
try { (() => {
/** Lightweight table shell — uppercase header row, hairline rows, tint on hover. */
function DataTable({
  columns = [],
  rows = [],
  empty = 'Nothing here yet',
  style
}) {
  const [hover, setHover] = React.useState(-1);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: 'hidden',
      borderRadius: 16,
      border: '1px solid #EAEDF2',
      background: '#fff',
      boxShadow: '0 1px 2px rgba(20,24,20,0.03)',
      fontFamily: 'var(--font-ui)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      borderBottom: '1px solid #EEF1F5',
      background: '#FBFCFE'
    }
  }, columns.map((c, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      padding: '10px 12px',
      fontSize: 11,
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: '#A0A49C',
      textAlign: c.align === 'right' ? 'right' : 'left'
    }
  }, c.label)))), /*#__PURE__*/React.createElement("tbody", null, rows.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: columns.length,
    style: {
      padding: '48px 20px',
      textAlign: 'center',
      fontSize: 14,
      color: '#8A8E86'
    }
  }, empty)) : rows.map((r, ri) => /*#__PURE__*/React.createElement("tr", {
    key: ri,
    onMouseEnter: () => setHover(ri),
    onMouseLeave: () => setHover(-1),
    style: {
      borderBottom: ri === rows.length - 1 ? 'none' : '1px solid #F5F9FE',
      background: hover === ri ? '#F5F9FE' : 'transparent'
    }
  }, r.map((cell, ci) => /*#__PURE__*/React.createElement("td", {
    key: ci,
    className: columns[ci] && columns[ci].align === 'right' ? 'of-num' : undefined,
    style: {
      padding: '12px',
      textAlign: columns[ci] && columns[ci].align === 'right' ? 'right' : 'left',
      fontWeight: ci === 0 ? 600 : 400,
      color: ci === 0 ? '#171A17' : '#2C333B'
    }
  }, cell)))))));
}
Object.assign(__ds_scope, { DataTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/platform/DataTable.jsx", error: String((e && e.message) || e) }); }

// components/platform/Kpi.jsx
try { (() => {
/** One KPI cell inside a KpiStrip. */
function Kpi({
  label,
  value,
  accent,
  sub,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 16,
      border: '1px solid #EAEDF2',
      background: '#fff',
      padding: '16px 20px',
      boxShadow: '0 1px 2px rgba(20,24,20,0.03)',
      fontFamily: 'var(--font-ui)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: '#8A8E86'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "of-num",
    style: {
      marginTop: 8,
      fontSize: 22,
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: '-0.02em',
      color: accent || '#171A17'
    }
  }, value), sub != null ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 12,
      color: '#A0A49C'
    }
  }, sub) : null);
}
Object.assign(__ds_scope, { Kpi });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/platform/Kpi.jsx", error: String((e && e.message) || e) }); }

// components/platform/KpiStrip.jsx
try { (() => {
/** Responsive row of Kpi cells — 2 up on mobile, 3 on tablet, 5 on desktop. */
function KpiStrip({
  columns = 5,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 16,
      gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { KpiStrip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/platform/KpiStrip.jsx", error: String((e && e.message) || e) }); }

// components/platform/KpiTile.jsx
try { (() => {
/** Clickable KPI tile — same metric card, but it navigates. */
function KpiTile({
  label,
  value,
  sublabel,
  accent,
  href = '#',
  onClick,
  style
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("a", {
    href: href,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'block',
      textDecoration: 'none',
      borderRadius: 16,
      border: '1px solid ' + (hover ? '#C9DEF7' : '#EAEDF2'),
      background: hover ? '#FBFCFE' : '#fff',
      padding: '22px 24px',
      boxShadow: '0 1px 2px rgba(20,24,20,0.03)',
      transition: 'background 0.16s ease, border-color 0.16s ease',
      fontFamily: 'var(--font-ui)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: '#8A8E86'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: '#8A8E86'
    }
  }, "\u203A")), /*#__PURE__*/React.createElement("div", {
    className: "of-num",
    style: {
      marginTop: 8,
      fontSize: 30,
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: '-0.02em',
      color: accent || '#171A17'
    }
  }, value), sublabel ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 13,
      color: '#6B6F68'
    }
  }, sublabel) : null);
}
Object.assign(__ds_scope, { KpiTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/platform/KpiTile.jsx", error: String((e && e.message) || e) }); }

// components/platform/ModuleHeader.jsx
try { (() => {
/** Module title block — glyph, 28px title, description, action slot. */
function ModuleHeader({
  icon = 'dash',
  title,
  description,
  actions,
  assetBase,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      fontFamily: 'var(--font-ui)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      minWidth: 0,
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AppIcon, {
    name: icon,
    size: 40,
    assetBase: assetBase
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h1", {
    className: "of-display",
    style: {
      margin: 0,
      fontSize: 28,
      fontWeight: 600,
      lineHeight: 1.15,
      letterSpacing: '-0.015em',
      color: '#171A17'
    }
  }, title), description ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '6px 0 0',
      fontSize: 14,
      color: '#8A8E86'
    }
  }, description) : null)), actions ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexShrink: 0,
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8
    }
  }, actions) : null);
}
Object.assign(__ds_scope, { ModuleHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/platform/ModuleHeader.jsx", error: String((e && e.message) || e) }); }

// components/platform/ModuleTile.jsx
try { (() => {
/** Row/tile for the modules switcher. Three states: active, soon, locked. */
function ModuleTile({
  icon = 'dash',
  label,
  description,
  state = 'default',
  onClick,
  assetBase,
  style
}) {
  const [hover, setHover] = React.useState(false);
  const locked = state === 'locked',
    soon = state === 'soon',
    active = state === 'active';
  const muted = locked || soon;
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      width: '100%',
      alignItems: 'center',
      gap: 12,
      borderRadius: 14,
      padding: 15,
      textAlign: 'left',
      cursor: soon ? 'default' : 'pointer',
      fontFamily: 'var(--font-ui)',
      border: '1px solid ' + (active ? '#C9DEF7' : hover && !soon ? '#C9DEF7' : '#EAEDF2'),
      background: active ? '#EAF2FC' : hover && !soon ? '#F5F9FE' : '#fff',
      transition: 'background 0.16s ease, border-color 0.16s ease',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AppIcon, {
    name: icon,
    size: 34,
    assetBase: assetBase
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 14,
      fontWeight: 600,
      color: muted ? '#9A9DA1' : '#1A1C1E'
    }
  }, label), description ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginTop: 2,
      fontSize: 12,
      color: '#8A8E86'
    }
  }, description) : null), soon ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: '#9A9DA1'
    }
  }, "soon") : null, locked ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 11,
      color: '#9A9DA1'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "11",
    width: "18",
    height: "11",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 11V7a5 5 0 0 1 10 0v4"
  })), "Unlock") : null);
}
Object.assign(__ds_scope, { ModuleTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/platform/ModuleTile.jsx", error: String((e && e.message) || e) }); }

// components/platform/PrimaryAction.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Blue filled 42px action button — one per screen. */
function PrimaryAction({
  children,
  onClick,
  disabled,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: onClick,
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      height: 42,
      borderRadius: 11,
      border: 0,
      padding: '0 18px',
      background: hover && !disabled ? '#174C87' : '#1F5FA8',
      color: '#fff',
      fontFamily: 'var(--font-ui)',
      fontSize: 14,
      fontWeight: 600,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'background 0.16s ease',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { PrimaryAction });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/platform/PrimaryAction.jsx", error: String((e && e.message) || e) }); }

// components/platform/ProgressRing.jsx
try { (() => {
/** Circular progress that animates in on mount. */
function ProgressRing({
  pct = 0,
  color = '#3E7BC4',
  size = 84,
  thickness = 8,
  children
}) {
  const [shown, setShown] = React.useState(0);
  React.useEffect(() => {
    const t = setTimeout(() => setShown(pct), 60);
    return () => clearTimeout(t);
  }, [pct]);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, shown / 100)) * c;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flexShrink: 0,
      width: size,
      height: size
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`
  }, /*#__PURE__*/React.createElement("g", {
    transform: `rotate(-90 ${size / 2} ${size / 2})`
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: "#EEF1F5",
    strokeWidth: thickness
  }), /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: color,
    strokeWidth: thickness,
    strokeLinecap: "round",
    strokeDasharray: `${dash} ${c - dash}`,
    style: {
      transition: 'stroke-dasharray 0.7s cubic-bezier(0.22,1,0.36,1)'
    }
  }))), children ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, children) : null);
}
Object.assign(__ds_scope, { ProgressRing });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/platform/ProgressRing.jsx", error: String((e && e.message) || e) }); }

// components/platform/SecondaryAction.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Outlined 42px action — sits beside PrimaryAction. */
function SecondaryAction({
  children,
  onClick,
  disabled,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: onClick,
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      height: 42,
      borderRadius: 11,
      padding: '0 18px',
      background: hover ? '#EAF2FC' : '#fff',
      border: '1px solid ' + (hover ? '#C9DEF7' : '#E2E6EC'),
      color: hover ? '#174C87' : '#3E4A57',
      fontFamily: 'var(--font-ui)',
      fontSize: 14,
      fontWeight: 500,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'all 0.16s ease',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { SecondaryAction });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/platform/SecondaryAction.jsx", error: String((e && e.message) || e) }); }

// components/platform/SectionCard.jsx
try { (() => {
/** Titled white panel — the platform's main content container. */
function SectionCard({
  title,
  right,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 16,
      border: '1px solid #EAEDF2',
      background: '#fff',
      boxShadow: '0 1px 2px rgba(20,24,20,0.03)',
      fontFamily: 'var(--font-ui)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderBottom: '1px solid #EEF1F5',
      padding: '16px 20px'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    className: "of-display",
    style: {
      margin: 0,
      fontSize: 16,
      fontWeight: 600,
      color: '#171A17'
    }
  }, title), right ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexShrink: 0,
      alignItems: 'center',
      gap: 8
    }
  }, right) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, children));
}
Object.assign(__ds_scope, { SectionCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/platform/SectionCard.jsx", error: String((e && e.message) || e) }); }

// components/platform/StatusPill.jsx
try { (() => {
const STATUS = {
  pending: {
    bg: '#FBEEDA',
    fg: '#854F0B',
    label: 'Pending'
  },
  extracted: {
    bg: '#E6F1FB',
    fg: '#0C447C',
    label: 'Extracted'
  },
  reviewed: {
    bg: '#E1F5EE',
    fg: '#0F6E56',
    label: 'Reviewed'
  },
  error: {
    bg: '#FCEBEB',
    fg: '#A32D2D',
    label: 'Error'
  },
  approved: {
    bg: '#E1F5EE',
    fg: '#0F6E56',
    label: 'Approved'
  },
  rejected: {
    bg: '#FCEBEB',
    fg: '#A32D2D',
    label: 'Rejected'
  },
  archived: {
    bg: '#EEF1F5',
    fg: '#6B6F68',
    label: 'Archived'
  }
};

/** Document lifecycle pill — dot + label, keyed off documents.status. */
function StatusPill({
  status
}) {
  const c = STATUS[status] || STATUS.archived;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      borderRadius: 9999,
      padding: '4px 10px',
      fontSize: 12,
      fontWeight: 500,
      fontFamily: 'var(--font-ui)',
      backgroundColor: c.bg,
      color: c.fg
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      height: 6,
      width: 6,
      borderRadius: 9999,
      backgroundColor: c.fg
    }
  }), c.label);
}
Object.assign(__ds_scope, { StatusPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/platform/StatusPill.jsx", error: String((e && e.message) || e) }); }

// components/platform/ToneBadge.jsx
try { (() => {
const TONE = {
  neutral: {
    bg: '#EEF1F5',
    fg: '#6B6F68'
  },
  positive: {
    bg: '#E1F5EE',
    fg: '#0F6E56'
  },
  warning: {
    bg: '#FBEEDA',
    fg: '#854F0B'
  },
  critical: {
    bg: '#FCEBEB',
    fg: '#A32D2D'
  },
  info: {
    bg: '#E6F1FB',
    fg: '#0C447C'
  }
};

/** Generic in-app status badge (module-ui Badge). */
function ToneBadge({
  label,
  tone = 'neutral',
  children,
  style
}) {
  const s = TONE[tone] || TONE.neutral;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      borderRadius: 9999,
      padding: '4px 10px',
      fontSize: 11,
      fontWeight: 500,
      fontFamily: 'var(--font-ui)',
      backgroundColor: s.bg,
      color: s.fg,
      ...style
    }
  }, label ?? children);
}
Object.assign(__ds_scope, { ToneBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/platform/ToneBadge.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/Chrome.jsx
try { (() => {
const {
  VysoMark,
  ModuleTile
} = window.VysoDesignSystem_3031f9;
const ICON_BTN = {
  display: 'flex',
  height: 40,
  width: 40,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 11,
  border: '1px solid #E4E9F0',
  background: '#fff',
  color: '#3E4A57',
  cursor: 'pointer'
};
const MODULES = [{
  key: 'docu',
  label: 'Doc-U',
  description: 'Document management',
  icon: 'docu'
}, {
  key: 'procurepulse',
  label: 'ProcurePulse',
  description: 'Stock intelligence',
  icon: 'proc'
}, {
  key: 'pricepilot',
  label: 'PricePilot',
  description: 'Pricing recommendations',
  icon: 'margin'
}, {
  key: 'planwise',
  label: 'PlanWise',
  description: 'Budgeting & forecasting',
  icon: 'dash'
}, {
  key: 'wastewatch',
  label: 'WasteWatch',
  description: 'Wastage & shrinkage',
  icon: 'waste'
}, {
  key: 'shiftboard',
  label: 'ShiftBoard',
  description: 'Labour & scheduling',
  icon: 'shift'
}, {
  key: 'supplysync',
  label: 'SupplySync',
  description: 'Supplier management',
  icon: 'supplier'
}, {
  key: 'insightgen',
  label: 'InsightGen',
  description: 'Reporting & analytics',
  icon: 'dash'
}, {
  key: 'orderflow',
  label: 'OrderFlow',
  description: 'Order management',
  icon: 'dash'
}];
function TopBar({
  moduleLabel,
  onOpenModules,
  onSignOut
}) {
  const [menu, setMenu] = React.useState(false);
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'relative',
      zIndex: 30,
      display: 'flex',
      height: 66,
      flexShrink: 0,
      alignItems: 'center',
      gap: 16,
      borderBottom: '1px solid #E9EEF4',
      background: 'rgba(255,255,255,0.9)',
      backdropFilter: 'blur(10px)',
      padding: '0 24px',
      fontFamily: 'var(--font-ui)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Open modules",
    onClick: onOpenModules,
    style: ICON_BTN
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 18 18",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 4.5h14M2 9h14M2 13.5h14",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }))), /*#__PURE__*/React.createElement(VysoMark, {
    width: 92,
    color: "#D9730D"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      borderLeft: '1px solid #E4E9F0',
      paddingLeft: 16,
      fontSize: 13,
      color: '#8A8E86'
    }
  }, moduleLabel || 'Operations platform'), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      borderRadius: 9999,
      background: '#EAF2FC',
      padding: '4px 12px',
      fontSize: 12,
      fontWeight: 500,
      color: '#174C87',
      textDecoration: 'none'
    }
  }, "Trial \xB7 9 days left"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Feedback",
    style: ICON_BTN
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 11a8 8 0 0 1 16 0v0a8 8 0 0 1-8 8H7l-4 3v-3.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 11h.01M12 11h.01M16 11h.01"
  }))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Notifications",
    style: ICON_BTN
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M13.73 21a2 2 0 0 1-3.46 0"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setMenu(m => !m),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      borderRadius: 11,
      border: '1px solid #E4E9F0',
      background: '#fff',
      padding: '6px 12px 6px 6px',
      textAlign: 'left',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      height: 28,
      width: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      background: '#EAF2FC',
      color: '#1F5FA8',
      fontSize: 12,
      fontWeight: 600
    }
  }, "TS"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 13,
      fontWeight: 500,
      color: '#171A17'
    }
  }, "Turn 'n Slice"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 11,
      color: '#8A8E86'
    }
  }, "joshua@turnnslice.co.za")), /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#8A8E86",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "m6 9 6 6 6-6"
  }))), menu ? /*#__PURE__*/React.createElement("div", {
    className: "vyso-pop-in",
    role: "menu",
    style: {
      position: 'absolute',
      right: 0,
      top: '100%',
      zIndex: 40,
      marginTop: 8,
      width: 236,
      overflow: 'hidden',
      borderRadius: 12,
      border: '1px solid #E4E9F0',
      background: '#fff',
      padding: '4px 0',
      boxShadow: 'var(--pf-shadow-menu)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: '1px solid #EEF1F5',
      padding: '10px 14px 8px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: '#171A17'
    }
  }, "Turn 'n Slice"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: '#8A8E86'
    }
  }, "Cape Town \xB7 Founding client")), ['My Organisation', 'Settings'].map(l => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      padding: '8px 14px',
      fontSize: 13,
      color: '#171A17',
      cursor: 'pointer'
    }
  }, l)), /*#__PURE__*/React.createElement("div", {
    onClick: onSignOut,
    style: {
      padding: '8px 14px',
      fontSize: 13,
      color: '#A32D2D',
      cursor: 'pointer'
    }
  }, "Sign out")) : null)));
}
function ModulesOverlay({
  open,
  current,
  onClose,
  onPick
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    className: "vyso-fade-in",
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 85,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      overflowY: 'auto',
      background: 'rgba(23,30,40,0.32)',
      backdropFilter: 'blur(3px)',
      padding: '88px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    className: "vyso-pop-in",
    style: {
      width: 920,
      maxWidth: '92%',
      borderRadius: 20,
      border: '1px solid #E9EEF4',
      background: '#fff',
      padding: '28px 30px',
      boxShadow: 'var(--pf-shadow-overlay)',
      fontFamily: 'var(--font-ui)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "of-display",
    style: {
      margin: 0,
      fontSize: 20,
      fontWeight: 600,
      color: '#171A17'
    }
  }, "Vyso modules"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '4px 0 0',
      fontSize: 13,
      color: '#8A8E86'
    }
  }, "Jump to any tool in your operations platform")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    "aria-label": "Close modules",
    style: {
      display: 'flex',
      height: 36,
      width: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      border: '1px solid #E4E9F0',
      background: '#fff',
      fontSize: 16,
      color: '#6B6F68',
      cursor: 'pointer'
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 12
    }
  }, MODULES.map(m => /*#__PURE__*/React.createElement(ModuleTile, {
    key: m.key,
    icon: m.icon,
    label: m.label,
    description: m.description,
    state: m.key === current ? 'active' : m.key === 'planwise' ? 'soon' : m.key === 'insightgen' ? 'locked' : 'default',
    assetBase: "../../assets/icons-gen",
    onClick: () => {
      if (m.key !== 'planwise' && m.key !== 'insightgen') onPick(m.key);
    }
  })))));
}
Object.assign(window, {
  TopBar,
  ModulesOverlay,
  MODULES
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/Chrome.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/DocuScreen.jsx
try { (() => {
const NS = window.VysoDesignSystem_3031f9;
const {
  ModuleHeader,
  PrimaryAction,
  SecondaryAction,
  KpiTile,
  SectionCard,
  DataTable,
  StatusPill,
  ConfidenceText,
  AreaChart
} = NS;
const B = '../../assets/icons-gen';
const DOCS = [['INV-40218.pdf', 'Cape Fresh Produce', 'extracted', 94, 'R18 240.00'], ['DEL-7742.pdf', 'Milkwood Dairy', 'pending', 72, 'R2 118.75'], ['INV-40197.pdf', 'Boland Bakery', 'reviewed', 98, 'R6 940.00'], ['CN-0091.pdf', 'Cape Fresh Produce', 'error', 41, '—'], ['INV-40155.pdf', 'Karoo Meat Co', 'approved', 96, 'R21 470.50']];
function DocuScreen({
  onUpload
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      padding: '28px 32px',
      fontFamily: 'var(--font-ui)'
    }
  }, /*#__PURE__*/React.createElement(ModuleHeader, {
    icon: "docu",
    title: "Doc-U",
    description: "Documents in. Clean data out.",
    assetBase: B,
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SecondaryAction, null, "New folder"), /*#__PURE__*/React.createElement(PrimaryAction, {
      onClick: onUpload
    }, "Upload documents"))
  }), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      borderRadius: 16,
      border: '1px solid #EAEDF2',
      background: '#fff',
      padding: 20,
      textDecoration: 'none',
      boxShadow: '0 1px 2px rgba(20,24,20,0.03)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      height: 44,
      width: 44,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      background: 'rgba(62,123,196,0.1)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#3E7BC4",
    strokeWidth: "1.8"
  }, /*#__PURE__*/React.createElement("ellipse", {
    cx: "12",
    cy: "5",
    rx: "8",
    ry: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "of-display",
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: '#171A17'
    }
  }, "Databases"), /*#__PURE__*/React.createElement("span", {
    style: {
      borderRadius: 9999,
      background: '#EEF1F5',
      padding: '2px 8px',
      fontSize: 10,
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: '#6B6F68'
    }
  }, "Core Data")), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginTop: 4,
      fontSize: 13,
      color: '#6B6F68'
    }
  }, "Customers, products, price lists, company profile and more \u2014 the shared source of truth behind every document.")), /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      fontSize: 18,
      color: '#BFC5CC'
    }
  }, "\u203A")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(KpiTile, {
    label: "Awaiting review",
    value: "14",
    sublabel: "oldest 3 days ago",
    href: "#"
  }), /*#__PURE__*/React.createElement(KpiTile, {
    label: "Low confidence",
    value: "3",
    accent: "#854F0B",
    sublabel: "below 80%",
    href: "#"
  }), /*#__PURE__*/React.createElement(KpiTile, {
    label: "Extracted today",
    value: "27",
    accent: "#0F6E56",
    sublabel: "all suppliers",
    href: "#"
  }), /*#__PURE__*/React.createElement(KpiTile, {
    label: "Errors",
    value: "1",
    accent: "#A32D2D",
    sublabel: "needs re-upload",
    href: "#"
  })), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Recent documents",
    right: /*#__PURE__*/React.createElement(SecondaryAction, {
      style: {
        height: 34,
        fontSize: 13
      }
    }, "View all")
  }, /*#__PURE__*/React.createElement(DataTable, {
    columns: [{
      label: 'Document'
    }, {
      label: 'Supplier'
    }, {
      label: 'Status'
    }, {
      label: 'Confidence',
      align: 'right'
    }, {
      label: 'Total',
      align: 'right'
    }],
    rows: DOCS.map(([f, s, st, c, t]) => [f, s, /*#__PURE__*/React.createElement(StatusPill, {
      status: st
    }), /*#__PURE__*/React.createElement(ConfidenceText, {
      value: c
    }), t]),
    empty: "No documents yet",
    style: {
      border: 0,
      borderRadius: 0,
      boxShadow: 'none'
    }
  })), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Documents processed"
  }, /*#__PURE__*/React.createElement(AreaChart, {
    data: [6, 11, 9, 14, 12, 19, 17, 24, 21, 27],
    height: 120
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '10px 0 0',
      fontSize: 12,
      color: '#A0A49C'
    }
  }, "Documents extracted per day, last ten working days.")));
}
Object.assign(window, {
  DocuScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/DocuScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/Login.jsx
try { (() => {
const {
  VysoMark
} = window.VysoDesignSystem_3031f9;
const FIELD = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 10,
  border: '1px solid #ece7e0',
  background: '#faf9f7',
  padding: '13px 14px',
  fontSize: 15,
  color: '#141310',
  outline: 'none',
  transition: 'all .15s',
  fontFamily: 'var(--font-inter)'
};
const LABEL = {
  display: 'block',
  marginBottom: 7,
  fontSize: 12.5,
  fontWeight: 500,
  color: '#57524c'
};
function Login({
  onSignIn
}) {
  const [email, setEmail] = React.useState('joshua@turnnslice.co.za');
  const [password, setPassword] = React.useState('••••••••••');
  const [loading, setLoading] = React.useState(false);
  function submit(e) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSignIn();
    }, 550);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-inter)',
      display: 'flex',
      minHeight: '100%',
      background: '#f4f1ec',
      color: '#141310'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '56px 6vw'
    }
  }, /*#__PURE__*/React.createElement(VysoMark, {
    width: 104,
    color: "#141310"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 440
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(40px,5.4vw,60px)',
      lineHeight: 0.98,
      letterSpacing: '-0.015em',
      fontWeight: 700,
      margin: '0 0 18px'
    }
  }, "Stop running your business on gut feel."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      maxWidth: 360,
      fontSize: 15,
      lineHeight: 1.6,
      color: '#6b645c'
    }
  }, "Sign in to track stock, log wastage, manage suppliers and watch your margins \u2014 live.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 12.5,
      color: '#a39a90'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: 9999,
      background: '#37A169'
    }
  }), "All systems operational")), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 'min(46%,520px)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      background: '#fff',
      borderLeft: '1px solid #eae4dc',
      boxShadow: '-24px 0 60px -40px rgba(60,40,20,0.25)',
      padding: '56px clamp(24px,4vw,64px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '0 auto',
      width: '100%',
      maxWidth: 340
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 26,
      fontWeight: 600,
      margin: '0 0 4px'
    }
  }, "Sign in"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 26px',
      fontSize: 13.5,
      color: '#8a837b'
    }
  }, "Welcome back to your operations platform"), /*#__PURE__*/React.createElement("form", {
    onSubmit: submit
  }, /*#__PURE__*/React.createElement("label", {
    style: LABEL,
    htmlFor: "lg-email"
  }, "Email"), /*#__PURE__*/React.createElement("input", {
    id: "lg-email",
    value: email,
    onChange: e => setEmail(e.target.value),
    style: {
      ...FIELD,
      marginBottom: 18
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 7
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 12.5,
      fontWeight: 500,
      color: '#57524c'
    },
    htmlFor: "lg-pw"
  }, "Password"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      fontSize: 12,
      color: '#BE5D23'
    }
  }, "Forgot?")), /*#__PURE__*/React.createElement("input", {
    id: "lg-pw",
    type: "password",
    value: password,
    onChange: e => setPassword(e.target.value),
    style: {
      ...FIELD,
      marginBottom: 16
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 22,
      fontSize: 12.5,
      color: '#6b645c',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    defaultChecked: true,
    style: {
      accentColor: '#BE5D23'
    }
  }), "Remember me on this device"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    disabled: loading,
    style: {
      width: '100%',
      borderRadius: 10,
      border: 0,
      background: '#141310',
      padding: '14px 0',
      fontSize: 15,
      fontWeight: 600,
      color: '#fff',
      cursor: 'pointer',
      fontFamily: 'var(--font-inter)'
    }
  }, loading ? 'Signing in…' : 'Log in')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      margin: '22px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      flex: 1,
      background: '#eae5de'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: '#a7a099'
    }
  }, "OR"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      flex: 1,
      background: '#eae5de'
    }
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: {
      width: '100%',
      borderRadius: 10,
      border: '1px solid #e3ded7',
      background: '#fff',
      padding: '12px 0',
      fontSize: 15,
      fontWeight: 500,
      color: '#3a352f',
      cursor: 'pointer',
      fontFamily: 'var(--font-inter)'
    }
  }, "Continue with Google"))));
}
Object.assign(window, {
  Login
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/Login.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/WasteWatchScreen.jsx
try { (() => {
const NS = window.VysoDesignSystem_3031f9;
const {
  ModuleHeader,
  PrimaryAction,
  SecondaryAction,
  KpiStrip,
  Kpi,
  SectionCard,
  AreaChart,
  ProgressRing,
  ToneBadge,
  CountUp,
  DataTable
} = NS;
const B = '../../assets/icons-gen';
const zar = n => 'R' + Math.round(n).toLocaleString('en-ZA');
const TIMELINE = {
  week: [820, 1140, 760, 1480, 1210, 1660, 1390],
  month: [3200, 4100, 3650, 5220, 4780, 6110, 5480, 6320],
  quarter: [11200, 13800, 12400, 15600, 14200, 17100]
};
const CATEGORIES = [{
  id: 'produce',
  name: 'Produce',
  cost: 4210,
  color: '#17A858'
}, {
  id: 'dairy',
  name: 'Dairy',
  cost: 2980,
  color: '#3E7BC4'
}, {
  id: 'bakery',
  name: 'Bakery',
  cost: 2140,
  color: '#E6A800'
}, {
  id: 'meat',
  name: 'Meat',
  cost: 1830,
  color: '#CB1552'
}, {
  id: 'dry',
  name: 'Dry goods',
  cost: 820,
  color: '#8D75F4'
}, {
  id: 'other',
  name: 'Other',
  cost: 500,
  color: '#8A8E86'
}];
const INSIGHTS = [{
  id: 1,
  text: 'Produce waste peaks on Mondays — order 12% lighter on Sunday deliveries.',
  module: 'ProcurePulse'
}, {
  id: 2,
  text: 'Bakery write-offs rose 18% after the new supplier switch three weeks ago.',
  module: 'SupplySync'
}, {
  id: 3,
  text: 'Preventable waste is 62% of total — the biggest single lever on your food cost.',
  module: null
}];
function WasteWatchScreen({
  onLog
}) {
  const [period, setPeriod] = React.useState('week');
  const total = CATEGORIES.reduce((s, c) => s + c.cost, 0);
  const pctOf = c => Math.round(c / total * 100);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      padding: '28px 32px',
      fontFamily: 'var(--font-ui)'
    }
  }, /*#__PURE__*/React.createElement(ModuleHeader, {
    icon: "waste",
    title: "WasteWatch",
    description: "Wastage & shrinkage",
    assetBase: B,
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SecondaryAction, null, "Export CSV"), /*#__PURE__*/React.createElement(PrimaryAction, {
      onClick: onLog
    }, "+ Log waste"))
  }), /*#__PURE__*/React.createElement(KpiStrip, {
    columns: 5
  }, /*#__PURE__*/React.createElement(Kpi, {
    label: "Waste cost",
    value: zar(total),
    accent: "#A32D2D",
    sub: "logged to 29 Jun"
  }), /*#__PURE__*/React.createElement(Kpi, {
    label: "Preventable",
    value: zar(total * 0.62),
    accent: "#854F0B",
    sub: "avoidable"
  }), /*#__PURE__*/React.createElement(Kpi, {
    label: "Waste %",
    value: "4.1%",
    accent: "#A32D2D",
    sub: "of food cost"
  }), /*#__PURE__*/React.createElement(Kpi, {
    label: "Top category",
    value: "Produce",
    sub: "34% of waste"
  }), /*#__PURE__*/React.createElement(Kpi, {
    label: "Waste events",
    value: "38",
    sub: "logged"
  })), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Weekly waste report",
    right: /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "of-num",
      style: {
        fontSize: 12,
        color: '#A0A49C'
      }
    }, "23 Jun \u2013 29 Jun"), /*#__PURE__*/React.createElement(ToneBadge, {
      label: "Log has gone quiet",
      tone: "warning"
    }))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      gap: 20,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(ProgressRing, {
    pct: 62,
    color: "#854F0B",
    size: 96,
    thickness: 9
  }, /*#__PURE__*/React.createElement("span", {
    className: "of-num",
    style: {
      fontSize: 22,
      fontWeight: 600,
      letterSpacing: '-0.02em',
      color: '#854F0B'
    }
  }, "62%"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: '#A0A49C'
    }
  }, "preventable")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: '#8A8E86'
    }
  }, "Waste this week"), /*#__PURE__*/React.createElement(CountUp, {
    value: total,
    format: zar,
    className: "of-num",
    style: {
      display: 'block',
      marginTop: 6,
      fontSize: 28,
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: '-0.02em',
      color: '#171A17'
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "of-num",
    style: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: 500,
      color: '#A32D2D'
    }
  }, "\u25B2 12% vs last week"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 12
    }
  }, [['Preventable', zar(total * 0.62), '#854F0B'], ['Unavoidable', zar(total * 0.38), '#6B6F68'], ['Cost of a 1% cut', zar(total * 0.01 * 52), '#0F6E56']].map(([l, v, c]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      borderRadius: 14,
      border: '1px solid #EEF1F5',
      padding: '12px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: '#8A8E86'
    }
  }, l), /*#__PURE__*/React.createElement("div", {
    className: "of-num",
    style: {
      marginTop: 6,
      fontSize: 18,
      fontWeight: 600,
      color: c
    }
  }, v)))))), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Waste cost timeline",
    right: /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'inline-flex',
        borderRadius: 11,
        border: '1px solid #EEF1F5',
        background: '#F7F8FA',
        padding: 4
      }
    }, [['week', 'This week'], ['month', 'Month'], ['quarter', 'Quarter']].map(([k, l]) => /*#__PURE__*/React.createElement("button", {
      key: k,
      type: "button",
      onClick: () => setPeriod(k),
      style: {
        borderRadius: 8,
        border: 0,
        cursor: 'pointer',
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'var(--font-ui)',
        background: period === k ? '#fff' : 'transparent',
        color: period === k ? '#171A17' : '#8A8E86',
        boxShadow: period === k ? '0 1px 2px rgba(20,24,20,0.06)' : 'none'
      }
    }, l)))
  }, /*#__PURE__*/React.createElement(AreaChart, {
    data: TIMELINE[period],
    color: "#A32D2D",
    fill: "#FCEBEB",
    height: 140
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '10px 0 0',
      fontSize: 12,
      color: '#A0A49C'
    }
  }, "Cost of waste over the selected period, straight from the log \u2014 ", /*#__PURE__*/React.createElement("span", {
    className: "of-num",
    style: {
      fontWeight: 500,
      color: '#A32D2D'
    }
  }, "\u25B2 12%"), " vs the previous one.")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "of-display",
    style: {
      margin: '0 0 10px',
      fontSize: 16,
      fontWeight: 600,
      color: '#171A17'
    }
  }, "Top waste sources"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(6,1fr)',
      gap: 12
    }
  }, CATEGORIES.map(c => /*#__PURE__*/React.createElement(WasteCard, {
    key: c.id,
    cat: c,
    pct: pctOf(c.cost)
  })))), /*#__PURE__*/React.createElement(DataTable, {
    columns: [{
      label: 'Logged'
    }, {
      label: 'Category'
    }, {
      label: 'Reason'
    }, {
      label: 'Weight',
      align: 'right'
    }, {
      label: 'Cost',
      align: 'right'
    }],
    rows: [['29 Jun 07:14', 'Produce', 'Spoiled in storage', '4.2 kg', 'R612'], ['28 Jun 19:40', 'Bakery', 'End of day', '8 units', 'R284'], ['28 Jun 12:05', 'Dairy', 'Temperature breach', '6.0 L', 'R418'], ['27 Jun 16:22', 'Meat', 'Trim loss', '1.8 kg', 'R357']],
    empty: "No waste logged yet"
  }), /*#__PURE__*/React.createElement(SectionCard, {
    title: "AI recommendations",
    right: /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 500,
        color: '#1F5FA8'
      }
    }, "\u2726 auto-generated soon")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, INSIGHTS.map(i => /*#__PURE__*/React.createElement("div", {
    key: i.id,
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      height: 6,
      width: 6,
      borderRadius: 9999,
      background: '#1F5FA8',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0,
      flex: 1,
      color: '#171A17'
    }
  }, i.text), i.module ? /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      borderRadius: 9999,
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 500,
      background: '#EAF2FC',
      color: '#1F5FA8'
    }
  }, i.module, " \u2192") : null)))));
}
function WasteCard({
  cat,
  pct
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      borderRadius: 14,
      border: '1px solid ' + (hover ? '#C9DEF7' : '#EEF1F5'),
      background: '#fff',
      padding: 16,
      cursor: 'pointer',
      boxShadow: hover ? '0 6px 18px -10px rgba(20,24,20,0.28)' : '0 1px 2px rgba(20,24,20,0.03)',
      transform: hover ? 'translateY(-2px)' : 'none',
      transition: 'all .16s ease'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      height: 10,
      width: 10,
      borderRadius: 9999,
      background: cat.color
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 500,
      color: '#171A17'
    }
  }, cat.name)), /*#__PURE__*/React.createElement("div", {
    className: "of-num",
    style: {
      marginTop: 10,
      fontSize: 22,
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: '-0.02em',
      color: '#171A17'
    }
  }, zar(cat.cost)), /*#__PURE__*/React.createElement("div", {
    className: "of-num",
    style: {
      marginTop: 6,
      fontSize: 12,
      color: '#A0A49C'
    }
  }, pct, "% of waste"));
}
Object.assign(window, {
  WasteWatchScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/WasteWatchScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/site/Sections.jsx
try { (() => {
const NS = window.VysoDesignSystem_3031f9;
const {
  LiquidButton,
  GradientText,
  GlassCard,
  Badge,
  ProblemLine,
  ModuleTileIcon,
  VysoMark,
  Button,
  Input,
  Textarea,
  Label
} = NS;
const BODY = {
  fontFamily: 'var(--font-body)'
};
const DISPLAY = {
  fontFamily: 'var(--font-display)'
};

/* ── Hero ─────────────────────────────────────────────── */
function Hero() {
  const orange = {
    backgroundImage: 'linear-gradient(135deg,hsl(30 82% 57%),hsl(22 69% 44%),hsl(14 72% 36%))',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    WebkitTextFillColor: 'transparent'
  };
  return /*#__PURE__*/React.createElement("section", {
    style: {
      minHeight: '86vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '0 2rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 820,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1.4rem'
    }
  }, /*#__PURE__*/React.createElement(GradientText, {
    style: {
      ...BODY,
      fontSize: '0.95rem',
      fontWeight: 600,
      letterSpacing: '0.18em',
      textTransform: 'uppercase'
    }
  }, "Configurable operations for SMEs"), /*#__PURE__*/React.createElement("h1", {
    style: {
      ...DISPLAY,
      fontSize: 'clamp(2.8rem,7.5vw,6.4rem)',
      fontWeight: 700,
      lineHeight: 1,
      letterSpacing: '-0.015em',
      color: '#0D0D0D',
      margin: 0,
      textWrap: 'balance'
    }
  }, "Your business is running on ", /*#__PURE__*/React.createElement("span", {
    style: orange
  }, "WhatsApp"), " and ", /*#__PURE__*/React.createElement("span", {
    style: orange
  }, "spreadsheets."), " That ends here."), /*#__PURE__*/React.createElement("p", {
    style: {
      ...BODY,
      fontSize: 'clamp(1.05rem,1.9vw,1.3rem)',
      lineHeight: 1.6,
      color: '#6B6B6B',
      maxWidth: 720,
      margin: 0
    }
  }, "Vyso diagnoses your operational chaos, automates the work, and builds your team a tool they'll actually use."), /*#__PURE__*/React.createElement(LiquidButton, {
    size: "xl"
  }, /*#__PURE__*/React.createElement(GradientText, {
    style: {
      ...BODY,
      fontWeight: 600
    }
  }, "See how it works"), /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 14 14",
    fill: "none",
    style: {
      color: 'hsl(22,69%,44%)'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M7 2v10M2 7l5 5 5-5",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })))));
}

/* ── Problem strip ────────────────────────────────────── */
const PROBLEMS = [['Stock levels guessed, not tracked.', 'Real-time stock visibility, automated.'], ['Wastage never logged.', 'Wastage tracked and reported daily.'], ['Suppliers managed over WhatsApp.', 'Supplier comms centralised and logged.'], ['Reports built manually, every week.', 'Reports generated automatically.'], ['No one knows the real margin.', 'Margin dashboards, always live.']];
function ProblemStrip() {
  const [shown, setShown] = React.useState(0);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        PROBLEMS.forEach((_, i) => setTimeout(() => setShown(n => Math.max(n, i + 1)), i * 180 + 300));
        obs.disconnect();
      }
    }, {
      threshold: 0.3
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return /*#__PURE__*/React.createElement("section", {
    ref: ref,
    style: {
      background: '#fafafa',
      padding: '6.5rem 2rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 860,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      ...BODY,
      fontSize: '0.72rem',
      fontWeight: 600,
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      color: '#bbb',
      marginBottom: '2.8rem'
    }
  }, "Sound familiar?"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2.4rem'
    }
  }, PROBLEMS.map(([p, f], i) => /*#__PURE__*/React.createElement(ProblemLine, {
    key: p,
    problem: p,
    fix: f,
    visible: i < shown
  })))));
}

/* ── How it works ─────────────────────────────────────── */
const STEPS = [['Diagnose', 'We audit your current ops and identify what is breaking.', '../../assets/imagery/how-diagnose.png'], ['Automate', 'We build workflows that remove the manual work.', '../../assets/imagery/how-automate.png'], ['Build', 'Where needed, we ship a module your team uses daily.', '../../assets/imagery/how-build.png']];
function HowItWorks() {
  const [active, setActive] = React.useState(0);
  const [t, d, img] = STEPS[active];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '6.5rem 2rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1160,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      ...DISPLAY,
      fontSize: 'clamp(2.2rem,5vw,4rem)',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      lineHeight: 1.05,
      margin: '0 0 2.4rem'
    }
  }, "How it works"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '0.6rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.6rem',
      width: 76
    }
  }, STEPS.map(([label], i) => /*#__PURE__*/React.createElement("button", {
    key: label,
    onClick: () => setActive(i),
    style: {
      minHeight: 120,
      borderRadius: 0,
      cursor: 'pointer',
      border: '1px solid ' + (i === active ? 'hsl(22 69% 44%)' : '#E5E5E5'),
      background: i === active ? 'hsl(22 69% 44% / 0.06)' : '#fff',
      color: i === active ? 'hsl(22,69%,44%)' : '#888',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      padding: '0.6rem 0.4rem'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      ...DISPLAY,
      fontSize: '1.5rem',
      fontWeight: 700
    }
  }, i + 1), /*#__PURE__*/React.createElement("span", {
    style: {
      ...BODY,
      fontSize: '0.7rem',
      fontWeight: 600,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      writingMode: 'vertical-rl'
    }
  }, label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      gap: '2.5rem',
      border: '1px solid #E5E5E5',
      background: '#fff',
      padding: '2.6rem 2.4rem',
      minHeight: 340
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '40%'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      ...BODY,
      fontSize: '0.68rem',
      fontWeight: 700,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: 'hsl(22,69%,44%)',
      margin: '0 0 0.6rem'
    }
  }, "Step ", active + 1), /*#__PURE__*/React.createElement("h3", {
    style: {
      ...DISPLAY,
      fontSize: '2.2rem',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      margin: '0 0 0.8rem'
    }
  }, t), /*#__PURE__*/React.createElement("p", {
    style: {
      ...BODY,
      fontSize: '0.95rem',
      lineHeight: 1.6,
      color: '#6B6B6B',
      margin: 0
    }
  }, d)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: '#F5F5F5',
      border: '1px solid #E5E5E5',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: img,
    alt: t,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }))))));
}

/* ── Apps showcase ────────────────────────────────────── */
const APPS = [['Doc-U', 'Documents in. Clean data out.', null, '#7B5CF0'], ['ProcurePulse', 'Procurement and stock intelligence.', 'procurepulse', '#8D75F4'], ['WasteWatch', 'Make preventable waste visible.', 'wastewatch', '#086B62'], ['SupplySync', 'Supplier relationships, searchable.', 'supplysync', '#1167D8'], ['ShiftBoard', 'Smarter scheduling, better teams.', 'shiftboard', '#F46A00'], ['OrderFlow', 'From order to delivery, seamlessly.', 'orderflow', '#CB1552'], ['PricePilot', 'Pricing and margin recommendations.', 'pricepilot', '#17A858'], ['InsightGen', 'Operational reports that explain what matters.', 'insightgen', '#E6A800']];
function AppsShowcase() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: '#fafafa',
      padding: '6.5rem 2rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1160,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      ...DISPLAY,
      fontSize: 'clamp(2.2rem,5vw,4rem)',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      margin: '0 0 0.6rem'
    }
  }, "What we build"), /*#__PURE__*/React.createElement("p", {
    style: {
      ...BODY,
      fontSize: '1.05rem',
      color: '#6B6B6B',
      margin: '0 0 2.6rem',
      maxWidth: 560
    }
  }, "Productised modules, configured around your operation \u2014 not a blank-page build."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: '1px',
      background: '#E5E5E5',
      border: '1px solid #E5E5E5'
    }
  }, APPS.map(([name, tag, icon, color]) => /*#__PURE__*/React.createElement(AppCard, {
    key: name,
    name: name,
    tag: tag,
    icon: icon,
    color: color
  })))));
}
function AppCard({
  name,
  tag,
  icon,
  color
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      background: '#fff',
      padding: '1.6rem 1.4rem',
      minHeight: 190,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.9rem',
      boxShadow: hover ? 'inset 0 0 0 1px hsl(22 69% 44%)' : 'none',
      transition: 'box-shadow 0.16s ease',
      cursor: 'pointer'
    }
  }, icon ? /*#__PURE__*/React.createElement(ModuleTileIcon, {
    name: icon,
    size: 52
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 9,
      background: color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      ...DISPLAY,
      fontSize: 26,
      fontWeight: 700
    }
  }, "D"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...DISPLAY,
      fontSize: '1.35rem',
      fontWeight: 700,
      letterSpacing: '-0.01em',
      color: '#0D0D0D'
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      ...BODY,
      fontSize: '0.82rem',
      lineHeight: 1.5,
      color: '#777',
      marginTop: '0.3rem'
    }
  }, tag)), /*#__PURE__*/React.createElement("span", {
    style: {
      ...BODY,
      marginTop: 'auto',
      fontSize: '0.75rem',
      fontWeight: 600,
      color: hover ? 'hsl(22,69%,44%)' : '#bbb'
    }
  }, "See the module \u2192"));
}

/* ── Pricing ──────────────────────────────────────────── */
const TIERS = [{
  num: 'Tier 1',
  name: 'Start',
  tagline: 'We automate what your current tools can already do.',
  features: ['Workflow automation in your existing stack', 'Up to 5 automations included', 'Breakages fixed proactively', 'New automations on a monthly delivery cycle', 'Finch available from Create'],
  pricing: [['Setup (once-off)', 'R10,000', ''], ['Retainer', 'R8,000', '/month']]
}, {
  num: 'Tier 2',
  name: 'Create',
  tagline: 'We replace those tools with a module that owns your data.',
  features: ['One productised Vyso module of your choice', 'Start automations migrated into your module', 'Finch companion app included for your module', 'Team onboarding and 60-day support', 'Dashboard, user roles and handover included'],
  pricing: [['Setup (once-off)', 'R30,000', ''], ['Retainer', 'R10,000', '/month']]
}, {
  num: 'Tier 3',
  name: 'Scale',
  tagline: 'We connect your modules into a full ops platform.',
  features: ['Everything in Create', 'Add modules as your operation grows', 'Finch companion app across all modules', 'Two-way integrations with outside systems', 'Monthly ops reports and quarterly optimisation'],
  pricing: [['Setup (once-off)', 'R50,000', ''], ['Retainer', 'R15,000', '/month']]
}];
function Check({
  muted
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 18 18",
    fill: "none",
    style: {
      flexShrink: 0,
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "9",
    r: "8.25",
    stroke: "hsl(22,69%,44%)",
    strokeOpacity: muted ? 0.4 : 0.9,
    strokeWidth: "1.4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5.5 9l2.5 2.5L12.5 6.5",
    stroke: "hsl(22,69%,44%)",
    strokeOpacity: muted ? 0.4 : 0.9,
    strokeWidth: "1.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}
function Pricing() {
  const [active, setActive] = React.useState(1);
  return /*#__PURE__*/React.createElement("section", {
    id: "pricing",
    style: {
      padding: '6.5rem 2rem',
      background: 'linear-gradient(160deg,#fff 30%,#F7F1EC)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1160,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      ...DISPLAY,
      fontSize: 'clamp(2.2rem,5vw,4rem)',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      margin: '0 0 1.6rem'
    }
  }, "Pricing"), /*#__PURE__*/React.createElement(GlassCard, {
    radius: 18,
    padding: "1.6rem 2rem",
    style: {
      marginBottom: '2rem',
      display: 'flex',
      alignItems: 'center',
      gap: '2rem',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '1.1rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 14,
      background: 'rgba(190,93,35,0.09)',
      border: '1px solid rgba(190,93,35,0.18)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "26",
    height: "26",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "hsl(22,69%,44%)",
    strokeWidth: "1.7",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 21l-4.35-4.35"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 11h6M11 8v6"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, null, "Required first"), /*#__PURE__*/React.createElement("h3", {
    style: {
      ...DISPLAY,
      fontSize: '1.4rem',
      fontWeight: 800,
      letterSpacing: '-0.02em',
      margin: '0.35rem 0 0'
    }
  }, "Audit"), /*#__PURE__*/React.createElement("p", {
    style: {
      ...DISPLAY,
      fontSize: '1.1rem',
      fontWeight: 700,
      color: 'hsl(22,69%,44%)',
      margin: '0.1rem 0 0'
    }
  }, "R2,000 ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.78rem',
      fontWeight: 500,
      color: '#888'
    }
  }, "once-off")))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 240
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      ...BODY,
      fontSize: '0.83rem',
      color: '#666',
      lineHeight: 1.55,
      margin: '0 0 0.35rem'
    }
  }, "One week of operational diagnostics before any engagement. De-risks delivery."), /*#__PURE__*/React.createElement("p", {
    style: {
      ...BODY,
      fontSize: '0.75rem',
      color: 'hsl(22,69%,44%)',
      margin: 0
    }
  }, "A clear plan before setup or monthly work begins.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '0.5rem 2.2rem',
      flex: 1,
      flexWrap: 'wrap'
    }
  }, ['Operations review', 'Bottleneck identification', 'Automation opportunities', 'Recommendations report', 'One-week diagnostic period'].map(f => /*#__PURE__*/React.createElement("div", {
    key: f,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.45rem'
    }
  }, /*#__PURE__*/React.createElement(Check, {
    muted: true
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      ...BODY,
      fontSize: '0.8rem',
      color: '#555'
    }
  }, f))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: '1.4rem',
      alignItems: 'stretch'
    }
  }, TIERS.map((t, i) => /*#__PURE__*/React.createElement(GlassCard, {
    key: t.name,
    active: i === active,
    radius: 22,
    padding: "1.8rem",
    onMouseEnter: () => setActive(i),
    style: {
      display: 'flex',
      flexDirection: 'column',
      transform: i === active ? 'translateY(-8px)' : 'none',
      transition: 'transform 0.3s ease, box-shadow 0.3s ease',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      ...BODY,
      fontSize: '0.68rem',
      fontWeight: 700,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: i === active ? 'hsl(22,69%,44%)' : '#b0aaa4',
      margin: '0 0 0.5rem',
      transition: 'color 0.4s ease'
    }
  }, t.num), /*#__PURE__*/React.createElement("h3", {
    style: {
      ...DISPLAY,
      fontSize: '2.4rem',
      fontWeight: 800,
      letterSpacing: '-0.03em',
      lineHeight: 1,
      margin: '0 0 0.5rem'
    }
  }, t.name), /*#__PURE__*/React.createElement("p", {
    style: {
      ...BODY,
      fontSize: '0.86rem',
      lineHeight: 1.5,
      color: '#666',
      margin: '0 0 1.3rem'
    }
  }, t.tagline), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.6rem',
      marginBottom: '1.5rem'
    }
  }, t.features.map(f => /*#__PURE__*/React.createElement("div", {
    key: f,
    style: {
      display: 'flex',
      gap: '0.55rem'
    }
  }, /*#__PURE__*/React.createElement(Check, null), /*#__PURE__*/React.createElement("span", {
    style: {
      ...BODY,
      fontSize: '0.83rem',
      lineHeight: 1.45,
      color: '#444'
    }
  }, f)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      borderTop: '1px solid rgba(0,0,0,0.07)',
      paddingTop: '1.1rem'
    }
  }, t.pricing.map(([label, value, unit]) => /*#__PURE__*/React.createElement("div", {
    key: label,
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: '0.35rem'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      ...BODY,
      fontSize: '0.75rem',
      color: '#888'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      ...DISPLAY,
      fontSize: '1.25rem',
      fontWeight: 700,
      color: '#0D0D0D'
    }
  }, value, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.75rem',
      fontWeight: 500,
      color: '#888'
    }
  }, unit)))), /*#__PURE__*/React.createElement(Button, {
    style: {
      width: '100%',
      height: 44,
      marginTop: '0.9rem'
    }
  }, "Join Waitlist")))))));
}

/* ── Contact ──────────────────────────────────────────── */
function Contact() {
  const [sent, setSent] = React.useState(false);
  return /*#__PURE__*/React.createElement("section", {
    id: "contact",
    style: {
      padding: '6.5rem 2rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1160,
      margin: '0 auto',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '4rem',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      ...DISPLAY,
      fontSize: 'clamp(2.4rem,5vw,4rem)',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      lineHeight: 1.02,
      margin: '0 0 1rem'
    }
  }, "Ready to stop running your business on gut feel?"), /*#__PURE__*/React.createElement("p", {
    style: {
      ...BODY,
      fontSize: '1.05rem',
      lineHeight: 1.6,
      color: '#6B6B6B',
      margin: '0 0 1.6rem',
      maxWidth: 420
    }
  }, "Tell us what is breaking. We will reply within 24 hours with a straight answer on whether Vyso is the right fit."), /*#__PURE__*/React.createElement("p", {
    style: {
      ...BODY,
      fontSize: '0.85rem',
      color: '#888',
      margin: 0
    }
  }, "joshua@vyso.co.za \xB7 vyso.co.za \xB7 Cape Town, South Africa")), /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid #E5E5E5',
      background: '#fff',
      padding: '2rem'
    }
  }, sent ? /*#__PURE__*/React.createElement("div", {
    style: {
      ...BODY,
      fontSize: '0.95rem',
      color: '#0F6E56'
    }
  }, "Thanks \u2014 your enquiry is in. We will reply within 24 hours.") : /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      setSent(true);
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '1rem'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "c-name"
  }, "Name"), /*#__PURE__*/React.createElement(Input, {
    id: "c-name",
    placeholder: "Joshua"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "c-biz"
  }, "Business name"), /*#__PURE__*/React.createElement(Input, {
    id: "c-biz",
    placeholder: "Turn 'n Slice"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '1rem'
    }
  }, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "c-email"
  }, "Email"), /*#__PURE__*/React.createElement(Input, {
    id: "c-email",
    type: "email",
    placeholder: "you@business.co.za"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '1rem'
    }
  }, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "c-msg"
  }, "Where is it breaking?"), /*#__PURE__*/React.createElement(Textarea, {
    id: "c-msg",
    rows: 4,
    placeholder: "Stock, wastage, suppliers, reporting\u2026"
  })), /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    style: {
      width: '100%',
      height: 48,
      marginTop: '1.4rem'
    }
  }, "Send enquiry")))));
}

/* ── Footer ───────────────────────────────────────────── */
const FOOTER = [['Platform', ['Overview', 'OrderFlow', 'Finch', 'All modules', 'Vyso for SMEs']], ['Solutions', ['Reduce money leakage', 'Procurement automation', 'Reporting automation', 'Operations dashboard']], ['For food businesses', ['Restaurants', 'Food suppliers', 'Farms & producers', 'Catering companies', 'Wholesale']], ['Resources & tools', ['Learn', 'Guides & templates', 'ROI calculator', 'Operations audit', 'Integrations']], ['Work with Vyso', ['Founding clients', 'Pricing', 'FAQ', 'Contact', 'Privacy']]];
function SiteFooter() {
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      borderTop: '1px solid #E5E5E5',
      padding: '2.8rem 2rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1160,
      margin: '0 auto',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '2rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.4rem'
    }
  }, /*#__PURE__*/React.createElement(VysoMark, {
    width: 80,
    color: "#0d0d0d"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      ...BODY,
      fontSize: '0.75rem',
      color: '#bbb',
      letterSpacing: '0.04em'
    }
  }, "vyso.co.za")), /*#__PURE__*/React.createElement("nav", {
    style: {
      flex: '1 1 620px',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))',
      gap: '1.5rem 2.5rem'
    }
  }, FOOTER.map(([label, links]) => /*#__PURE__*/React.createElement("div", {
    key: label
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 0.7rem',
      ...DISPLAY,
      fontSize: '0.8rem',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: '#0d0d0d'
    }
  }, label), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      display: 'grid',
      gap: '0.42rem',
      padding: 0,
      margin: 0
    }
  }, links.map(l => /*#__PURE__*/React.createElement("li", {
    key: l
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      ...BODY,
      fontSize: '0.82rem',
      color: '#777',
      textDecoration: 'none'
    }
  }, l)))))))), /*#__PURE__*/React.createElement("p", {
    style: {
      ...BODY,
      maxWidth: 1160,
      margin: '2rem auto 0',
      fontSize: '0.75rem',
      color: '#aaa'
    }
  }, "Built to replace chaos with clarity."));
}
Object.assign(window, {
  Hero,
  ProblemStrip,
  HowItWorks,
  AppsShowcase,
  Pricing,
  Contact,
  SiteFooter
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/site/Sections.jsx", error: String((e && e.message) || e) }); }

// ui_kits/site/SiteNav.jsx
try { (() => {
const {
  VysoMark,
  LiquidButton,
  GradientText
} = window.VysoDesignSystem_3031f9;
const LINK = {
  fontFamily: 'var(--font-body)',
  fontSize: '0.88rem',
  fontWeight: 500,
  color: '#0d0d0d',
  textDecoration: 'none',
  letterSpacing: '0.01em',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  background: 'none',
  border: 0,
  padding: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4
};
const MENU_LABEL = {
  fontFamily: 'var(--font-body)',
  fontSize: '0.66rem',
  fontWeight: 700,
  color: '#8a8a8a',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  margin: '0 0 0.65rem 0.3rem'
};
const PLATFORM_LINKS = [['Platform overview', 'One connected operating layer, configured around your business.'], ['OrderFlow', 'Move from incoming order to fulfilment and invoicing in one flow.'], ['Finch', 'Find answers and take action across your operational data.'], ['All Modules', 'Every Vyso module, with real screens from the platform.']];
const SOLUTIONS = ['Reduce money leakage', 'Procurement automation', 'Reporting automation', 'Operations dashboard'];
const INDUSTRIES = ['Restaurants', 'Food suppliers', 'Farms', 'Catering companies', 'Wholesale', 'Hospitality'];
function MegaRow({
  label,
  description
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'grid',
      gridTemplateColumns: '38px minmax(0,1fr) 16px',
      alignItems: 'center',
      gap: '0.8rem',
      padding: '0.72rem',
      borderRadius: 14,
      background: hover ? 'rgba(255,255,255,0.5)' : 'transparent',
      transition: 'background 0.16s ease',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 38,
      height: 38,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 11,
      color: 'hsl(22,69%,42%)',
      background: 'hsl(22 69% 44% / 0.10)',
      border: '1px solid hsl(22 69% 44% / 0.12)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "17",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "7",
    height: "7",
    rx: "1.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "3",
    width: "7",
    height: "7",
    rx: "1.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "14",
    width: "7",
    height: "7",
    rx: "1.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "14",
    width: "7",
    height: "7",
    rx: "1.5"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontFamily: 'var(--font-body)',
      fontSize: '0.88rem',
      fontWeight: 650,
      letterSpacing: '-0.01em'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginTop: 2,
      fontFamily: 'var(--font-body)',
      fontSize: '0.73rem',
      lineHeight: 1.4,
      color: '#727272'
    }
  }, description)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#aaa',
      fontSize: 14
    }
  }, "\u203A"));
}
function SiteNav() {
  const [open, setOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 500,
      height: 64,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 clamp(16px,4vw,40px)',
      background: 'transparent'
    }
  }, /*#__PURE__*/React.createElement(VysoMark, {
    width: 120,
    color: "#0d0d0d"
  }), /*#__PURE__*/React.createElement("nav", {
    style: {
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: 'clamp(1.15rem,2.2vw,2.2rem)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("a", {
    style: LINK,
    href: "#"
  }, "Home"), /*#__PURE__*/React.createElement("button", {
    style: {
      ...LINK,
      color: open ? 'hsl(22,69%,44%)' : '#0d0d0d'
    },
    onClick: () => setOpen(o => !o)
  }, "Platform", /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    style: {
      transform: open ? 'rotate(180deg)' : 'none',
      transition: 'transform 0.2s ease'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "m6 9 6 6 6-6"
  }))), /*#__PURE__*/React.createElement("a", {
    style: LINK,
    href: "#pricing"
  }, "Pricing"), /*#__PURE__*/React.createElement("a", {
    style: LINK,
    href: "#"
  }, "FAQ")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '1.5rem'
    }
  }, /*#__PURE__*/React.createElement("a", {
    style: {
      ...LINK,
      fontSize: '0.84rem'
    },
    href: "#"
  }, "Log in \u2192"), /*#__PURE__*/React.createElement(LiquidButton, {
    size: "md"
  }, /*#__PURE__*/React.createElement(GradientText, {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 500,
      letterSpacing: '0.06em'
    }
  }, "Join Waitlist"))), open ? /*#__PURE__*/React.createElement("div", {
    className: "vyso-pop-in",
    style: {
      position: 'absolute',
      top: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(760px,calc(100vw - 32px))',
      zIndex: 600,
      background: 'rgba(255,255,255,0.76)',
      backdropFilter: 'blur(30px) saturate(1.9)',
      border: '1px solid rgba(255,255,255,0.76)',
      borderRadius: 22,
      boxShadow: 'var(--glass-shadow-panel)',
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.65fr) minmax(220px,0.85fr)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '1.25rem'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: MENU_LABEL
  }, "Platform"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: '0.3rem'
    }
  }, PLATFORM_LINKS.map(([l, dd]) => /*#__PURE__*/React.createElement(MegaRow, {
    key: l,
    label: l,
    description: dd
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'rgba(0,0,0,0.07)',
      margin: '0.85rem 0 1rem'
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: MENU_LABEL
  }, "Solutions"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '0.3rem'
    }
  }, SOLUTIONS.map(s => /*#__PURE__*/React.createElement("div", {
    key: s,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.6rem',
      minHeight: 42,
      padding: '0.5rem 0.6rem',
      borderRadius: 12,
      fontFamily: 'var(--font-body)',
      fontSize: '0.8rem',
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "hsl(22,69%,42%)",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 3v18h18"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 15l4-4 3 3 5-6"
  })), s)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '1.25rem',
      background: 'rgba(255,255,255,0.30)',
      borderLeft: '1px solid rgba(255,255,255,0.72)'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: MENU_LABEL
  }, "Industries"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: '0.3rem'
    }
  }, INDUSTRIES.map(i => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 46,
      padding: '0.65rem 0.7rem',
      borderRadius: 12,
      fontFamily: 'var(--font-body)',
      fontSize: '0.84rem',
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, i, /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#aaa'
    }
  }, "\u203A")))))) : null);
}
Object.assign(window, {
  SiteNav
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/site/SiteNav.jsx", error: String((e && e.message) || e) }); }

__ds_ns.AppIcon = __ds_scope.AppIcon;

__ds_ns.ModuleTileIcon = __ds_scope.ModuleTileIcon;

__ds_ns.VysoMark = __ds_scope.VysoMark;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.GlassCard = __ds_scope.GlassCard;

__ds_ns.GradientText = __ds_scope.GradientText;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Label = __ds_scope.Label;

__ds_ns.LiquidButton = __ds_scope.LiquidButton;

__ds_ns.ProblemLine = __ds_scope.ProblemLine;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.AreaChart = __ds_scope.AreaChart;

__ds_ns.Sparkline = __ds_scope.Sparkline;

__ds_ns.ConfidenceText = __ds_scope.ConfidenceText;

__ds_ns.CountUp = __ds_scope.CountUp;

__ds_ns.DataTable = __ds_scope.DataTable;

__ds_ns.Kpi = __ds_scope.Kpi;

__ds_ns.KpiStrip = __ds_scope.KpiStrip;

__ds_ns.KpiTile = __ds_scope.KpiTile;

__ds_ns.ModuleHeader = __ds_scope.ModuleHeader;

__ds_ns.ModuleTile = __ds_scope.ModuleTile;

__ds_ns.PrimaryAction = __ds_scope.PrimaryAction;

__ds_ns.ProgressRing = __ds_scope.ProgressRing;

__ds_ns.SecondaryAction = __ds_scope.SecondaryAction;

__ds_ns.SectionCard = __ds_scope.SectionCard;

__ds_ns.StatusPill = __ds_scope.StatusPill;

__ds_ns.ToneBadge = __ds_scope.ToneBadge;

})();
