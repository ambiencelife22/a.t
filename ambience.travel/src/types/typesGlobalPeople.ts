// Global people types. Backed by global_people via the global-people EF
// (queriesGlobalPeople). Camel throughout (EF camelizes).
export interface GlobalPersonResolved {
  id:                  string
  firstName:           string | null
  middleName:          string | null
  lastName:            string | null
  fatherName:          string | null
  grandfatherName:     string | null
  patronymicConnector: string | null
  pronouns:            string | null
  nickname:            string | null
  email:               string | null
  phone:               string | null
  lastInitial:         string | null
  isPublicDisplay:     boolean
  over18ConfirmedAt:   string | null
  displayName:         string
}
// Editable fields for create/update. All optional - create defaults NOT NULLs.
export interface GlobalPersonInput {
  firstName?:           string | null
  middleName?:          string | null
  lastName?:            string | null
  fatherName?:          string | null
  grandfatherName?:     string | null
  patronymicConnector?: string | null
  pronouns?:            string | null
  nickname?:            string | null
  email?:               string | null
  phone?:               string | null
  notes?:               string | null
  lastInitial?:         string | null
  isPublicDisplay?:     boolean
  over18ConfirmedAt?:   string | null
}
