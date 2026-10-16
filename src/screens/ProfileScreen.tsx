import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/ui/Header';
import { Card, StatusBadge } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuthContext } from '../config/providers';
import { useColors, Typography, Spacing, BorderRadius } from '../config/theme';
import { getRoleColor, getRoleLabel } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../config/i18n';
import { PharmaIcon, AppIcons } from '../components/ui/Icon';
import { Config } from '../config';

export function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const { user, signOut } = useAuthContext();

  const handleLanguageChange = async (lang: string) => {
    await changeLanguage(lang);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('auth.logout'), onPress: signOut, style: 'destructive' },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]} edges={['top']}>
      <Header
        title={t('profile.title')}
        rightAction={{
          icon: AppIcons.logout,
          label: 'Logout',
          onPress: handleLogout,
        }}
      />

      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        {/* User Card */}
        <Card style={[styles.userCard, { alignItems: 'center' }]} elevated>
          <View
            style={[
              styles.avatar,
              { backgroundColor: getRoleColor(user?.role || 'STOCKIST', colors) + '20' },
            ]}
          >
            <Text style={[styles.avatarText, { color: colors.textPrimary }]}>
              {user?.display_name?.[0]?.toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={[styles.userName, { color: colors.textPrimary }]}>
            {user?.display_name || 'User'}
          </Text>
          <Text style={[styles.userPhone, { color: colors.textSecondary }]}>
            {user?.phone_number || ''}
          </Text>
          <View style={styles.roleRow}>
            <StatusBadge
              status="safe"
              label={getRoleLabel(user?.role || 'STOCKIST')}
              size="sm"
            />
          </View>
        </Card>

        {/* Language Settings */}
        <Card style={styles.section} elevated>
          <View style={styles.sectionHeader}>
            <PharmaIcon name={AppIcons.info} size={20} color={colors.textPrimary} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}> Language / भाषा</Text>
          </View>
          <View style={styles.languageRow}>
            <Button
              title="English"
              onPress={() => handleLanguageChange('en')}
              variant={i18n.language === 'en' ? 'primary' : 'ghost'}
              size="sm"
              style={styles.langButton}
            />
            <Button
              title="हिन्दी"
              onPress={() => handleLanguageChange('hi')}
              variant={i18n.language === 'hi' ? 'primary' : 'ghost'}
              size="sm"
              style={styles.langButton}
            />
          </View>
        </Card>

        {/* App Info */}
        <Card style={styles.section} elevated>
          <View style={styles.sectionHeader}>
            <PharmaIcon name={AppIcons.info} size={20} color={colors.textPrimary} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}> About</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Version</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{Config.app.version}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Platform</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>PharmaOS B2B</Text>
          </View>
        </Card>

        {/* Logout */}
        <Button
          title={t('auth.logout')}
          onPress={handleLogout}
          variant="danger"
          fullWidth
          size="lg"
          iconName={AppIcons.logout}
          style={styles.logoutButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  userCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    ...Typography.hero,
  },
  userName: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  userPhone: {
    ...Typography.bodySmall,
    marginBottom: Spacing.sm,
  },
  roleRow: {
    marginTop: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    marginLeft: Spacing.sm,
  },
  languageRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  langButton: {
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  infoLabel: {
    ...Typography.bodySmall,
  },
  infoValue: {
    ...Typography.bodySmall,
    fontWeight: '500',
  },
  logoutButton: {
    marginTop: Spacing.lg,
  },
});
