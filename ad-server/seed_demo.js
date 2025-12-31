import { Firestore } from '@google-cloud/firestore';
import dotenv from 'dotenv';

dotenv.config();

const firestore = new Firestore();

async function seed() {
  console.log('Seeding Advanced Demo Data...');

  const SCREEN_ID = 'demo-screen-01'; // The ID we will use for the demo

  // 1. Create Demo Advertiser
  const advertiserRef = firestore.collection('advertisers').doc('demo_corp');
  await advertiserRef.set({
    name: 'Demo Corp',
    contact_email: 'demo@example.com',
    status: 'active',
    created_at: new Date().toISOString()
  });
  console.log('Advertiser created: Demo Corp');

  // 2. Create 3 Ads with Variable Durations
  const adsCollection = firestore.collection('ads');
  const ads = [
    { id: 'ad_001', title: 'Demo Coffee', file_path: 'demo_ad_1.png', duration: 5 },
    { id: 'ad_002', title: 'Demo Tech', file_path: 'demo_ad_2.png', duration: 5 },  // Fast ad
    { id: 'ad_003', title: 'Demo Travel', file_path: 'demo_ad_3.png', duration: 5 }, // Long ad
    { id: 'ad_004', title: 'Costco', file_path: 'demo_ad_costco.png', duration: 5 },
    { id: 'ad_005', title: 'Pizza', file_path: 'demo_ad_pizza.png', duration: 5 },
  ];

  for (const ad of ads) {
    await adsCollection.doc(ad.id).set({
      advertiser_id: 'demo_corp',
      title: ad.title,
      type: 'image',
      storage_path: ad.file_path,
      duration_seconds: ad.duration, // User-defined duration
      status: 'active',
      created_at: new Date().toISOString()
    });
    console.log(`Ad created: ${ad.title} (${ad.duration}s)`);

    // 3. Create Approval Record (Screen Owner Approval)
    // In a real app, this happens via UI. For demo, we auto-approve.
    await firestore.collection('screen_approvals').doc(`${SCREEN_ID}_${ad.id}`).set({
      screen_id: SCREEN_ID,
      ad_id: ad.id,
      status: 'approved', // approved, rejected, pending
      approved_by: 'owner_user_id',
      approved_at: new Date().toISOString()
    });
    console.log(`-> Approved for screen: ${SCREEN_ID}`);
  }

  // 4. Register the Screen beforehand so it's ready
  await firestore.collection('screens').doc(SCREEN_ID).set({
    screen_id: SCREEN_ID,
    status: 'active',
    location_owner_id: 'owner_user_id',
    last_seen: new Date().toISOString()
  });
  console.log(`Screen pre-registered: ${SCREEN_ID}`);

  console.log('Seeding Complete!');
}

seed().catch(console.error);
