import { createClient } from "redis";

export const cache = () => createClient();
