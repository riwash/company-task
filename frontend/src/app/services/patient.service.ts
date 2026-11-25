import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, finalize, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Patient, PatientInput } from '../models/patient';

@Injectable({ providedIn: 'root' })
export class PatientService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/patients`;
  private loaded = false;
  private loadingRequest: Observable<Patient[]> | null = null;
  private readonly patientsSubject = new BehaviorSubject<Patient[]>([]);
  readonly patients$ = this.patientsSubject.asObservable();

  get hasLoaded(): boolean {
    return this.loaded;
  }

  loadPatients(force = false): Observable<Patient[]> {
    if (!force && this.loaded) {
      return of(this.patientsSubject.value);
    }
    if (!force && this.loadingRequest) {
      return this.loadingRequest;
    }

    let request: Observable<Patient[]>;
    request = this.http.get<Patient[]>(this.apiUrl).pipe(
      tap((patients) => {
        this.loaded = true;
        this.patientsSubject.next(patients);
      }),
      finalize(() => {
        if (this.loadingRequest === request) {
          this.loadingRequest = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.loadingRequest = request;
    return request;
  }

  getPatient(id: number): Observable<Patient> {
    return this.http.get<Patient>(`${this.apiUrl}/${id}`);
  }

  createPatient(input: PatientInput): Observable<Patient> {
    return this.http.post<Patient>(this.apiUrl, input).pipe(
      tap((patient) => this.updatePatient(patient)),
    );
  }

  updatePatientById(id: number, input: PatientInput): Observable<Patient> {
    return this.http.put<Patient>(`${this.apiUrl}/${id}`, input).pipe(
      tap((patient) => this.updatePatient(patient)),
    );
  }

  deletePatient(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        this.loaded = true;
        this.patientsSubject.next(
          this.patientsSubject.value.filter((patient) => patient.id !== id),
        );
      }),
    );
  }

  private updatePatient(patient: Patient): void {
    this.loaded = true;
    const exists = this.patientsSubject.value.some((item) => item.id === patient.id);
    const updated = exists
      ? this.patientsSubject.value.map((item) => (item.id === patient.id ? patient : item))
      : [...this.patientsSubject.value, patient];
    this.patientsSubject.next(updated.sort((left, right) => left.id - right.id));
  }
}
