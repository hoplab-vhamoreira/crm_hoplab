import type { ClinicalArea, SelfRating } from './database'

export type SubmissionStatus = 'pending_review' | 'reviewed' | 'archived'

export interface Exercise {
  id: string
  therapist_id: string
  title: string
  instructions: string | null
  video_url: string | null
  clinical_area: ClinicalArea
  duration_seconds: number | null
  created_at: string
  updated_at: string
}

export interface TreatmentPlan {
  id: string
  therapist_id: string
  patient_id: string
  title: string
  total_weeks: number
  current_week: number
  starts_on: string        // ISO date
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PlanExercise {
  id: string
  plan_id: string
  exercise_id: string
  week_number: number
  sets: number
  reps: number | null
  duration_seconds: number | null
  day_of_week: number[] | null
  sort_order: number
  therapist_notes: string | null
  created_at: string
  // join
  exercise?: Exercise
}

export interface AdherenceLog {
  id: string
  patient_id: string
  plan_exercise_id: string
  session_date: string     // ISO date
  completed: boolean
  self_rating: SelfRating | null
  sets_done: number | null
  notes: string | null
  created_at: string
}

export type AdherenceLogInsert = Omit<AdherenceLog, 'id' | 'created_at'>

export interface VideoSubmission {
  id: string
  patient_id: string
  therapist_id: string
  plan_exercise_id: string | null
  storage_path: string
  status: SubmissionStatus
  patient_note: string | null
  therapist_feedback: string | null
  shortcut_ids: string[] | null
  reviewed_at: string | null
  delete_after: string
  created_at: string
}

/** Vista composta para o ecrã "Hoje" */
export interface TodayExerciseItem {
  planExercise: PlanExercise
  exercise: Exercise
  adherence: AdherenceLog | null  // null = ainda não feito hoje
}
