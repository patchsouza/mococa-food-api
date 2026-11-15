import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { Admin } from '../models/Admin.js';

async function createAdmin() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error('Defina ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD no ambiente para criar um admin.');
  }
  if (password.length < 12) throw new Error('ADMIN_PASSWORD deve ter ao menos 12 caracteres.');

  await connectDatabase(console);
  try {
    if (await Admin.exists({ email })) throw new Error('Já existe um admin com esse e-mail.');
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await Admin.create({ name, email, passwordHash, permissions: ['*'] });
    console.info(`Admin criado: ${admin.email} (${admin._id})`);
  } finally {
    await disconnectDatabase();
  }
}

createAdmin().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});