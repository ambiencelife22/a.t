// ProgrammeAdminTabs.ts — Re-export shim for ProgrammeAdmin's internal tab
// functions, so AmbienceAdmin can mount them without forking.
//
// REQUIRES: ProgrammeAdmin.tsx surgical edit — convert the six internal tab
// function declarations from `function X()` to `export function X()`:
//
//   function ProgrammesTab()        →  export function ProgrammesTab()
//   function WelcomeLettersTab()    →  export function WelcomeLettersTab()
//   function ListingsTab()          →  export function ListingsTab()
//   function PropertySectionsTab()  →  export function PropertySectionsTab()
//   function PropertiesTab()        →  export function PropertiesTab()
//   function AccessDeniedPageTab()  →  export function AccessDeniedPageTab()
//
// Six single-keyword additions. Default export stays untouched. The existing
// programme.ambience.travel/#admin route is unaffected.
//
// Last updated: S33

export {
  ProgrammesTab,
  WelcomeLettersTab,
  ListingsTab,
  PropertySectionsTab,
  PropertiesTab,
  AccessDeniedPageTab,
} from './ProgrammeAdmin'