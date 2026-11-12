import { runInTransaction } from './run-in-transaction';

interface FakeQueryRunner {
  connect: jest.Mock;
  startTransaction: jest.Mock;
  commitTransaction: jest.Mock;
  rollbackTransaction: jest.Mock;
  release: jest.Mock;
  manager: object;
}

function createQueryRunner(
  overrides: Partial<FakeQueryRunner> = {},
): FakeQueryRunner {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {},
    ...overrides,
  };
}

const dataSourceFor = (runner: FakeQueryRunner) =>
  ({ createQueryRunner: () => runner }) as never;

describe('runInTransaction', () => {
  it('returns the value produced by the unit of work and commits', async () => {
    const runner = createQueryRunner();

    const result = await runInTransaction(
      dataSourceFor(runner),
      async () => 42,
    );

    expect(result).toBe(42);
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back and rethrows the original error', async () => {
    const runner = createQueryRunner();

    await expect(
      runInTransaction(dataSourceFor(runner), async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(runner.commitTransaction).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('does not let a failed release mask a successful result', async () => {
    const runner = createQueryRunner({
      release: jest.fn().mockRejectedValue(new Error('pool closed')),
    });

    await expect(
      runInTransaction(dataSourceFor(runner), async () => 'saved'),
    ).resolves.toBe('saved');
  });

  it('does not let a failed release mask the operation error', async () => {
    const runner = createQueryRunner({
      release: jest.fn().mockRejectedValue(new Error('pool closed')),
    });

    await expect(
      runInTransaction(dataSourceFor(runner), async () => {
        throw new Error('original failure');
      }),
    ).rejects.toThrow('original failure');
  });
});
