import { G, Path } from 'react-native-svg'

import { colors } from '@/theme'

/*
 * The ornamental constellation — extracted from
 * `assets/constellations/constellation_app_day.svg`. Source viewBox
 * is 1024 × 1024; the parent <G transform> in OrbitalSystem scales
 * and positions this into our smaller canvas.
 *
 * Lines + ornamental scrollwork ONLY. The eight burst-star diamond
 * paths from the source were intentionally dropped — the app paints
 * its own luminous bursts (StarNode for the six interactive
 * dimensions, DecorativeStar for the two extras) so every star
 * gets the proper bloom + diffraction-spike treatment. Drawing the
 * flat SVG diamonds underneath just produced competing visual
 * shapes that the bright stars couldn't dominate.
 */
export function ConstellationDrawing() {
  return (
    <>
      {/* Lines + ornamental curves — stroked. */}
      <G
        stroke={colors.magenta}
        strokeWidth={2.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.72}
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
    </>
  )
}
