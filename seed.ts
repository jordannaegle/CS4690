import bcrypt from 'bcryptjs';
import User from './models/User.js';

export async function ensureSeedData(): Promise<void> {
  const rootAccounts = [
    {
      tenant: 'uvu' as const,
      username: 'root_uvu',
      displayName: 'Root UVU',
      role: 'admin' as const,
      password: 'willy'
    },
    {
      tenant: 'uofu' as const,
      username: 'root_uofu',
      displayName: 'Root UofU',
      role: 'admin' as const,
      password: 'swoopy'
    }
  ];

  for (const rootAccount of rootAccounts) {
    const existingUser = await User.findOne({
      tenant: rootAccount.tenant,
      username: rootAccount.username
    });

    if (!existingUser) {
      const passwordHash = await bcrypt.hash(rootAccount.password, 10);
      await User.create({
        tenant: rootAccount.tenant,
        username: rootAccount.username,
        displayName: rootAccount.displayName,
        role: rootAccount.role,
        passwordHash
      });
    }
  }
}
