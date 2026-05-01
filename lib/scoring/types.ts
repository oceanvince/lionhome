export type ReadinessBand = "hot" | "warm" | "cool" | "cold";

export interface ScoreComponents {
  timeline: number;
  budget_clarity: number;
  income_alignment: number;
  confidence: number;
  agent_history: number;
  concern_specificity: number;
  free_text_quality: number;
}

export interface ScoreResult {
  score: number;
  band: ReadinessBand;
  components: ScoreComponents;
}
