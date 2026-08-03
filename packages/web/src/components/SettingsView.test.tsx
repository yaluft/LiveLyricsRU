import { render, fireEvent, cleanup } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SettingsView } from './SettingsView.jsx';
import { oceanParams, resetOceanOverrides, setSettings } from '../state/settings.js';

beforeEach(() => {
  setSettings('themeId', 'calm');
  resetOceanOverrides();
});

afterEach(cleanup);

describe('SettingsView', () => {
  it('exposes every ocean parameter as a control', () => {
    // v2 exposed three of these and hardcoded the rest, including the light
    // direction — the parameter that decides whether the water reads as dawn
    // or midnight.
    const { container } = render(() => <SettingsView />);

    const sliders = container.querySelectorAll('input[type="range"]');
    const colours = container.querySelectorAll('input[type="color"]');

    expect(sliders.length).toBe(13);
    expect(colours.length).toBe(3);
  });

  it('writes a slider change through to the resolved parameters', () => {
    const { getByLabelText } = render(() => <SettingsView />);

    const slider = getByLabelText(/Высота волн/) as HTMLInputElement;
    fireEvent.input(slider, { target: { value: '1.4' } });

    expect(oceanParams(0).height).toBeCloseTo(1.4);
  });

  it('writes a colour change through as a string, not a number', () => {
    const { container } = render(() => <SettingsView />);

    const colour = container.querySelector('input[type="color"]') as HTMLInputElement;
    fireEvent.input(colour, { target: { value: '#123456' } });

    expect(oceanParams(0).fog).toBe('#123456');
  });

  it('switching theme changes the parameters', () => {
    const { getByText } = render(() => <SettingsView />);
    const before = oceanParams(0).fog;

    fireEvent.click(getByText('Ночь'));

    expect(oceanParams(0).fog).not.toBe(before);
  });

  it('overrides survive a theme switch, and reset clears them', () => {
    const { getByLabelText, getByText } = render(() => <SettingsView />);

    fireEvent.input(getByLabelText(/Высота волн/), { target: { value: '1.9' } });
    fireEvent.click(getByText('Ночь'));
    expect(oceanParams(0).height).toBeCloseTo(1.9);

    fireEvent.click(getByText('сбросить'));
    expect(oceanParams(0).height).not.toBeCloseTo(1.9);
  });

  it('marks animated themes so they are distinguishable from static ones', () => {
    const { getByText } = render(() => <SettingsView />);
    expect(getByText(/Закат/).textContent).toContain('◷');
  });
});
