import {
  buildPaginationMeta,
  DEFAULT_LIMIT,
  paginatedResponse,
} from './pagination.dto';

describe('buildPaginationMeta', () => {
  it('computes page flags for a normal page', () => {
    expect(buildPaginationMeta(45, 2, 20)).toEqual({
      currentPage: 2,
      itemsPerPage: 20,
      totalItems: 45,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });

  it('never reports a page below one', () => {
    const meta = buildPaginationMeta(10, 0, 20);

    expect(meta.currentPage).toBe(1);
    expect(meta.hasPreviousPage).toBe(false);
  });

  it('falls back to the default limit for invalid limits', () => {
    expect(buildPaginationMeta(10, 1, 0).itemsPerPage).toBe(1);
    expect(buildPaginationMeta(10, 1, Number.NaN).itemsPerPage).toBe(
      DEFAULT_LIMIT,
    );
  });

  it('treats a negative or invalid total as empty', () => {
    expect(buildPaginationMeta(-5, 1, 20).totalItems).toBe(0);
    expect(buildPaginationMeta(Number.NaN, 1, 20).totalItems).toBe(0);
  });
});

describe('paginatedResponse', () => {
  it('returns the same metadata as buildPaginationMeta', () => {
    const response = paginatedResponse('ok', ['a'], 21, 2, 10);

    expect(response).toMatchObject({
      message: 'ok',
      items: ['a'],
      total: 21,
      page: 2,
      limit: 10,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    });
    expect(response.meta).toEqual(buildPaginationMeta(21, 2, 10));
  });
});
