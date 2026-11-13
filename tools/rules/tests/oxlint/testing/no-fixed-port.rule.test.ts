import { RuleTester } from "oxlint/plugins-dev";

import { noFixedPort } from "#oxlint/testing/no-fixed-port.rule";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
const error = { message: /binds the fixed port/u };
const inTests = "services/engine/tests/host/serve.layer.test.ts";

tester.run("testing/no-fixed-port", noFixedPort, {
  valid: [
    { code: "const anyPort = 0; serve({ port: anyPort });", filename: inTests },
    { code: "serve({ port: 0 }); server.listen(0);", filename: inTests },
    { code: "const config = { AKTER_PORT: String(0) };", filename: inTests },
    { code: "const port = 8080; deploy.exposePort('sbx-1', port);", filename: inTests },
    { code: "reply({ port: Number(request.port) });", filename: inTests },
    { code: "serve({ port: 8080 });", filename: "services/engine/src/host/serve.layer.ts" },
    { code: "const env = { PORT: 'not-a-port' };", filename: inTests },
  ],
  invalid: [
    { code: "serve({ port: 18_281 });", errors: [error], filename: inTests },
    { code: "const port = 18_281; const config = { AKTER_PORT: String(port) };", errors: [error], filename: inTests },
    { code: "export const port = 4000; serve({ port });", errors: [error], filename: inTests },
    { code: "const env = { PORT: '4000' };", errors: [error], filename: inTests },
    { code: "server.listen(3000);", errors: [error], filename: inTests },
    { code: "serve({ port: 8080 });", errors: [error], filename: "packages/client/serve.layer.test.ts" },
  ],
});
