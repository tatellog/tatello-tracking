import { G, Path } from 'react-native-svg'

import { colors } from '@/theme'

/*
 * The ornamental constellation — extracted from
 * `assets/constellations/constellation_app_day.svg`. Source viewBox
 * is 1024 × 1024; the parent <G transform> in OrbitalSystem scales
 * and positions this into our smaller canvas. Native vector means
 * the figure stays crisp at any zoom and the parent's colour /
 * opacity props ripple through to every stroke.
 *
 * Two visual layers:
 *   • Lines + ornamental scrollwork — stroked, no fill, magenta.
 *   • Eight burst stars — filled diamonds at the line endpoints.
 *
 * The app overlays its six live `StarNode`s on top of six of the
 * eight burst positions; the two extra bursts (right-mid and the
 * central diamond) read as decorative anchors.
 */
export function ConstellationDrawing() {
  return (
    <>
      {/* Lines + ornamental curves — stroked. */}
      <G
        stroke={colors.magenta}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.78}
      >
        {/* Main constellation lines */}
        <Path d="M323 252 L492 145" />
        <Path d="M492 145 L662 252" />
        <Path d="M662 252 C731 315 750 404 719 488" />
        <Path d="M662 252 L604 568" />
        <Path d="M719 488 L604 568 L509 755" />
        <Path d="M319 563 L509 755" />
        <Path d="M323 252 C257 347 259 475 319 563" />
        <Path d="M509 755 L509 528" />

        {/* Ornamental curves */}
        <Path d="M323 252 C366 184 432 157 492 145 C556 134 626 174 662 252" />
        <Path d="M492 145 C525 93 588 86 607 122 C625 156 582 174 569 143 C559 119 590 110 600 132" />
        <Path d="M323 252 C270 300 254 386 285 459 C301 496 325 521 319 563" />
        <Path d="M334 290 C292 354 307 407 362 435 C398 454 405 506 365 543" />
        <Path d="M313 525 C265 529 261 589 305 595 C338 599 338 557 309 562" />
        <Path d="M300 349 C319 367 335 363 351 337 C326 338 311 342 300 349Z" />
        <Path d="M662 252 C738 315 756 441 719 488 C675 545 638 624 509 755" />
        <Path d="M642 301 C574 344 544 431 571 490 C585 519 607 543 604 568" />
        <Path d="M588 335 C625 339 650 319 669 277 C621 285 596 305 588 335Z" />
        <Path d="M624 646 C673 619 709 563 717 493 C666 528 635 578 624 646Z" />
        <Path d="M640 584 C679 554 693 515 697 480 C650 504 628 543 640 584Z" />
        <Path d="M509 755 C548 796 597 805 624 773 C591 779 561 763 533 722" />
        <Path d="M505 479 C531 435 581 438 584 482 C586 511 544 517 548 487 C552 464 577 470 570 490" />
      </G>

      {/* Eight burst stars — filled diamonds at the line endpoints.
          The app's live StarNodes overlay six of these; the centre
          and right-mid remain as decorative anchors. Drawn slightly
          darker than the lines so the live stars pop above them. */}
      <G fill={colors.magentaDeep} stroke="none" opacity={0.55}>
        <Path d="M492 103 L507 135 L540 145 L507 155 L492 187 L477 155 L444 145 L477 135Z" />
        <Path d="M323 214 L335 244 L365 252 L335 260 L323 290 L311 260 L281 252 L311 244Z" />
        <Path d="M662 214 L674 244 L704 252 L674 260 L662 290 L650 260 L620 252 L650 244Z" />
        <Path d="M319 528 L330 555 L358 563 L330 571 L319 598 L308 571 L280 563 L308 555Z" />
        <Path d="M719 454 L731 480 L759 488 L731 496 L719 522 L707 496 L679 488 L707 480Z" />
        <Path d="M604 536 L616 561 L642 568 L616 575 L604 600 L592 575 L566 568 L592 561Z" />
        <Path d="M509 714 L523 745 L556 755 L523 765 L509 796 L495 765 L462 755 L495 745Z" />
        <Path d="M509 502 L517 521 L537 528 L517 535 L509 554 L501 535 L481 528 L501 521Z" />
      </G>
    </>
  )
}
