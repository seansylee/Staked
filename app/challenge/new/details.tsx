import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Controller, Resolver, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors, radius } from '@/constants/theme';
import { useChallengeStore } from '@/store/useChallengeStore';
import { Window } from '@/types';
import { formatCurrency } from '@/utils/formatting';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(60),
  stake_dollars: z.coerce.number().min(50, 'Minimum $50').max(2500, 'Maximum $2,500'),
  duration_days: z.coerce.number().min(1).max(365),
  target_count: z.coerce.number().min(1, 'At least 1').max(99),
  goal_window: z.enum(['daily', 'weekly', 'monthly']),
});

type FormData = z.infer<typeof schema>;

const STAKE_PRESETS = [50, 100, 250, 500, 1000];
const DURATION_PRESETS = [30, 60, 90];
const COUNT_PRESETS = [1, 2, 3, 5];
const WINDOWS: { label: string; value: Window }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

export default function ChallengeDetailsScreen() {
  const { setDraft, draft } = useChallengeStore();

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      name: draft?.name ?? '',
      stake_dollars: draft ? draft.stake_amount_cents / 100 : 100,
      duration_days: draft?.duration_days ?? 30,
      target_count: draft?.target_count ?? 1,
      goal_window: draft?.goal_window ?? 'daily',
    },
  });

  const stakeDollars = watch('stake_dollars');
  const durationDays = watch('duration_days');
  const targetCount = watch('target_count');
  const goalWindow = watch('goal_window');
  const dailyProtection = stakeDollars && durationDays ? stakeDollars / durationDays : 0;

  const onSubmit = (data: FormData) => {
    setDraft({
      name: data.name,
      stake_amount_cents: Math.round(data.stake_dollars * 100),
      duration_days: data.duration_days,
      target_count: data.target_count,
      goal_window: data.goal_window,
    });
    router.replace('/challenge/new/charity');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>

          <Text style={styles.stepText}>1 / 3</Text>
          <Text style={styles.title}>Challenge Details</Text>

          <View style={styles.form}>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Name"
                  placeholder="e.g. Summer Fitness"
                  value={value}
                  onChangeText={onChange}
                  error={errors.name?.message}
                />
              )}
            />

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Stake Amount</Text>
              <View style={styles.presets}>
                {STAKE_PRESETS.map((a) => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.pill, stakeDollars === a && styles.pillActive]}
                    onPress={() => setValue('stake_dollars', a)}
                  >
                    <Text style={[styles.pillText, stakeDollars === a && styles.pillActiveText]}>
                      ${a}
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

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Duration</Text>
              <View style={styles.presets}>
                {DURATION_PRESETS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.pill, durationDays === d && styles.pillActive]}
                    onPress={() => setValue('duration_days', d)}
                  >
                    <Text style={[styles.pillText, durationDays === d && styles.pillActiveText]}>
                      {d}d
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

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Goal Frequency</Text>
              <View style={styles.presets}>
                {WINDOWS.map((w) => (
                  <TouchableOpacity
                    key={w.value}
                    style={[styles.pill, goalWindow === w.value && styles.pillActive]}
                    onPress={() => setValue('goal_window', w.value)}
                  >
                    <Text style={[styles.pillText, goalWindow === w.value && styles.pillActiveText]}>
                      {w.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.presets}>
                {COUNT_PRESETS.map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.pill, targetCount === n && styles.pillActive]}
                    onPress={() => setValue('target_count', n)}
                  >
                    <Text style={[styles.pillText, targetCount === n && styles.pillActiveText]}>
                      {n}×
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Controller
                control={control}
                name="target_count"
                render={({ field: { onChange, value } }) => (
                  <Input
                    placeholder="Custom count"
                    keyboardType="numeric"
                    value={value ? String(value) : ''}
                    onChangeText={onChange}
                    error={errors.target_count?.message}
                  />
                )}
              />
            </View>

            {stakeDollars > 0 && durationDays > 0 && (
              <View style={styles.preview}>
                <Text style={styles.previewLabel}>Daily protection value</Text>
                <Text style={styles.previewValue}>
                  {formatCurrency(Math.round(dailyProtection * 100))}/day
                </Text>
              </View>
            )}

            <Button title="Next: Charity →" onPress={handleSubmit(onSubmit)} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 48 },
  back: { paddingVertical: 12 },
  backText: { fontSize: 22, color: colors.textSecondary },
  stepText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  title: { fontSize: 28, fontFamily: 'HelveticaNeue-CondensedBlack', color: colors.text, letterSpacing: -0.5, transform: [{ scaleY: 1.35 }], marginBottom: 32 },
  form: { gap: 28 },
  field: { gap: 12 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  presets: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: colors.white, borderColor: colors.white },
  pillText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  pillActiveText: { color: colors.black },
  preview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewLabel: { fontSize: 13, color: colors.textSecondary },
  previewValue: { fontSize: 15, fontWeight: '700', color: colors.text },
});
