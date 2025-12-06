import { defineDb } from "astro:db";
import {
  DailyChallenges,
  DailyChallengeAttempts,
  UserChallengeStats,
} from "./tables";

export default defineDb({
  tables: {
    DailyChallenges,
    DailyChallengeAttempts,
    UserChallengeStats,
  },
});
