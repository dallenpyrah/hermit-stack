export function assertRoomId(input: string): asserts input is `room_${string}` {
  if (!input.startsWith("room_")) {
    throw new TypeError(input);
  }
}
