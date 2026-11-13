import { data as payload } from "./source.js";

const { data: received } = payload;

send({ data: received, info: 1 });

const options = { data: 1, info: 2 };

export const total = options.data + options.info;
