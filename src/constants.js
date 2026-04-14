import dotenv from "dotenv";
dotenv.config({
  path: "./.env",
});

export const zone = process.env.ZONE||'C';

export const POSITIONS = {
  1: "first",
  2: "second",
  3: "third",
};

export const DEPARTMENTS = [];

export const USER_ZONE_KEYS = ["a","b","c","d","f"];

export const RESULT_CATEGORIES = ["chithrolsavam" , "saahithyolsavam"];

