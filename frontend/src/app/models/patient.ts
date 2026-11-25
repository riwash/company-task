export type PatientStatus = 'Pending' | 'Checked' | 'Failed';
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export interface Patient {
  id: number;
  name: string;
  age: number;
  notes: string | null;
  check_datetime: string;
  blood_group: BloodGroup | null;
  status: PatientStatus;
  created_at: string;
  updated_at: string;
}

export type PatientInput = Pick<
  Patient,
  'name' | 'age' | 'notes' | 'check_datetime' | 'blood_group'
>;

export interface UpsertBatchResult {
  success: Patient[];
  failed: { item: Partial<PatientInput> & { id?: number }; reason: string }[];
}

export const BLOOD_GROUPS: BloodGroup[] = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
];
