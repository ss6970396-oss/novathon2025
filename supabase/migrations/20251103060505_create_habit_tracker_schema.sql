/*
  # Smart Habit Tracker Database Schema
  
  This migration creates the complete database structure for the college student habit tracking application.
  
  ## 1. New Tables
  
  ### `users`
  - `id` (uuid, primary key) - User identifier
  - `email` (text) - User email
  - `xp` (integer) - Total experience points earned
  - `level` (integer) - Current XP level
  - `current_streak` (integer) - Current consecutive day streak
  - `max_streak` (integer) - Maximum streak achieved
  - `dark_mode` (boolean) - Dark mode preference
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### `habits`
  - `id` (uuid, primary key) - Habit identifier
  - `user_id` (uuid, foreign key) - References users table
  - `name` (text) - Habit name
  - `frequency` (text) - "Daily" or "Weekly"
  - `goal_value` (integer) - Target value for quantity-based habits
  - `unit` (text) - Unit of measurement (e.g., "minutes", "glasses")
  - `is_boolean` (boolean) - True for check-off habits, false for quantity-based
  - `created_at` (timestamptz) - Creation timestamp
  
  ### `habit_logs`
  - `id` (uuid, primary key) - Log entry identifier
  - `user_id` (uuid, foreign key) - References users table
  - `habit_id` (uuid, foreign key) - References habits table
  - `completed` (boolean) - Completion status
  - `value` (integer) - Logged value for quantity-based habits
  - `log_date` (date) - Date of the log entry
  - `created_at` (timestamptz) - Creation timestamp
  
  ### `sleep_logs`
  - `id` (uuid, primary key) - Sleep log identifier
  - `user_id` (uuid, foreign key) - References users table
  - `bedtime` (text) - Bedtime in HH:MM format
  - `wake_time` (text) - Wake time in HH:MM format
  - `quality` (integer) - Sleep quality rating (1-5)
  - `total_hours` (numeric) - Calculated total hours slept
  - `log_date` (date) - Date of the sleep log
  - `created_at` (timestamptz) - Creation timestamp
  
  ### `timetable_entries`
  - `id` (uuid, primary key) - Timetable entry identifier
  - `user_id` (uuid, foreign key) - References users table
  - `course` (text) - Course name
  - `day` (text) - Day of week (Monday-Sunday)
  - `start_time` (text) - Start time in HH:MM format
  - `end_time` (text) - End time in HH:MM format
  - `created_at` (timestamptz) - Creation timestamp
  
  ## 2. Security
  
  - Enable RLS on all tables
  - Add policies for authenticated users to manage their own data
  - Ensure users can only access their own records
  
  ## 3. Indexes
  
  - Add indexes on foreign keys for improved query performance
  - Add indexes on user_id and date columns for faster lookups
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  xp integer DEFAULT 0,
  level integer DEFAULT 1,
  current_streak integer DEFAULT 0,
  max_streak integer DEFAULT 0,
  dark_mode boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create habits table
CREATE TABLE IF NOT EXISTS habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  frequency text NOT NULL DEFAULT 'Daily',
  goal_value integer DEFAULT 1,
  unit text DEFAULT '',
  is_boolean boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create habit_logs table
CREATE TABLE IF NOT EXISTS habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_id uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  completed boolean DEFAULT false,
  value integer DEFAULT 0,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- Create sleep_logs table
CREATE TABLE IF NOT EXISTS sleep_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bedtime text NOT NULL,
  wake_time text NOT NULL,
  quality integer NOT NULL CHECK (quality >= 1 AND quality <= 5),
  total_hours numeric NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- Create timetable_entries table
CREATE TABLE IF NOT EXISTS timetable_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course text NOT NULL,
  day text NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for habits table
CREATE POLICY "Users can view own habits"
  ON habits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own habits"
  ON habits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own habits"
  ON habits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own habits"
  ON habits FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for habit_logs table
CREATE POLICY "Users can view own habit logs"
  ON habit_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own habit logs"
  ON habit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own habit logs"
  ON habit_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own habit logs"
  ON habit_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for sleep_logs table
CREATE POLICY "Users can view own sleep logs"
  ON sleep_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sleep logs"
  ON sleep_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sleep logs"
  ON sleep_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sleep logs"
  ON sleep_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for timetable_entries table
CREATE POLICY "Users can view own timetable"
  ON timetable_entries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own timetable entries"
  ON timetable_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own timetable entries"
  ON timetable_entries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own timetable entries"
  ON timetable_entries FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for improved query performance
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_id ON habit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id ON habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_log_date ON habit_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_sleep_logs_user_id ON sleep_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sleep_logs_log_date ON sleep_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_user_id ON timetable_entries(user_id);

-- Create unique constraint to prevent duplicate logs on same date
CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_logs_unique_date 
  ON habit_logs(user_id, habit_id, log_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sleep_logs_unique_date 
  ON sleep_logs(user_id, log_date);