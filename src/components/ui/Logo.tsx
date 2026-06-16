import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/constants/theme';

type LogoProps = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function Logo({ size = 64, style }: LogoProps) {
  const pad = size * 0.16;
  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.highlight,
          { top: -pad * 0.4, bottom: -pad * 0.4, left: -pad, right: -pad },
        ]}
      />
      <Text style={[styles.symbol, { fontSize: size }]}>$</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
  highlight: {
    position: 'absolute',
    backgroundColor: colors.text,
    transform: [{ rotate: '-1.5deg' }],
  },
  symbol: {
    fontFamily: 'HelveticaNeue-CondensedBlack',
    color: colors.bg,
    letterSpacing: -0.5,
    transform: [{ scaleY: 1.35 }],
  },
});
