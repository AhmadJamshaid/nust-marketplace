const admin = require('firebase-admin');
const serviceAccount = require('c:\\Users\\Admin\\Downloads\\nust-market-5b7c7-firebase-adminsdk-fbsvc-66ecfb8e73.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateDatabase() {
  console.log("Starting Database Migration: Username to Full Name");
  
  // 1. Fetch all users and create a mapping
  const usersSnapshot = await db.collection('users').get();
  const emailToNameMap = {};
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.email && data.name) {
      emailToNameMap[data.email] = data.name;
    }
  });

  console.log(`Loaded ${Object.keys(emailToNameMap).length} user mappings.`);

  // 2. Migrate Listings
  const listingsSnapshot = await db.collection('listings').get();
  let listingsUpdated = 0;
  for (const doc of listingsSnapshot.docs) {
    const data = doc.data();
    if (data.seller && emailToNameMap[data.seller]) {
      const realName = emailToNameMap[data.seller];
      if (data.sellerName !== realName) {
        await doc.ref.update({ sellerName: realName });
        listingsUpdated++;
      }
    }
  }
  console.log(`Updated ${listingsUpdated} listings.`);

  // 3. Migrate Requests (Community Board)
  const requestsSnapshot = await db.collection('requests').get();
  let requestsUpdated = 0;
  for (const doc of requestsSnapshot.docs) {
    const data = doc.data();
    if (data.userEmail && emailToNameMap[data.userEmail]) {
      const realName = emailToNameMap[data.userEmail];
      if (data.userName !== realName) {
        await doc.ref.update({ userName: realName });
        requestsUpdated++;
      }
    }
  }
  console.log(`Updated ${requestsUpdated} requests.`);

  // 4. Migrate Chat Metadata
  const chatsSnapshot = await db.collection('chats').get();
  let chatsUpdated = 0;
  for (const doc of chatsSnapshot.docs) {
    const data = doc.data();
    let updated = false;
    let updates = {};

    // Check participants logic
    if (data.participants && Array.isArray(data.participants)) {
      const newParticipants = data.participants.map(p => {
        if (p.email && emailToNameMap[p.email]) {
          const realName = emailToNameMap[p.email];
          if (p.username !== realName) {
            updated = true;
            return { ...p, username: realName };
          }
        }
        return p;
      });
      if (updated) updates.participants = newParticipants;
    }

    // Check legacy sellerName / userName
    if (data.seller && emailToNameMap[data.seller] && data.sellerName !== emailToNameMap[data.seller]) {
      updates.sellerName = emailToNameMap[data.seller];
      updated = true;
    }
    if (data.userEmail && emailToNameMap[data.userEmail] && data.userName !== emailToNameMap[data.userEmail]) {
      updates.userName = emailToNameMap[data.userEmail];
      updated = true;
    }

    if (updated) {
      await doc.ref.update(updates);
      chatsUpdated++;
    }
  }
  console.log(`Updated ${chatsUpdated} chat metadata blocks.`);

  console.log("Migration Complete!");
}

migrateDatabase().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
