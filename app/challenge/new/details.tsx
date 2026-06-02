import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useChallengeStore } from '@/store/useChallengeStore';
import { formatCurrency } from '@/utils/formatting';

const schema = z.object({
  name: z.string().min(1, 'Challenge name is required').max(60),
  stake_dollars: z.coerce
    .number()
    .min(50, 'Minimum stake is $50')
    .max(2500, 'Maximum stake is $2,500'),
  duration_days: z.coerce.number().min(1).max(365),
});

type FormData = z.infer<typeof schema>;

const STAKE_PRESETS = [50, 100, 250, 500, 1000];
const DURATION_PRESETS = [30, 60, 90];

export default function ChallengeDetailsScreen() {
  const { setDraft, draft } = useChallengeStore();

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: draft?.name ?? '',
      stake_dollars: draft ? draft.stake_amount_cents / 100 : 100,
      duration_days: draft?.duration_days ?? 30,
    },
  });

  const stakeDollars = watch('stake_dollars');
  const durationDays = watch('duration_days');
  const dailyProtection = stakeDollars && durationDays ? stakeDollars / durationDays : 0;

  const onSubmit = (data: FormData) => {
    setDraft({
      name: data.name,
      stake_amount_cents: Math.round(data.stake_dollars * 100),
      duration_days: data.duration_days,
    });
    router.push('/challenge/new/goals');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.stepIndicator}>
            <Text style={styles.stepText}>Step 1 of 3</Text>
          </View>

          <Text style={styles.title}>Challenge Details</Text>

          <View style={styles.form}>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Challenge Name"
                  placeholder="e.g. Summer Fitness"
                  value={value}
                  onChangeText={onChange}
                  error={errors.name?.message}
                />
              )}
            />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Stake Amount</Text>
              <View style={styles.presets}>
                {STAKE_PRESETS.map((amount) => (
                  <TouchableOpacity
                    key={amount}
                    style={[styles.preset, stakeDollars === amount && styles.presetActive]}
                    onPress={() => setValue('stake_dollars', amount)}
                  >
                    <Text style={[styles.presetText, stakeDollars === amount && styles.presetActiveText]}>
                      ${amount}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Controller
                control={control}
                name="stake_dollars"
                render={({ field: { onChange, value } }) => (
                  <Input
                    placeholder="Custom amount"
                    keyboardType="numeric"
                    value={value ? String(value) : ''}
                    onChangeText={onChange}
                    error={errors.stake_dollars?.message}
                  />
                )}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Duration</Text>
              <View style={styles.presets}>
                {DURATION_PRESETS.map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={[styles.preset, durationDays === days && styles.presetActive]}
                    onPress={() => setValue('duration_days', days)}
                  >
                    <Text style={[styles.presetText, durationDays === days && styles.presetActiveText]}>
                      {days}d
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Controller
                control={control}
                name="duration_days"
                render={({ field: { onChange, value } }) => (
                  <Input
                    placeholder="Custom days"
                    keyboardType="numeric"
                    value={value ? String(value) : ''}
                    onChangeText={onChange}
                    error={errors.duration_days?.message}
                  />
                )}
              />
            </View>

            {stakeDollars > 0 && durationDays > 0 && (
              <View style={styles.preview}>
                <Text style={styles.previewLabel}>Daily protection value</Text>
                <Text style={styles.previewAmount}>{formatCurrency(Math.round(dailyProtection * 100))}/day</Text>
              </View>
            )}

            <Button title="Next: Add Goals" onPress={handleSubmit(onSubmit)} style={styles.nextBtn} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
  back: { marginBottom: 16 },
  backText: { fontSize: 16, color: '#555' },
  stepIndicator: { marginBottom: 8 },
  stepText: { fontSize: 13, color: '#999', fontWeight: '500' },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginBottom: 32 },
  form: { gap: 28 },
  fieldGroup: { gap: 12 },
  fieldLabel: { fontSize: 14, fontWeight: '500', color: '#1a1a1a' },
  presets: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  preset: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  presetActive: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  presetText: { fontSize: 14, color: '#555', fontWeight: '500' },
  presetActiveText: { color: '#fff' },
  preview: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: { fontSize: 14, color: '#555' },
  previewAmount: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  nextBtn: {},
});
