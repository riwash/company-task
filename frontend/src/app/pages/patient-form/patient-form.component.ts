import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BLOOD_GROUPS, Patient, PatientInput } from '../../models/patient';
import { getApiErrorMessage } from '../../services/api-error';
import { PatientService } from '../../services/patient.service';

@Component({
  selector: 'app-patient-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './patient-form.component.html',
  styleUrl: './patient-form.component.scss',
})
export class PatientFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder).nonNullable;
  private readonly patientService = inject(PatientService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly bloodGroups = BLOOD_GROUPS;
  readonly patientForm = this.formBuilder.group({
    name: '',
    age: this.formBuilder.control<number | null>(null, {
      validators: [
        Validators.required,
        (control) => (Number.isInteger(control.value) ? null : { integer: true }),
      ],
    }),
    notes: '',
    check_datetime: this.formBuilder.control('', { validators: [Validators.required] }),
    blood_group: '',
  });
  loading = false;
  saving = false;
  errorMessage: string | null = null;
  patientId: number | null = null;
  listQuery: { search?: string; page?: number } = {};

  ngOnInit(): void {
    const idValue = this.route.snapshot.paramMap.get('id');
    this.patientId = idValue === null ? null : Number(idValue);
    const search = this.route.snapshot.queryParamMap.get('search');
    const page = Number(this.route.snapshot.queryParamMap.get('page'));
    this.listQuery = {
      ...(search ? { search } : {}),
      ...(page > 1 ? { page } : {}),
    };

    if (this.patientId !== null) {
      this.loadPatient(this.patientId);
    }

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const currentSearch = params.get('search');
      const currentPage = Number(params.get('page'));
      this.listQuery = {
        ...(currentSearch ? { search: currentSearch } : {}),
        ...(currentPage > 1 ? { page: currentPage } : {}),
      };
    });
  }

  submit(): void {
    if (this.patientForm.invalid || this.saving) {
      this.patientForm.markAllAsTouched();
      return;
    }

    const value = this.patientForm.getRawValue();
    if (value.age === null) {
      return;
    }
    const input: PatientInput = {
      name: value.name,
      age: value.age,
      notes: value.notes === '' ? null : value.notes,
      check_datetime: new Date(value.check_datetime).toISOString(),
      blood_group: this.bloodGroups.find((group) => group === value.blood_group) ?? null,
    };

    this.saving = true;
    this.errorMessage = null;
    const saveRequest =
      this.patientId === null
        ? this.patientService.createPatient(input)
        : this.patientService.updatePatientById(this.patientId, input);

    saveRequest.subscribe({
      next: (patient) => this.finishSave(patient),
      error: (error: unknown) => {
        this.saving = false;
        this.errorMessage = getApiErrorMessage(error);
      },
    });
  }

  private loadPatient(id: number): void {
    this.loading = true;
    this.patientService.getPatient(id).subscribe({
      next: (patient) => {
        this.setFormValues(patient);
        this.loading = false;
      },
      error: (error: unknown) => {
        this.loading = false;
        this.errorMessage = getApiErrorMessage(error);
      },
    });
  }

  private setFormValues(patient: Patient): void {
    const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(patient.check_datetime);
    const date = new Date(hasTimezone ? patient.check_datetime : `${patient.check_datetime}Z`);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    this.patientForm.setValue({
      name: patient.name,
      age: patient.age,
      notes: patient.notes ?? '',
      check_datetime: localDate.toISOString().slice(0, 16),
      blood_group: patient.blood_group ?? '',
    });
  }

  private finishSave(patient: Patient): void {
    void this.router.navigate(['/patients', patient.id], {
      queryParams: this.listQuery,
      state: { savedMessage: `Saved — status: ${patient.status}` },
    });
  }
}
