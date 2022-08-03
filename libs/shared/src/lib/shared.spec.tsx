import { render } from '@testing-library/react';

import Shared from './shared';

describe('Shared', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Shared />);
    expect(baseElement).toBeTruthy();
  });
});
