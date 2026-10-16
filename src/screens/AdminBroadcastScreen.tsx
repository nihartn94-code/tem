import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/ui/Header';
import { Card, SectionHeader, StatusBadge } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { SkeletonCard } from '../components/ui/SkeletonLoader';
import { useColors, Typography, Spacing } from '../config/theme';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../config/providers';
import { useTranslation } from 'react-i18next';
import { PharmaIcon, AppIcons } from '../components/ui/Icon';
import { friendlyError } from '../lib/utils';

interface BroadcastRecord {
  id: string;
  message: string;
  target_role: string;
  sent_at: string;
}

export function AdminBroadcastScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { user } = useAuthContext();
  const [message, setMessage] = useState('');
  const [targetRole, setTargetRole] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [broadcasts, setBroadcasts] = useState<BroadcastRecord[]>([]);
  const [broadcastsLoading, setBroadcastsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBroadcasts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, action, metadata, created_at, actor_id')
        .eq('action', 'BROADCAST_SENT')
        .eq('entity_type', 'broadcast')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const records: BroadcastRecord[] = (data || [])
        .filter((row) => row.metadata && typeof row.metadata === 'object')
        .map((row) => ({
          id: row.id,
          message: row.metadata?.message || 'No message',
          target_role: row.metadata?.target_role || 'ALL',
          sent_at: row.created_at,
        }));
      setBroadcasts(records);
    } catch (err) {
      // Silent fail — broadcasts are non-critical
    } finally {
      setBroadcastsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBroadcasts();
  }, [fetchBroadcasts]);

  const roles = [
    { value: 'ALL', label: 'All Users', icon: AppIcons.users },
    { value: 'STOCKIST', label: 'Stockists', icon: AppIcons.stockist },
    { value: 'PHARMA_COMPANY', label: 'Companies', icon: AppIcons.company },
    { value: 'MANUFACTURER', label: 'Manufacturers', icon: AppIcons.catalog },
  ];

  const handleSend = async () => {
    if (!message.trim()) {
      Alert.alert(t('common.error'), 'Message cannot be empty');
      return;
    }

    setLoading(true);
    try {
      const { error: auditError } = await supabase.from('audit_log').insert({
        actor_id: user?.id,
        action: 'BROADCAST_SENT',
        entity_type: 'broadcast',
        entity_id: user?.id || '',
        metadata: { message: message.trim(), target_role: targetRole },
      });
      if (auditError) throw auditError;

      setSent(true);
      Alert.alert(
        t('common.done'),
        `Broadcast sent to ${targetRole === 'ALL' ? 'all users' : targetRole + 's'}\n\nNote: Users will see this broadcast the next time they open the app or refresh the Admin dashboard.`
      );
      setMessage('');
      setTimeout(() => setSent(false), 3000);
      fetchBroadcasts();
    } catch (err) {
      Alert.alert(t('common.error'), friendlyError(err, t('common.retry')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]} edges={['top']}>
      <Header title={t('admin.broadcast')} subtitle="Send notifications to users" />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <SectionHeader icon={AppIcons.broadcast} title={t('admin.broadcast')} />
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Send a broadcast notification to users. Use for regulatory updates, planned downtime, or platform announcements.
          </Text>

          {/* Target Role Selection */}
          <View style={styles.roleRow}>
            {roles.map((role) => (
              <Button
                key={role.value}
                title={role.label}
                onPress={() => setTargetRole(role.value)}
                variant={targetRole === role.value ? 'primary' : 'ghost'}
                size="sm"
                iconName={role.icon}
                style={styles.roleButton}
              />
            ))}
          </View>

          {/* Message Input */}
          <Input
            label="Broadcast Message"
            value={message}
            onChangeText={setMessage}
            placeholder="Enter your broadcast message..."
            multiline
            numberOfLines={4}
            style={{ height: 120, textAlignVertical: 'top' }}
          />

          <Button
            title={sent ? 'Sent!' : `Send to ${targetRole === 'ALL' ? 'All Users' : targetRole + 's'}`}
            onPress={handleSend}
            loading={loading}
            fullWidth
            size="lg"
            variant={sent ? 'safe' : 'primary'}
            iconName={AppIcons.broadcast}
          />
        </Card>

        {/* Recent Broadcasts */}
        <Card style={styles.card}>
          <SectionHeader icon={AppIcons.info} title="Recent Broadcasts" action={`${broadcasts.length} sent`} />
          {broadcastsLoading ? (
            <View>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : broadcasts.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No broadcasts sent yet</Text>
          ) : (
            broadcasts.map((broadcast) => (
              <View
                key={broadcast.id}
                style={[styles.broadcastRow, { borderBottomColor: colors.borderLight }]}
              >
                <View style={styles.broadcastInfo}>
                  <Text
                    style={[styles.broadcastMessage, { color: colors.textPrimary }]}
                    numberOfLines={2}
                  >
                    {broadcast.message}
                  </Text>
                  <View style={styles.broadcastMeta}>
                    <StatusBadge
                      status="safe"
                      label={broadcast.target_role === 'ALL' ? 'All Users' : broadcast.target_role}
                      size="sm"
                    />
                    <Text style={[styles.broadcastDate, { color: colors.textTertiary }]}>
                      {new Date(broadcast.sent_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  card: { padding: Spacing.xl, marginBottom: Spacing.lg },
  hint: {
    ...Typography.bodySmall,
    marginBottom: Spacing.lg,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  roleButton: { marginBottom: Spacing.xs },
  emptyText: {
    ...Typography.body,
    textAlign: 'center',
    padding: Spacing.xl,
  },
  broadcastRow: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  broadcastInfo: { flex: 1 },
  broadcastMessage: {
    ...Typography.bodySmall,
    marginBottom: Spacing.xs,
    fontWeight: '500',
  },
  broadcastMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  broadcastDate: { ...Typography.caption },
});
