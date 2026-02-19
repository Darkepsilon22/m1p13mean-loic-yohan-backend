require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const result = await mongoose.connection.db.collection('reservationboutiques').updateOne(
    { _id: new mongoose.Types.ObjectId('698c361b00313c5698a00cf0') },
    { $set: { status: 'annulee', cancelledAt: new Date(), rejectionReason: 'Contrat résilié' } }
  );
  console.log('Updated:', result.modifiedCount);
  await mongoose.disconnect();
}

run().catch(console.error);
