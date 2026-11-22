import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

const paths = {
  home: 'M3 10 12 3l9 7v10h-6v-6H9v6H3z',
  trade:
    'M5 3v3m0 8v5M3 6h4v8H3z M12 5v5m0 7v4m-2-11h4v7h-4z M19 2v3m0 7v6m-2-13h4v7h-4z',
  activity: 'M5 3h14v18l-3-2-4 2-4-2-3 2z M8 8h8m-8 4h6',
  admin: 'M12 2 4 5v6c0 5 4 9 8 11 4-2 8-6 8-11V5z M9 12l2 2 4-5',
  deposit: 'M12 3v13m-5-5 5 5 5-5 M4 16v5h16v-5',
  withdraw: 'M12 16V3m-5 5 5-5 5 5 M4 16v5h16v-5',
  up: 'M5 17 17 5M7 5h10v10',
  chevron: 'm9 5 7 7-7 7',
  wallet: 'M3 6h17v14H3z M3 6l14-4v4m-3 6h6v4h-6z',
  close: 'M5 5l14 14M19 5 5 19',
  eye: 'M2 12q10-14 20 0-10 14-20 0z M14 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0',
};
export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 22,
  color = '#202229',
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={paths[name]}
        fill="none"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
export function Mark() {
  return (
    <Svg width={34} height={34} viewBox="0 0 40 40">
      <Path fill="#282731" d="M15 4h17l-6 8h-9l-7 8 7 8h15l-6 8H13L1 21z" />
      <Path fill="#9882ef" d="M21 15h16l-7 9H14z" />
    </Svg>
  );
}
export function Orbit() {
  return (
    <Svg width={172} height={165} viewBox="0 0 172 165">
      <G rotation={-32} origin="90,82">
        {Array.from({ length: 40 }, (_, i) => {
          const a = (i * Math.PI) / 20;
          return (
            <Ellipse
              key={i}
              cx={90 + 39 * Math.cos(a)}
              cy={82 + 18 * Math.sin(a)}
              rx={19 + 3 * Math.sin(a)}
              ry={30}
              rotation={i * 9}
              origin={`${90 + 39 * Math.cos(a)},${82 + 18 * Math.sin(a)}`}
              fill="none"
              stroke={i % 5 === 0 ? '#ddceff' : '#a99ade'}
              strokeWidth={1.2}
            />
          );
        })}
      </G>
    </Svg>
  );
}
export function Chart({
  values,
  labels,
}: {
  values: number[];
  labels: string[];
}) {
  const low = Math.min(...values, 0),
    high = Math.max(...values, 1);
  const points = values.map((v, i) => [
    3 + (294 * i) / Math.max(1, values.length - 1),
    73 - (64 * (v - low)) / (high - low),
  ]);
  const line = points
      .map(([x, y], i) => (i ? 'L' : 'M') + x + ' ' + y)
      .join(' '),
    last = points[points.length - 1];
  return (
    <View>
      <Svg
        width="100%"
        height={93}
        viewBox="0 0 300 84"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#af97f7" stopOpacity={0.42} />
            <Stop offset="1" stopColor="#af97f7" stopOpacity={0.03} />
          </LinearGradient>
        </Defs>
        {[14, 43, 73].map(y => (
          <Path
            key={y}
            d={`M0 ${y}h300`}
            stroke="#e4e1ec"
            strokeDasharray="3 4"
          />
        ))}
        <Path d={line + ' L297 82 L3 82Z'} fill="url(#shade)" />
        <Path
          d={line}
          fill="none"
          stroke="#8964db"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        <Circle cx={last[0]} cy={last[1]} r={3} fill="#7350c1" />
      </Svg>
      <View style={styles.labels}>
        {labels.map((l, i) => (
          <Text key={i} style={styles.label}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 11, color: '#706d79' },
});
