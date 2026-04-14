import mongoose from "mongoose";
import logger from "../services/logger.service.js";
import { getZoneConfig } from "../utils/zoneConfig.js";
import { getZoneEnv } from "../utils/getZoneEnv.js";

export const connectDB = async () => {
  const zone = getZoneEnv();
  const { DB_NAME } = getZoneConfig(zone);
  console.log(DB_NAME);
  try {
    const conn = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_NAME}`
    );
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    throw error;
  }
};
