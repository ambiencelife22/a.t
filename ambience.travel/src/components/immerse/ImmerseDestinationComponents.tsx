// ImmerseDestinationComponents.tsx — re-export shim
// Owns: nothing — pure pass-through to keep existing import paths stable.
//   Original 1,243-line file split across:
//     · ImmerseDestComponents.tsx     (Intro · ContentGrid · DestPricing)
//     · ImmerseHotelOptions.tsx       (Hotel selector + carousels + lightbox)
//     · ImmerseRoomCategory.tsx       (RoomCategory render)
//     · ImmerseCarouselNav.tsx        (NavRow + arrow style helpers)
//   Keyframes hoisted to src/index.css.
// Last updated: S31 — Converted from monolith to shim.
// Prior: S30G — see split source files for prior history.
//
// Note: lib/immerseTypes.ts comments still reference this file as the home of
// PRICING_CLOSER_DEFAULT — accurate via re-export through ImmerseDestComponents.

export { ImmerseDestIntro, ImmerseContentGrid, ImmerseDestPricing } from './ImmerseDestComponents'
export { ImmerseHotelOptions } from './ImmerseHotelOptions'