import { HttpErrorResponse } from '@angular/common/http';

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const message = error.error?.message;
    if (typeof message === 'string') {
      return message;
    }
    if (error.status === 0) {
      return 'Unable to reach the patient API. Check your connection and try again.';
    }
  }

  return 'Something went wrong. Please try again.';
}
