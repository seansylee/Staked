import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';

// Stripe's PaymentSheet returnURL (staked://payment-complete) lands here after
// a bank-app or 3DS redirect. The SDK finishes the payment itself — this route
// only exists so the router doesn't show "unmatched route" over the sheet.
export default function PaymentCompleteScreen() {
  useEffect(() => {
    const t = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
    }, 300);
    return () => clearTimeout(t);
  }, []);

  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
});
