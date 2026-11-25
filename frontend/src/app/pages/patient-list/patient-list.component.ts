import { DatePipe, NgClass } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Patient } from '../../models/patient';
import { getApiErrorMessage } from '../../services/api-error';
import { PatientService } from '../../services/patient.service';

type PatientLayout = 'table' | 'cards';

@Component({
  selector: 'app-patient-list',
  standalone: true,
  imports: [DatePipe, NgClass, NgbPaginationModule, ReactiveFormsModule, RouterLink],
  templateUrl: './patient-list.component.html',
  styleUrl: './patient-list.component.scss',
})
export class PatientListComponent implements OnInit {
  private readonly patientService = inject(PatientService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSize = 5;
  readonly searchControl = new FormControl('', { nonNullable: true });
  patients: Patient[] = [];
  filteredPatients: Patient[] = [];
  visiblePatients: Patient[] = [];
  page = 1;
  search = '';
  layout: PatientLayout = 'table';
  loading = true;
  errorMessage: string | null = null;
  listQuery: Params = {};

  ngOnInit(): void {
    this.layout = localStorage.getItem('patient-layout') === 'cards' ? 'cards' : 'table';

    this.patientService.patients$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((patients) => {
        this.patients = patients;
        this.applyView();
        if (this.patientService.hasLoaded) {
          this.loading = false;
          this.errorMessage = null;
        }
      });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.search = params.get('search') ?? '';
      this.page = Math.max(1, Number(params.get('page')) || 1);
      if (this.searchControl.value !== this.search) {
        this.searchControl.setValue(this.search, { emitEvent: false });
      }
      this.applyView();
    });

    this.searchControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.search = value.trim();
        this.page = 1;
        this.syncQuery();
      });

    this.patientService.loadPatients().subscribe({
      error: (error: unknown) => {
        this.loading = false;
        this.errorMessage = getApiErrorMessage(error);
      },
    });
  }

  retry(): void {
    this.loading = true;
    this.errorMessage = null;
    this.patientService.loadPatients(true).subscribe({
      error: (error: unknown) => {
        this.loading = false;
        this.errorMessage = getApiErrorMessage(error);
      },
    });
  }

  setPage(page: number): void {
    this.page = page;
    this.syncQuery();
    this.applyView();
  }

  setLayout(layout: PatientLayout): void {
    this.layout = layout;
    localStorage.setItem('patient-layout', layout);
  }

  private applyView(): void {
    const query = this.search.trim().toLocaleLowerCase();
    this.filteredPatients = this.patients.filter((patient) => {
      if (!query) {
        return true;
      }
      return (
        patient.name.toLocaleLowerCase().includes(query) ||
        (patient.notes ?? '').toLocaleLowerCase().includes(query)
      );
    });

    const lastPage = Math.max(1, Math.ceil(this.filteredPatients.length / this.pageSize));
    if (this.page > lastPage) {
      this.page = lastPage;
      this.syncQuery();
    }
    const start = (this.page - 1) * this.pageSize;
    this.visiblePatients = this.filteredPatients.slice(start, start + this.pageSize);
    this.listQuery = {
      search: this.search || null,
      page: this.page > 1 ? this.page : null,
    };
  }

  private syncQuery(): void {
    this.listQuery = {
      search: this.search || null,
      page: this.page > 1 ? this.page : null,
    };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.listQuery,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
