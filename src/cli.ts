import { db, pool } from './server/db/client';
import { users, settings } from './server/db/schema';
import { hashPassword, hashPin } from './server/auth/password';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'create-admin') {
    const username = args[1] || 'admin';
    const password = args[2] || 'Admin@1234';
    const pin = args[3] || '1234';
    const displayName = args[4] || 'Admin';

    console.log(`Creating admin user "${username}"...`);

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, username.toLowerCase()))
      .limit(1);

    const passwordHash = await hashPassword(password);
    const pinHash = await hashPin(pin);

    if (existing.length > 0) {
      console.log(`User "${username}" exists. Updating to admin with new credentials...`);
      await db
        .update(users)
        .set({
          passwordHash,
          adminPinHash: pinHash,
          roles: ['ADMIN', 'WAITER'],
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing[0].id));
    } else {
      await db.insert(users).values({
        username: username.toLowerCase(),
        displayName,
        passwordHash,
        adminPinHash: pinHash,
        roles: ['ADMIN', 'WAITER'],
        isActive: true,
      });
    }

    console.log(`Admin user "${username}" created/updated successfully.`);
    console.log(`Username: ${username}, Password: ${password}, PIN: ${pin}`);
  } else if (command === 'create-waiter') {
    const username = args[1] || 'waiter1';
    const password = args[2] || 'Waiter@1234';
    const displayName = args[3] || 'Waiter';

    console.log(`Creating waiter user "${username}"...`);
    const passwordHash = await hashPassword(password);
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, username.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(users)
        .set({
          passwordHash,
          roles: ['WAITER'],
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing[0].id));
    } else {
      await db.insert(users).values({
        username: username.toLowerCase(),
        displayName,
        passwordHash,
        roles: ['WAITER'],
        isActive: true,
      });
    }

    console.log(`Waiter user "${username}" created/updated successfully.`);
    console.log(`Username: ${username}, Password: ${password}`);
  } else if (command === 'list-users') {
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        roles: users.roles,
        isActive: users.isActive,
      })
      .from(users);

    console.log('Registered Users:');
    console.table(allUsers);
  } else {
    console.log('Usage:');
    console.log('  pnpm cli create-admin [username] [password] [pin] [displayName]');
    console.log('  pnpm cli create-waiter [username] [password] [displayName]');
    console.log('  pnpm cli list-users');
  }

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('CLI error:', err);
  process.exit(1);
});
