/**
 * Seed script to create 3 test accounts (admin, boutique, acheteur).
 * Usage: node src/seeds/seedTestUsers.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const testUsers = [
  {
    email: 'admin@test.com',
    password: 'Test1234!',
    firstName: 'Admin',
    lastName: 'Test',
    role: 'admin',
    status: 'active',
    isEmailVerified: true
  },
  {
    email: 'boutique@test.com',
    password: 'Test1234!',
    firstName: 'Boutique',
    lastName: 'Test',
    role: 'boutique',
    status: 'active',
    isEmailVerified: true
  },
  {
    email: 'acheteur@test.com',
    password: 'Test1234!',
    firstName: 'Acheteur',
    lastName: 'Test',
    role: 'acheteur',
    status: 'active',
    isEmailVerified: true
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    for (const userData of testUsers) {
      const existing = await User.findOne({ email: userData.email });
      if (existing) {
        console.log(`User ${userData.email} already exists, skipping.`);
        continue;
      }
      await User.create(userData);
      console.log(`Created test user: ${userData.email} (${userData.role})`);
    }

    console.log('Seed completed.');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
