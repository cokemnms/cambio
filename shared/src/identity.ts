/**
 * Stable per-room player identity derived from the display name. This lets a
 * player rejoin a room from ANY device/tab by entering the same name + room
 * code — the seat is keyed by name, not by the device.
 *
 * Transport connection ids stay unique per connection (PartyKit requires that);
 * the server maps each live connection to the seat key this produces.
 *
 * Tradeoff (intended): within a room, the name IS the identity — two people must
 * use different names, and anyone who knows your name + room code can take your
 * seat. Fine for a private game among friends.
 */
export function seatKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 24) || "player";
}
