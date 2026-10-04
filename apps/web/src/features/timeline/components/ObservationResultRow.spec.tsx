import { NormalizePathLine } from './ObservationResultRow';

describe('NormalizePathLine', () => {
  it('draws equal readings with no range as a level line through the middle', () => {
    expect(NormalizePathLine([5, 5]).line).toEqual('M 0 11 L 6 11');
  });

  it('spreads readings between the lowest at the bottom and the highest at the top', () => {
    expect(NormalizePathLine([1, 2, 3]).line).toEqual('M 0 21 L 4 11 L 8 1');
  });
});
