import type { Alpine } from "alpinejs";
import { actions } from "astro:actions";

type DailyWord = {
  id: number;
  term: string;
  meaning: string;
  exampleText: string | null;
  category: string | null;
  challengeDate: string | Date | null;
  isCompleted: boolean;
  completedAt: string | Date | null;
  isFavorite: boolean;
  status: "active" | "archived";
  createdAt: string | Date;
  updatedAt: string | Date;
  archivedAt: string | Date | null;
};

export default function initAlpine(Alpine: Alpine) {
  Alpine.store("dailyWords", {
    words: [] as DailyWord[],
    activeWordDetail: null as DailyWord | null,
    searchQuery: "",
    activeTab: "overview" as "overview" | "words" | "favorites" | "archived",
    statusFilter: "all" as "all" | "pending" | "completed",
    categoryFilter: "all",
    isDrawerOpen: false,
    isEditing: false,
    isSubmitting: false,
    flashMessage: "",
    flashType: "success" as "success" | "error",
    form: {
      id: null as number | null,
      term: "",
      meaning: "",
      exampleText: "",
      category: "",
      challengeDate: "",
    },

    init(words: DailyWord[]) {
      this.words = words;
    },

    setActiveTab(tab: "overview" | "words" | "favorites" | "archived") {
      this.activeTab = tab;
      this.statusFilter = "all";
      this.searchQuery = "";
    },

    openCreateDrawer() {
      this.isEditing = false;
      this.form = { id: null, term: "", meaning: "", exampleText: "", category: "", challengeDate: "" };
      this.isDrawerOpen = true;
    },

    openEditDrawer(word: DailyWord) {
      this.isEditing = true;
      this.form = {
        id: word.id,
        term: word.term,
        meaning: word.meaning,
        exampleText: word.exampleText ?? "",
        category: word.category ?? "",
        challengeDate: word.challengeDate ? new Date(word.challengeDate).toISOString().slice(0, 10) : "",
      };
      this.isDrawerOpen = true;
    },

    closeDrawer() {
      this.isDrawerOpen = false;
    },

    get filteredWords() {
      return this.words.filter((word) => {
        if (this.activeTab === "favorites" && !word.isFavorite) return false;
        if (this.activeTab === "archived" && word.status !== "archived") return false;
        if (this.activeTab !== "archived" && word.status === "archived") return false;

        if (this.statusFilter === "pending" && word.isCompleted) return false;
        if (this.statusFilter === "completed" && !word.isCompleted) return false;

        if (this.categoryFilter !== "all") {
          const value = (word.category ?? "uncategorized").toLowerCase();
          if (value !== this.categoryFilter.toLowerCase()) return false;
        }

        if (!this.searchQuery.trim()) return true;
        const query = this.searchQuery.toLowerCase();

        return [word.term, word.meaning, word.exampleText ?? "", word.category ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
    },

    get summary() {
      const totalWords = this.words.length;
      const activeWords = this.words.filter((word) => word.status === "active").length;
      const archivedWords = this.words.filter((word) => word.status === "archived").length;
      const completedWords = this.words.filter((word) => word.isCompleted).length;
      const favoriteWords = this.words.filter((word) => word.isFavorite).length;
      const today = new Date().toISOString().slice(0, 10);
      const todaysChallengeCount = this.words.filter((word) => {
        if (!word.challengeDate) return false;
        return new Date(word.challengeDate).toISOString().slice(0, 10) === today;
      }).length;

      return { totalWords, activeWords, archivedWords, completedWords, favoriteWords, todaysChallengeCount };
    },

    get categories() {
      const set = new Set<string>();
      this.words.forEach((word) => {
        if (word.category) set.add(word.category);
      });
      return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
    },

    async refreshWords() {
      const result = await actions.listDailyWords({ includeArchived: true });
      if (result.error) throw new Error(result.error.message);
      this.words = result.data.words as DailyWord[];
    },

    showFlash(type: "success" | "error", message: string) {
      this.flashType = type;
      this.flashMessage = message;
      setTimeout(() => {
        if (this.flashMessage === message) this.flashMessage = "";
      }, 2500);
    },

    async submitForm() {
      this.isSubmitting = true;
      try {
        const payload = {
          term: this.form.term,
          meaning: this.form.meaning,
          exampleText: this.form.exampleText || null,
          category: this.form.category || null,
          challengeDate: this.form.challengeDate || null,
        };

        const result = this.isEditing && this.form.id
          ? await actions.updateDailyWord({ id: this.form.id, ...payload })
          : await actions.createDailyWord(payload);

        if (result.error) throw new Error(result.error.message);

        await this.refreshWords();
        this.closeDrawer();
        this.showFlash("success", this.isEditing ? "Word updated." : "Word created.");
      } catch (error) {
        this.showFlash("error", error instanceof Error ? error.message : "Something went wrong.");
      } finally {
        this.isSubmitting = false;
      }
    },

    async toggleFavorite(word: DailyWord) {
      const previous = word.isFavorite;
      word.isFavorite = !previous;
      try {
        const result = await actions.toggleDailyWordFavorite({ id: word.id });
        if (result.error) throw new Error(result.error.message);
        await this.refreshWords();
      } catch {
        word.isFavorite = previous;
        this.showFlash("error", "Unable to update favorite state.");
      }
    },

    async toggleCompleted(word: DailyWord) {
      const previous = word.isCompleted;
      word.isCompleted = !previous;
      try {
        const result = await actions.toggleDailyWordCompleted({ id: word.id });
        if (result.error) throw new Error(result.error.message);
        await this.refreshWords();
      } catch {
        word.isCompleted = previous;
        this.showFlash("error", "Unable to update completion state.");
      }
    },

    async archiveWord(word: DailyWord) {
      const result = await actions.archiveDailyWord({ id: word.id });
      if (result.error) {
        this.showFlash("error", result.error.message);
        return;
      }
      await this.refreshWords();
      this.showFlash("success", "Word archived.");
    },

    async restoreWord(word: DailyWord) {
      const result = await actions.restoreDailyWord({ id: word.id });
      if (result.error) {
        this.showFlash("error", result.error.message);
        return;
      }
      await this.refreshWords();
      this.showFlash("success", "Word restored.");
    },
  });
}
