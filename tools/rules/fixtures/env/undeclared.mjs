const local = process.env.LOCAL;
const missing = process.env.MISSING;
const name = "LOCAL";
const computed = process.env[name];

export { computed, local, missing };
