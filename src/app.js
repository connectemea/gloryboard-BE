import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "./db/index.js";
import healthcheckRouter  from "./routes/healthcheck.routes.js";
import publicRouter from './routes/public.routes.js'
import organizationRouter from './routes/organization.routes.js'
import adminRouter from './routes/admin.routes.js'
import { errorHandler } from "./middlewares/error.middlewares.js";
import logger from "./services/logger.service.js";


dotenv.config({
  path: "./.env",
});

// Connect to MongoDB (required for Vercel where src/app.js is the entry point)
connectDB();

const app = express();

// Logging Middleware
app.use((req, res, next) => {
  const start = process.hrtime();

  res.on("finish", () => {
    const diff = process.hrtime(start);
    const responseTime = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2); // Convert to ms
    const statusCode = res.statusCode;

    logger.info(
      `${req.method} ${req.originalUrl} ${statusCode} ${responseTime}ms`
    );
  });

  next();
});

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);


// common middlewares
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: true, limit: "32kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Routes

app.use("/", healthcheckRouter);
app.use("/api/v1" , publicRouter);
app.use("/api/v1/healthcheck", healthcheckRouter)
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/org", organizationRouter);


app.use("*" , (req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(errorHandler);

export default app;
