export interface Room {
  readonly id: string;
}

export const isRoom = (input: object): input is Room => "id" in input;
