-- Migration: Add auto-incrementing patient_number
-- Run this in the Supabase SQL Editor

-- 1. Add patient_number sequence starting at 1001 (looks more professional)
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS patient_number SERIAL;

-- Update the sequence to start at 1001 if the column was just created
-- Only sets the start point if no rows exist yet
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM patients WHERE patient_number > 0) = 0 THEN
    ALTER SEQUENCE patients_patient_number_seq RESTART WITH 1001;
  END IF;
END $$;

-- Backfill any existing patients that have patient_number = 0 or default
UPDATE patients
SET patient_number = nextval('patients_patient_number_seq')
WHERE patient_number IS NULL OR patient_number = 0;

-- 2. Add patient_number to consultations for easy display (denormalized)
ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS patient_number INTEGER DEFAULT NULL;

-- Backfill existing consultations from their linked patient
UPDATE consultations c
SET patient_number = p.patient_number
FROM patients p
WHERE c.patient_id = p.id AND c.patient_number IS NULL;

-- 3. Make patient_number unique per doctor (composite unique constraint)
-- This ensures no two patients of the same doctor share a number
-- (Skip if constraint already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patients_doctor_patient_number_unique'
  ) THEN
    ALTER TABLE patients ADD CONSTRAINT patients_doctor_patient_number_unique
      UNIQUE (doctor_id, patient_number);
  END IF;
END $$;
