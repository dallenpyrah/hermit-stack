import { Context } from "effect";

class Delivery extends Context.Service<Delivery, {}>()("test/Delivery") {}

export { Delivery };
