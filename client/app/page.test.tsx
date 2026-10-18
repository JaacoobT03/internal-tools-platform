import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home', () => {
  it('renders the platform heading', () => {
    render(<Home />);
    expect(
      screen.getByRole('heading', { name: 'Internal Tools Platform' }),
    ).toBeInTheDocument();
  });
});
