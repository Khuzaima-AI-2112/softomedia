#!/usr/bin/env node

/**
 * Sprint 16 migration: normalize loop.status and slots[].status to lowercase.
 * One-shot operational script; safe to rerun.
 */

import admin from 'firebase-admin';

const LOOP_STATUS_MAP = {
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  LIVE: 'live',
};

const SLOT_STATUS_MAP = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REPLACED: 'replaced',
  BOOKED: 'booked',
  AVAILABLE: 'available',
};

function normalizeLoopStatus(value) {
  return LOOP_STATUS_MAP[value] || value;
}

function normalizeSlotStatus(value) {
  return SLOT_STATUS_MAP[value] || value;
}

function normalizeSlots(slots) {
  if (!Array.isArray(slots)) return slots;
  return slots.map(slot => {
    if (!slot || typeof slot !== 'object') return slot;
    if (!slot.status) return slot;
    return { ...slot, status: normalizeSlotStatus(slot.status) };
  });
}

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const db = admin.firestore();
  const snapshot = await db.collection('loops').get();

  let scanned = 0;
  let updated = 0;

  for (const doc of snapshot.docs) {
    scanned += 1;
    const data = doc.data() || {};
    const nextStatus = normalizeLoopStatus(data.status);
    const nextSlots = normalizeSlots(data.slots);

    const changedStatus = nextStatus !== data.status;
    const changedSlots = JSON.stringify(nextSlots) !== JSON.stringify(data.slots);

    if (!changedStatus && !changedSlots) continue;

    const patch = {};
    if (changedStatus) patch.status = nextStatus;
    if (changedSlots) patch.slots = nextSlots;
    await doc.ref.update(patch);
    updated += 1;
  }

  console.log(JSON.stringify({ scanned, updated }));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
