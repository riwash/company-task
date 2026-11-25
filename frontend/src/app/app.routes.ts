import { Routes } from '@angular/router';
import { PatientDetailComponent } from './pages/patient-detail/patient-detail.component';
import { PatientFormComponent } from './pages/patient-form/patient-form.component';
import { PatientListComponent } from './pages/patient-list/patient-list.component';

export const routes: Routes = [
  { path: 'patients/new', component: PatientFormComponent },
  { path: 'patients/:id/edit', component: PatientFormComponent },
  { path: 'patients/:id', component: PatientDetailComponent },
  { path: 'patients', component: PatientListComponent },
  { path: '', pathMatch: 'full', redirectTo: 'patients' },
  { path: '**', redirectTo: 'patients' },
];
