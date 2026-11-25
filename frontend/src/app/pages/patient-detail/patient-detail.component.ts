import { DatePipe, NgClass } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Patient } from '../../models/patient';
import { getApiErrorMessage } from '../../services/api-error';
import { PatientService } from '../../services/patient.service';

@Component({
  selector: 'app-patient-detail',
  standalone: true,
  imports: [DatePipe, NgClass, RouterLink],
  templateUrl: './patient-detail.component.html',
  styleUrl: './patient-detail.component.scss',
})
export class PatientDetailComponent implements OnInit {
  private readonly patientService = inject(PatientService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  patient: Patient | null = null;
  loading = true;
  notFound = false;
  deleting = false;
  errorMessage: string | null = null;
  savedMessage: string | null = null;
  listQuery: { search?: string; page?: number } = {};

  ngOnInit(): void {
    const search = this.route.snapshot.queryParamMap.get('search');
    const page = Number(this.route.snapshot.queryParamMap.get('page'));
    this.listQuery = {
      ...(search ? { search } : {}),
      ...(page > 1 ? { page } : {}),
    };

    const savedMessage: unknown = window.history.state.savedMessage;
    if (typeof savedMessage === 'string') {
      this.savedMessage = savedMessage;
    }

    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.patientService.getPatient(id).subscribe({
      next: (patient) => {
        this.patient = patient;
        this.loading = false;
      },
      error: (error: unknown) => {
        this.loading = false;
        this.notFound = error instanceof HttpErrorResponse && error.status === 404;
        this.errorMessage = this.notFound ? null : getApiErrorMessage(error);
      },
    });
  }

  deletePatient(): void {
    if (!this.patient || !window.confirm(`Delete ${this.patient.name || 'this patient'}?`)) {
      return;
    }

    this.deleting = true;
    this.errorMessage = null;
    this.patientService.deletePatient(this.patient.id).subscribe({
      next: () => void this.backToList(),
      error: (error: unknown) => {
        this.deleting = false;
        this.errorMessage = getApiErrorMessage(error);
      },
    });
  }

  backToList(): Promise<boolean> {
    return this.router.navigate(['/patients'], { queryParams: this.listQuery });
  }
}
