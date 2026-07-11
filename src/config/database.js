import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase(logger) {
  mongoose.set('strictQuery', true);

  await mongoose.connect(env.mongoUri);

  mongoose.connection.on('error', (err) => {
    logger?.error({ err }, 'Erro de conexão com o MongoDB');
  });

  logger?.info(`MongoDB conectado em ${env.mongoUri}`);
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
