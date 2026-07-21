// utilsRoomDisplay.ts - single source for room + passenger display-name resolution
// and web room display composition.
//
// What it owns:
//   - roomGuestName(room)   → lead guest name | null  (resolved → override → null)
//   - passengerName(pax)    → lead passenger name      (resolved → label → 'Guest')
//   - webRoomDisplay(room)  → { roomName, guestLine }  (web mirror of pdfShared.roomDisplay)
//
// What it does not own:
//   - PDF room layout (pdfShared.roomDisplay/roomLine own the PDF composition;
//     both import roomGuestName from here so the NAME logic is single-source)
//   - guest-name RESOLUTION precedence (that's _shared/names.ts server-side;
//     this consumes the already-resolved resolvedGuestName / resolvedPassengerLabel)
//
// Dependency-free (imports nothing) so both the PDF layer and web/admin can import it
// without cycles. ?? not || throughout - empty string is a deliberate suppress.
//
// Last updated: S55 - extracted (#1b). roomGuestName + passengerName single-sourced
//   across pdfShared, ImmerseConfirmedSections, BookingRoomsEditor, WelcomeLettersEditor, BriefEditorPage.

export interface RoomNameLike {
  resolvedGuestName?: string | null
  guestName?:          string | null
}

// The room's lead guest name. null when nothing resolves (caller supplies any
// 'Guest' fallback at the display edge - keeps this honest about "no name").
export function roomGuestName(room: RoomNameLike): string | null {
  return (room.resolvedGuestName ?? room.guestName ?? null)
}

export interface PassengerNameLike {
  resolvedPassengerLabel?: string | null
  passengerLabel?:          string | null
}

// Lead passenger display name. Falls back to 'Guest' at the edge (unlike
// roomGuestName which returns null - a passenger row always renders a name).
// ?? not ||: resolvePartyName returns null (never ''), so empty never falls through.
export function passengerName(p: PassengerNameLike): string {
  return (p.resolvedPassengerLabel ?? p.passengerLabel) ?? 'Guest'
}

// Web room display parts. Mirror of pdfShared.roomDisplay's structure so web and
// PDF compose from the same shape. guestLine = lead name · additional · party.
export interface WebRoomLike extends RoomNameLike {
  resolvedAdditionalGuests?: string[] | null
  additionalGuests?:          string[] | null
  partyComposition?:          string | null
  roomName?:                  string | null
}

export interface WebRoomDisplay {
  roomName:  string | null
  guestLine: string | null
}

export function webRoomDisplay(room: WebRoomLike): WebRoomDisplay {
  const guests: string[] = []
  const lead = roomGuestName(room)
  if (lead) guests.push(lead)
  if (room.resolvedAdditionalGuests?.length) guests.push(...room.resolvedAdditionalGuests)
  if (room.partyComposition) guests.push(room.partyComposition)
  return {
    roomName:  room.roomName ?? null,
    guestLine: guests.length ? guests.join('  \u00b7  ') : null,
  }
}