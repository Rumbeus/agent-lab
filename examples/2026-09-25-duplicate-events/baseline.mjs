export function createInbox(deliver) {
  const tenants = new Map();
  return async function handle(event) {
    const { tenantId, id } = event;
    let deliveries = tenants.get(tenantId);
    if (!deliveries) {
      deliveries = new Map();
      tenants.set(tenantId, deliveries);
    }

    if (deliveries.has(id)) {
      await deliveries.get(id);
      return { status: 'duplicate' };
    }

    // Register the attempt before invoking user code, including synchronous code.
    const attempt = Promise.resolve().then(() => deliver(event));
    deliveries.set(id, attempt);
    try {
      await attempt;
      return { status: 'delivered' };
    } catch (error) {
      deliveries.delete(id);
      if (deliveries.size === 0) tenants.delete(tenantId);
      throw error;
    }
  };
}
