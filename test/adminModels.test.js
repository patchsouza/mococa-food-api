import test from 'node:test';
import assert from 'node:assert/strict';
import { Admin } from '../src/models/Admin.js';
import { ServiceArea } from '../src/models/ServiceArea.js';
import { User } from '../src/models/User.js';

test('admin accounts use a separate model and cannot be assigned to common users', () => {
  const commonUser = new User({ name: 'Admin', email: 'admin@example.com', passwordHash: 'hash', role: 'admin' });
  const admin = new Admin({ name: 'Admin', email: 'admin@example.com', passwordHash: 'hash' });

  assert.equal(commonUser.validateSync().errors.role.kind, 'enum');
  assert.equal(admin.validateSync(), undefined);
  assert.equal(Admin.schema.path('passwordHash').options.select, false);
});

test('courier payout requests have stable IDs and constrained states', () => {
  const courier = new User({
    name: 'Courier', email: 'courier@example.com', passwordHash: 'hash', role: 'courier',
    courierProfile: { balance: 40, reservedBalance: 10, payoutRequests: [{ amount: 10, status: 'pending' }] }
  });
  const payout = courier.courierProfile.payoutRequests[0];

  assert.ok(payout._id);
  assert.equal(payout.status, 'pending');
  assert.equal(courier.validateSync(), undefined);
});

test('service areas cast GeoJSON polygons', () => {
  const area = new ServiceArea({
    name: 'Centro', slug: 'centro', city: 'Mococa', state: 'SP',
    boundary: { type: 'Polygon', coordinates: [[[-47.1, -21.5], [-47, -21.5], [-47, -21.4], [-47.1, -21.5]]] }
  });

  assert.equal(area.validateSync(), undefined);
  assert.equal(area.boundary.type, 'Polygon');
  assert.deepEqual(area.boundary.coordinates[0][0], [-47.1, -21.5]);
});