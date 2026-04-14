import app from "./src/app.js";
import logger from "./src/services/logger.service.js";


if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  
  app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });
}

export default app;
