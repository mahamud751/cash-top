import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import App from '../App';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: require('react-native').View,
  SafeAreaView: require('react-native').View,
}));

jest.mock('../src/Visuals', () => ({
  Chart: () => null,
  Icon: () => null,
  Mark: () => null,
  Orbit: () => null,
}));

test('shows the wallet totals and opens the preset deposit form', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      balance: 1245000,
      profit: 45000,
      deposit: 1200000,
      rate: 625,
      events: [],
    }),
  });
  let app!: Renderer.ReactTestRenderer;
  try {
    await act(async () => {
      app = Renderer.create(<App />);
    });
    expect(app.root.findAllByType(Text).map(n => n.props.children)).toContain(
      '৳12,450.00',
    );
    const deposit = app.root
      .findAllByType(Text)
      .find(n => n.props.children === 'Deposit')!;
    let button = deposit.parent;
    while (button && !button.props.onPress) button = button.parent;
    await act(async () => {
      button!.props.onPress();
    });
    expect(app.root.findAllByType(Text).map(n => n.props.children)).toContain(
      'bKash deposit',
    );
  } finally {
    await act(async () => {
      app?.unmount();
    });
    globalThis.fetch = original;
  }
});
