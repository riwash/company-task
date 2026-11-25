import { AsyncPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { getApiErrorMessage } from './services/api-error';
import { PatientService } from './services/patient.service';

@Component({
  selector: 'app-root',
  imports: [AsyncPipe, RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly patientService = inject(PatientService);
  private readonly destroyRef = inject(DestroyRef);
  summaryError: string | null = null;
  readonly statusCounts$ = this.patientService.patients$.pipe(
    map((patients) =>
      patients.reduce(
        (counts, patient) => {
          counts[patient.status] += 1;
          return counts;
        },
        { Pending: 0, Checked: 0, Failed: 0 },
      ),
    ),
  );

  ngOnInit(): void {
    this.patientService.patients$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.patientService.hasLoaded) {
          this.summaryError = null;
        }
      });
    this.loadSummary();
  }

  loadSummary(): void {
    this.summaryError = null;
    this.patientService.loadPatients().subscribe({
      error: (error: unknown) => {
        this.summaryError = getApiErrorMessage(error);
      },
    });
  }
}
