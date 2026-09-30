-- Migration: Add doctor-centric fields to consultations table
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS chief_complaint TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS follow_up_date  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rx_notes        TEXT DEFAULT NULL;

-- Add helpful comments
COMMENT ON COLUMN consultations.chief_complaint IS 'Reason for visit / chief complaint entered before recording';
COMMENT ON COLUMN consultations.follow_up_date  IS 'Follow-up date or interval (e.g. "2 Weeks" or "21/04/2026")';
COMMENT ON COLUMN consultations.rx_notes        IS 'Quick prescription / Rx notes from the doctor';
