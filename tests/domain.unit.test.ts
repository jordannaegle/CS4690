import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MEMBERSHIP_ROLES,
  TENANTS,
  USER_ROLES,
  isMembershipRole,
  isTenantKey,
  isUserRole
} from '../domain.js';

test('tenant metadata exposes the expected campus names and theme labels', () => {
  assert.deepEqual(TENANTS.uvu, {
    slug: 'uvu',
    shortName: 'UVU',
    name: 'Utah Valley University',
    themeName: 'Summit Green'
  });

  assert.deepEqual(TENANTS.uofu, {
    slug: 'uofu',
    shortName: 'UofU',
    name: 'University of Utah',
    themeName: 'Wasatch Red'
  });
});

test('isTenantKey only accepts configured tenant slugs', () => {
  assert.equal(isTenantKey('uvu'), true);
  assert.equal(isTenantKey('uofu'), true);
  assert.equal(isTenantKey('utah'), false);
  assert.equal(isTenantKey(''), false);
});

test('isUserRole only accepts valid system roles', () => {
  for (const role of USER_ROLES) {
    assert.equal(isUserRole(role), true);
  }

  assert.equal(isUserRole('guest'), false);
  assert.equal(isUserRole('teacher_assistant'), false);
});

test('isMembershipRole only accepts course membership roles', () => {
  for (const role of MEMBERSHIP_ROLES) {
    assert.equal(isMembershipRole(role), true);
  }

  assert.equal(isMembershipRole('admin'), false);
  assert.equal(isMembershipRole('observer'), false);
});

test('membership roles remain a subset of user roles', () => {
  for (const membershipRole of MEMBERSHIP_ROLES) {
    assert.equal(USER_ROLES.includes(membershipRole), true);
  }
});
