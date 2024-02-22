import { createServer } from "@vue-storefront/middleware";

async function runMiddleware(app) {
  return new Promise((resolve) => {
    const server = app.listen(8181, async () => {
      resolve(server);
    });
  });
}

export default async () => {
  const app = await createServer({
    integrations: {
      commerce: {
        location: "./src/__tests__/__mocks__/apiClient/server",
        configuration: {},
      },
    },
  });
  const server = await runMiddleware(app);
  globalThis.__MIDDLEWARE__ = server;
};