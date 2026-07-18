// Loads environment variables from .env before any other module reads
// process.env. ES module imports are hoisted and evaluated in order, so
// importing this module first (see src/server.js) guarantees dotenv runs
// before any service/config module is evaluated.
import dotenv from 'dotenv';

dotenv.config();
