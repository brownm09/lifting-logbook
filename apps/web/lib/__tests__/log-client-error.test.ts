import { logClientError } from '../log-client-error';

// The shared chokepoint every client-side mutation form routes its failures through
// (#783). These lock the contract the call sites and their tests depend on: a stable,
// greppable prefix; the raw error passed through untouched; optional structured context
// only when non-empty; and never throwing from inside a catch block.
describe('logClientError', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('logs the operation under a stable [client-mutation] prefix with the raw error', () => {
    const err = new Error('boom');
    logClientError('rescheduleWorkout', err);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[client-mutation] rescheduleWorkout failed', err);
  });

  it('appends structured context as a third argument when provided', () => {
    const err = new Error('boom');
    logClientError('createLiftRecord', err, { program: '5-3-1', setNum: 2 });

    expect(errorSpy).toHaveBeenCalledWith(
      '[client-mutation] createLiftRecord failed',
      err,
      { program: '5-3-1', setNum: 2 },
    );
  });

  it('omits the context argument entirely when the context object is empty', () => {
    logClientError('skipWorkout', new Error('x'), {});

    // An empty context must not be forwarded as a third arg — keeps the console line clean.
    const call = errorSpy.mock.calls[0];
    expect(call).toHaveLength(2);
  });

  it('does not throw on a non-Error thrown value', () => {
    expect(() => logClientError('undoImport', 'a string failure')).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      '[client-mutation] undoImport failed',
      'a string failure',
    );
  });
});
