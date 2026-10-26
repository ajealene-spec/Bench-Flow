import type { ExecutionEvent, Procedure, StepRecord } from '../../types';
import type { ReportPhoto } from '../data/photos/photosForReport';
import type { ExecutionLog } from './buildExecutionLog';
import type { Report } from './buildReport';

/** What the report page loads for one experiment. Shared with the research package loader. */
export interface ReportData {
  report: Report;
  procedure?: Procedure;
  records: StepRecord[];
  events: ExecutionEvent[];
  executionLog: ExecutionLog;
  /** Photos of the run, in time order. Shown with thumbnails and captions. */
  photos: ReportPhoto[];
}
