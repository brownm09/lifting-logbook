import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepImport } from './StepImport';

function csvFile(content: string, name = 'maxes.csv') {
  return new File([content], name, { type: 'text/csv' });
}

describe('StepImport', () => {
  it('parses a training-maxes CSV and pre-fills the latest training max per lift', async () => {
    const user = userEvent.setup();
    const onImported = jest.fn();
    render(<StepImport onImported={onImported} />);

    const csv = [
      'Date Updated,Lift,Weight',
      '2026-01-01,Squat,300',
      '2026-02-01,Squat,315', // newer date for Squat → this one wins
      '2026-01-01,Bench Press,225',
    ].join('\n');

    await user.upload(screen.getByLabelText(/training-maxes csv/i), csvFile(csv));

    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    // One row per lift, latest TM, no reps; persisted later as the training max.
    expect(onImported).toHaveBeenCalledWith([
      { lift: 'Squat', weight: '315', reps: '' },
      { lift: 'Bench Press', weight: '225', reps: '' },
    ]);
    expect(screen.getByText(/loaded 2 training maxes/i)).toBeInTheDocument();
  });

  it('redirects to the full import tool when the file is not training maxes', async () => {
    const user = userEvent.setup();
    const onImported = jest.fn();
    render(<StepImport onImported={onImported} />);

    // Lift-history shaped: Reps/Set columns (anti-signals for training maxes) and
    // no "Date Updated" distinctive marker.
    const csv = [
      'Date,Lift,Weight,Reps,Set',
      '2026-01-01,Squat,300,5,1',
      '2026-01-08,Bench Press,225,5,1',
    ].join('\n');

    await user.upload(screen.getByLabelText(/training-maxes csv/i), csvFile(csv));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(onImported).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/import tool/i);
  });

  it('shows a file-level error when a training-maxes file has an unreadable row', async () => {
    const user = userEvent.setup();
    const onImported = jest.fn();
    render(<StepImport onImported={onImported} />);

    const csv = [
      'Date Updated,Lift,Weight',
      '2026-01-01,Squat,315',
      '2026-01-01,Bench Press,notanumber', // non-numeric weight → parse throws
    ].join('\n');

    await user.upload(screen.getByLabelText(/training-maxes csv/i), csvFile(csv));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(onImported).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t read every row/i);
  });
});
