// Jest globalTeardown — stops the Testcontainers Postgres started in
// jest.global-setup.js. No-op when the CI passthrough path was used (no
// container handle was stashed).

module.exports = async function globalTeardown() {
  const container = globalThis.__LL_PG_CONTAINER__;
  if (container) {
    console.log('[jest.global-teardown] Stopping Postgres testcontainer...');
    await container.stop();
  }
};
