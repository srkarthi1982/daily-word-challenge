import { defineDb } from "astro:db";
import { DailyWords } from "./tables";

export default defineDb({
  tables: {
    DailyWords,
  },
});
